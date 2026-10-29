import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { harness } = require('../../../tests/support/miniapp.cjs');
const legacyUser = {
  _id: 'legacy',
  nickName: '老玩家',
  bio: 123,
  avatarUrl: {},
  steamFriendCode: 12345,
  wechatId: false,
  groupIds: null,
  favoriteGames: { old: true },
  playTimes: null,
};

test('mine mounts with malformed cached profile and recovers after a fresh profile', async () => {
  const h = harness({
    store: { user: legacyUser },
    callTeam: async (action) =>
      action === 'getProfile'
        ? { user: { nickName: '老玩家', bio: '一起玩', groupIds: ['underground-gaming'] } }
        : { hosted: [], joined: [] },
  });
  const page = h.page('pages/mine/mine');
  assert.ok(page.view.profileHint);
  assert.equal(page.view.user.nickName, '老玩家');
  assert.equal(page.view.user.avatarUrl, '');
  await page.load(true);
  assert.equal(page.view.profileHint, '一起玩');
  assert.equal(page.state.teamsLoaded, true);
});

test('profile fetched with malformed fields stays viewable and editable', async () => {
  const h = harness({
    callTeam: async (action, input) =>
      action === 'getProfile'
        ? { user: legacyUser }
        : action === 'saveProfile'
          ? { user: input }
          : { hosted: [], joined: [] },
  });
  const page = h.page('pages/mine/mine');
  await page.load();
  assert.equal(page.state.profileError, '');
  const editor = h.page('components/profile-gate/index', { show: true });
  assert.deepEqual([...editor.view.groupIds], []);
  assert.deepEqual([...editor.view.favoriteGames], []);
  assert.deepEqual([...editor.view.playTimes], []);
  await editor.save();
  assert.equal(h.emitted.at(-1).name, 'done');
  assert.equal(h.calls.at(-1).input.bio, '');
});

test('profile labels tolerate null and non-array fields without matching string fragments', () => {
  const h = harness();
  const { groupLabels, playTimeLabels } = h.load('utils/profile-options');
  for (const value of [null, {}, 1, true, 'underground-gaming']) {
    assert.deepEqual(groupLabels(value), []);
    assert.deepEqual(playTimeLabels(value), []);
  }
  const tags = h.page('components/profile-tags/index', { user: legacyUser });
  assert.deepEqual(tags.view.groups, []);
  assert.deepEqual(tags.view.times, []);
});

test('mixed legacy lists keep valid values and leave the stored profile untouched', () => {
  const h = harness();
  const { profileForView } = h.load('utils/profile-data');
  const original = {
    _id: 'player',
    bio: '  一起开黑  ',
    steamFriendCode: '00123456',
    groupIds: ['underground-gaming', null, 123, {}],
    favoriteGames: ['CS2', false, '', '  '],
    playTimes: ['weekend', null],
  };
  const snapshot = JSON.parse(JSON.stringify(original));
  const user = profileForView(original);
  assert.equal(user._id, 'player');
  assert.equal(user.bio, original.bio);
  assert.equal(user.steamFriendCode, '00123456');
  assert.deepEqual(user.groupIds, ['underground-gaming']);
  assert.deepEqual(user.favoriteGames, ['CS2']);
  assert.deepEqual(user.playTimes, ['weekend']);
  assert.deepEqual(original, snapshot);
});
