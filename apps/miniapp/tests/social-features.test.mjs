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
test('team publishing no longer assigns user group membership to a team', () => {
  const h = harness();
  const page = h.page('pages/publish/publish');
  page.applyDraft({ gameName: 'CS2', platform: 'Steam', capacity: 5, sourceGroup: '旧来源群' });
  assert.equal('sourceGroup' in page.buildTeam(), false);
  const detail = h.page('pages/team/detail');
  detail.state.team = { _id: 't', gameName: 'CS2', sourceGroup: '旧来源群' };
  detail.onRepublish();
  assert.equal('sourceGroup' in h.store.republishTeam, false);
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

test('every pair of visible reactions switches exclusively and updates both counters immediately', () => {
  const { REACTIONS, toggleReaction } = harness().load('utils/reactions');
  for (const from of REACTIONS) {
    for (const to of REACTIONS) {
      const result = toggleReaction(
        { counts: { [from.id]: 2, [to.id]: from.id === to.id ? 2 : 3 }, selected: [from.id], mine: from.id },
        to.id,
      );
      assert.deepEqual(result.summary.selected, from.id === to.id ? [] : [to.id]);
      assert.equal(result.summary.counts[from.id], 1);
      if (from.id !== to.id) assert.equal(result.summary.counts[to.id], 4);
    }
  }
});
