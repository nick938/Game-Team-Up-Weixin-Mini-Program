import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { harness } = require('../../../tests/support/miniapp.cjs');
const { nextTick } = require('../node_modules/vue');

test('startup and mine share one profile request, refresh bypasses the short cache', async () => {
  let finish;
  const h = harness({
    callTeam: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const { loadMyProfile } = h.load('utils/my-profile');
  const a = loadMyProfile(),
    b = loadMyProfile();
  assert.equal(a, b);
  assert.equal(h.calls.length, 1);
  finish({ user: { nickName: '玩家', avatarUrl: 'first' } });
  await a;
  await loadMyProfile();
  assert.equal(h.calls.length, 1);
  const c = loadMyProfile(true);
  assert.equal(h.calls.length, 2);
  finish({ user: { nickName: '玩家', avatarUrl: 'new' } });
  await c;
  assert.equal(h.store.user.avatarUrl, 'new');
  const mine = h.page('pages/mine/mine');
  assert.equal(mine.state.user.avatarUrl, 'new');
});
test('profile saved during startup wins over a late response; failed requests can retry', async () => {
  let finish;
  const h = harness({
    callTeam: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const { loadMyProfile } = h.load('utils/my-profile');
  const pending = loadMyProfile();
  h.store.user = { nickName: '刚保存', avatarUrl: 'saved' };
  finish({ user: { nickName: '旧资料', avatarUrl: 'old' } });
  assert.equal((await pending).user.avatarUrl, 'saved');
  let attempts = 0;
  const f = harness({
    callTeam: async () => {
      if (!attempts++) throw new Error('offline');
      return { user: { nickName: '重试' } };
    },
  });
  const load = f.load('utils/my-profile').loadMyProfile;
  await assert.rejects(load());
  assert.equal((await load()).user.nickName, '重试');
});
test('avatar keeps its bitmap during replacement, ignores stale loads and retains old image on error', async () => {
  const avatar = harness().page('components/app-avatar/index', {
    identity: 'self',
    src: 'first',
    fileId: 'a',
  });
  const props = avatar.bindings.props;
  const first = avatar.view.layers[0].token;
  avatar.loaded(first);
  props.src = 'new-signed-url';
  await nextTick();
  assert.equal(avatar.view.layers.length, 1, 'same cloud file does not trigger another image load');
  props.fileId = 'b';
  props.src = 'second';
  await nextTick();
  const second = avatar.view.layers[1].token;
  assert.equal(avatar.view.activeToken, first);
  props.fileId = 'c';
  props.src = 'third';
  await nextTick();
  const third = avatar.view.layers[1].token;
  avatar.loaded(second);
  assert.equal(avatar.view.activeToken, first);
  avatar.failed(third);
  assert.equal(avatar.view.activeToken, first);
  props.fileId = 'd';
  props.src = 'fourth';
  await nextTick();
  avatar.loaded(avatar.view.layers[1].token);
  assert.notEqual(avatar.view.activeToken, first);
  props.identity = 'other-user';
  props.src = 'other';
  await nextTick();
  assert.equal(avatar.view.activeToken, 0, 'never display the prior user while a new owner loads');
  assert.equal(avatar.view.layers.length, 1);
});
test('group names normalize consistently and filters distinguish legacy teams and reserved-looking labels', () => {
  const h = harness();
  const { normalizeSourceGroup, matchSourceGroup, sourceGroupOptions } = h.load('utils/source-group');
  const { buildLobbyView } = h.load('utils/lobby');
  const list = [
    { _id: 'a', sourceGroup: '  Ａ群  ' },
    { _id: 'b' },
    { _id: 'c', sourceGroup: '__ungrouped__' },
  ];
  assert.equal(normalizeSourceGroup('  Ａ群  '), 'A群');
  assert.equal(matchSourceGroup(list[1], '__ungrouped__'), true);
  assert.equal(matchSourceGroup(list[2], 'group:__ungrouped__'), true);
  assert.deepEqual(
    buildLobbyView(list, { sourceGroup: 'group:A群' }).map((t) => t._id),
    ['a'],
  );
  assert.equal(sourceGroupOptions(list).length, 4);
  assert.equal(buildLobbyView(list, { keyword: 'Ａ群' }).length, 1);
});
test('editing and republishing preserve source group and publish validates its length', () => {
  const h = harness(),
    page = h.page('pages/publish/publish');
  page.applyDraft({ gameName: 'CS2', platform: 'Steam', capacity: 5, sourceGroup: '  Ａ群  ' });
  assert.equal(page.buildTeam().sourceGroup, 'A群');
  const { validatePublishTeam } = h.load('utils/publish-form');
  assert.equal(
    validatePublishTeam({ ...page.buildTeam(), sourceGroup: '长'.repeat(25) }, {}).anchor,
    'field-source-group',
  );
  const detail = h.page('pages/team/detail');
  detail.state.team = { _id: 't', gameName: 'CS2', sourceGroup: 'A群' };
  detail.onRepublish();
  assert.equal(h.store.republishTeam.sourceGroup, 'A群');
});
test('reaction mutations block double taps, cancel the current choice, and retain state after failure', async () => {
  let finish, reject;
  const h = harness({
    callTeam: () =>
      new Promise((resolve, fail) => {
        finish = resolve;
        reject = fail;
      }),
  });
  const page = h.page('pages/team/detail');
  page.state.teamId = 't';
  page.state.team = { _id: 't' };
  page.state.loading = false;
  const pending = page.onReact('like');
  await page.onReact('fire');
  assert.equal(h.calls.length, 1);
  const summary = { counts: { like: 1, fire: 0, laugh: 0, love: 0, watch: 0, game: 0 }, mine: 'like' };
  finish({ reactions: summary });
  await pending;
  const cancel = page.onReact('like');
  assert.equal(h.calls[1].input.reaction, '');
  reject(new Error('offline'));
  await cancel;
  assert.equal(page.state.reactions.mine, 'like');
  assert.equal(page.state.reactions.counts.like, 1);
  assert.equal(page.state.reacting, false);
  const changed = page.onReact('fire');
  page.state.teamId = 'other';
  finish({ reactions: { ...summary, mine: 'fire' } });
  await changed;
  assert.equal(page.state.reactions.mine, 'like', 'late response cannot affect a different team');
});

test('saved profile invalidates bootstrap cache and appears while the team list is still pending', async () => {
  let current = { nickName: '旧资料' };
  let finishTeams;
  const h = harness({
    callTeam: async (action) =>
      action === 'myTeams'
        ? new Promise((resolve) => {
            finishTeams = resolve;
          })
        : { user: current },
  });
  const { loadMyProfile } = h.load('utils/my-profile');
  await loadMyProfile();
  const mine = h.page('pages/mine/mine');
  const loading = mine.load();
  current = { nickName: '刚保存' };
  h.store.user = current;
  await loadMyProfile();
  await nextTick();
  // The real Pinia store is reactive; harness state is intentionally plain.
  assert.equal(h.calls.filter((call) => call.action === 'getProfile').length, 2);
  finishTeams({ hosted: [], joined: [] });
  await loading;
  assert.equal(h.store.user.nickName, '刚保存');
});
test('group filter retains its label when a refresh no longer contains that group', () => {
  const { sourceGroupOptions } = harness().load('utils/source-group');
  const options = sourceGroupOptions([], 'group:周末群');
  assert.equal(options.find((item) => item.value === 'group:周末群').label, '周末群');
});

test('real Vue proxies reuse bootstrap cache and update mine before its team list resolves', async () => {
  const { reactive } = require('../node_modules/vue');
  const store = reactive({ user: null, isAdmin: false, isOrganizer: false });
  let finish;
  const h = harness({
    overrides: { 'stores/app': { useAppStore: () => store } },
    callTeam: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const mine = h.page('pages/mine/mine');
  const load = h.load('utils/my-profile').loadMyProfile;
  const pending = load();
  finish({ user: { nickName: '启动完成', avatarUrl: 'cached' } });
  await pending;
  await nextTick();
  assert.equal(mine.state.user.avatarUrl, 'cached');
  await load();
  assert.equal(h.calls.length, 1, 'proxy identity must not bypass the cache');
});
