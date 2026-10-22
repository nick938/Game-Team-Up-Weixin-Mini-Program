import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { harness } = require('../../../tests/support/miniapp.cjs');
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('profile editor saves optional preferences, publishes current user and allows clearing', async () => {
  const initial = {
    nickName: '玩家',
    groupIds: ['underground-gaming'],
    favoriteGames: ['CS2'],
    playTimes: ['weekend'],
  };
  const h = harness({ store: { user: initial }, callTeam: async (_, input) => ({ user: { ...input } }) });
  const editor = h.page('components/profile-gate/index', { show: true });
  assert.deepEqual([...editor.view.groupIds], initial.groupIds);
  assert.notEqual(editor.view.groupIds, initial.groupIds);
  editor.view.groupIds = [];
  editor.view.favoriteGames = [];
  editor.view.playTimes = [];
  await editor.save();
  assert.deepEqual(h.calls[0].input.groupIds, []);
  assert.deepEqual(h.calls[0].input.favoriteGames, []);
  assert.deepEqual(h.calls[0].input.playTimes, []);
  assert.equal(h.emitted[0].name, 'done');
  assert.deepEqual(h.store.user.groupIds, []);
});

test('group selection flows to server query, changed query clears old results and reset clears groups', async () => {
  let release;
  const h = harness({
    callTeam: async (_, query) =>
      query.groupIds?.length
        ? new Promise((resolve) => {
            release = resolve;
          })
        : { list: [{ _id: 'public' }], total: 1, hasMore: false },
  });
  const search = h.page('pages/index/index');
  await search.loadList();
  search.setFilters({ groupIds: ['underground-gaming'] });
  assert.equal(search.state.teams.length, 0);
  assert.deepEqual(h.calls.at(-1).input.groupIds, ['underground-gaming']);
  release({ list: [{ _id: 'tagged' }], total: 1, hasMore: false });
  await flush();
  assert.equal(search.state.teams[0]._id, 'tagged');
  search.clearFilters();
  assert.deepEqual(search.query().groupIds, []);
  await flush();
});

test('filter draft supports multiple groups, cancel isolation, apply and reset', () => {
  const original = ['a'];
  const h = harness();
  const filter = h.page('components/team-filters/index', {
    query: { groupIds: original, availableOnly: true },
    active: true,
  });
  filter.open();
  filter.view.draft.groupIds = ['a', 'b'];
  assert.deepEqual(original, ['a']);
  filter.apply();
  assert.deepEqual(h.emitted[0].detail.groupIds, ['a', 'b']);
  filter.reset();
  assert.deepEqual(filter.view.draft.groupIds, []);
});

test('custom games support adding, deduplication, removal and saving a pending name', async () => {
  const h = harness({
    store: { user: { nickName: '玩家', favoriteGames: ['CS2'] } },
    callTeam: async (_, input) => ({ user: input }),
  });
  const editor = h.page('components/profile-gate/index', { show: true });
  editor.view.gameDraft = '  星际露营模拟器  ';
  editor.addFavoriteGame();
  assert.deepEqual([...editor.view.favoriteGames], ['CS2', '星际露营模拟器']);
  editor.view.gameDraft = 'cs2';
  editor.addFavoriteGame();
  assert.equal(editor.view.favoriteGames.length, 2);
  editor.removeFavoriteGame('CS2');
  editor.view.gameDraft = '另一个自定义游戏';
  editor.view.steamFriendCode = ' 00123456 ';
  editor.view.wechatId = ' player_123 ';
  await editor.save();
  assert.deepEqual(h.calls[0].input.favoriteGames, ['星际露营模拟器', '另一个自定义游戏']);
  assert.equal(h.calls[0].input.steamFriendCode, '00123456');
  assert.equal(h.calls[0].input.wechatId, 'player_123');
});

test('custom game limits and invalid contacts prevent profile saving', async () => {
  const h = harness({ store: { user: { nickName: '玩家', favoriteGames: ['1', '2', '3', '4', '5'] } } });
  const editor = h.page('components/profile-gate/index', { show: true });
  editor.view.gameDraft = '6';
  await editor.save();
  assert.equal(h.calls.length, 0);
  assert.equal(editor.view.gameDraft, '6');
  editor.view.gameDraft = '';
  editor.view.steamFriendCode = 'invalid';
  await editor.save();
  assert.equal(h.calls.length, 0);
  editor.view.steamFriendCode = '';
  editor.view.wechatId = '含空格 ID';
  await editor.save();
  assert.equal(h.calls.length, 0);
});

test('contact copy preserves strings and shows success only after clipboard succeeds', () => {
  const clipboard = [];
  const h = harness({
    platform: {
      setClipboardData: (options) => {
        clipboard.push(options);
      },
    },
  });
  const { useProfileContacts } = h.load('composables/useProfileContacts');
  const { contacts, copyContact } = useProfileContacts(() => ({
    steamFriendCode: '00123456',
    wechatId: 'Player_123',
  }));
  assert.equal(contacts.value.length, 2);
  copyContact('steamFriendCode');
  assert.equal(clipboard[0].data, '00123456');
  assert.equal(clipboard[0].showToast, false);
  assert.deepEqual(h.toasts, []);
  copyContact('wechatId');
  assert.equal(clipboard.length, 1, 'pending copy ignores repeated presses');
  clipboard[0].success();
  clipboard[0].complete();
  assert.deepEqual(h.toasts, ['已复制Steam 好友码']);
  copyContact('wechatId');
  assert.equal(clipboard[1].data, 'Player_123');
  clipboard[1].fail();
  clipboard[1].complete();
  assert.equal(h.toasts.at(-1), '复制失败，请重试');
  copyContact('missing');
  assert.equal(clipboard.length, 2);
});

test('empty contact fields are omitted from public display', () => {
  const h = harness();
  const { useProfileContacts } = h.load('composables/useProfileContacts');
  assert.equal(useProfileContacts(() => ({})).contacts.value.length, 0);
});
