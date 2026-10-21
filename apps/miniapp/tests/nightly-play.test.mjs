import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { harness } = require('../../../tests/support/miniapp.cjs');
test('ranking page fetches both top tens and switches modes without the daily API', async () => {
  const hosted = [{ userKey: 'a', nickName: 'A', avatarUrl: '', count: 10 }];
  const joined = [{ userKey: 'b', nickName: 'B', avatarUrl: '', count: 9 }];
  const h = harness({ callTeam: async () => ({ hosted, joined, generatedAt: Date.now() }) });
  const rendered = h.page('pages/friday/friday');
  const page = rendered.bindings.page;
  await page.load();
  assert.equal(h.calls[0].action, 'getUserRankings');
  assert.equal(page.rows.value[0].nickName, 'A');
  page.mode.value = 'joined';
  assert.equal(page.rows.value[0].nickName, 'B');
  assert.equal(h.calls.length, 1);
  const payload = rendered.hooks.onShareAppMessage({ from: 'menu' });
  assert.match(payload.title, /前十名/);
});
test('daily and ranking pages retain timeline preview without fetching business data', () => {
  for (const route of ['pages/play/play', 'pages/friday/friday']) {
    const h = harness({ launch: { scene: 1154 } });
    h.page(route).hooks.onShow();
    assert.equal(h.calls.length, 0);
  }
});
test('daily car opens an independent claim page, confirmed car opens detail', async () => {
  const board = {
    dayId: '2026-10-20',
    serverNow: Date.now(),
    settleAt: Date.now() - 1000,
    startAt: Date.now() + 3600000,
    endAt: Date.now() + 10800000,
    votingClosed: true,
    teamId: 'night_test',
    team: { pendingHost: true, gameName: 'CS2', platform: 'Steam', capacity: 6 },
    options: [],
  };
  const h = harness({ callTeam: async () => ({ board }) });
  const page = h.page('pages/play/play').bindings.page;
  await page.load();
  page.depart();
  assert.equal(h.store.prefillGame, undefined);
  assert.ok(h.navigation.includes('/pages/publish/claim?teamId=night_test'));
  page.state.board.team.pendingHost = false;
  page.depart();
  assert.ok(h.navigation.includes('/pages/team/detail?teamId=night_test'));
});
test('pending detail redirects to publish instead of creating a passenger', async () => {
  const h = harness();
  const page = h.page('pages/team/detail');
  page.state.teamId = 'night_test';
  page.state.team = {
    pendingHost: true,
    gameName: 'CS2',
    platform: 'Steam',
    startAt: Date.now() + 3600000,
    endAt: Date.now() + 10800000,
    capacity: 6,
  };
  await page.onJoin();
  assert.equal(h.store.prefillGame, undefined);
  assert.ok(h.navigation.includes('/pages/publish/claim?teamId=night_test'));
  assert.equal(h.calls.filter((call) => call.action === 'joinTeam').length, 0);
});
const claimTeam = () => {
  const startAt = Math.floor(Date.now() / 60000) * 60000 + 3600000;
  return {
    _id: 'night_test',
    gameName: 'CS2',
    platform: 'Steam',
    startAt,
    endAt: startAt + 7200000,
    capacity: 6,
    pendingHost: true,
    dailyNightId: 'test',
  };
};
test('independent claim form fetches the authoritative car and leaves ordinary publishing untouched', async () => {
  const team = claimTeam();
  const h = harness({
    callTeam: async (action) =>
      action === 'getTeam'
        ? { team }
        : action === 'createTeam'
          ? { teamId: 'night_test' }
          : action === 'myTeams'
            ? { hosted: [], joined: [] }
            : { isOrganizer: false },
  });
  const ordinary = h.page('pages/publish/publish');
  ordinary.onGameName('自己的游戏');
  ordinary.onRoomNo('自己的联系方式');
  await ordinary.hooks.onHide();
  const draft = h.storage.get('publish-draft-v2');
  const page = h.page('pages/publish/claim');
  page.hooks.onLoad({ teamId: 'night_test' });
  await page.hooks.onShow();
  assert.equal(page.state.capacity, 6);
  assert.equal(page.state.roomNo, '');
  assert.equal(page.buildTeam().startAt, team.startAt);
  await page.onSubmit();
  assert.equal(h.calls.filter((call) => call.action === 'createTeam').length, 0);
  await page.hooks.onHide();
  await page.hooks.onUnload();
  assert.deepEqual(h.storage.get('publish-draft-v2'), draft);
  await ordinary.hooks.onShow();
  assert.equal(ordinary.state.claimTeamId, '');
  assert.equal(ordinary.state.gameName, '自己的游戏');
  page.onRoomNo('Steam好友码123');
  await page.onSubmit();
  const request = h.calls.find((call) => call.action === 'createTeam');
  assert.equal(request.input.claimTeamId, 'night_test');
  assert.equal(request.input.team.capacity, 6);
  assert.equal(request.input.team.endAt, team.endAt);
});
test('losing a concurrent claim exits the independent claim page for team details', async () => {
  const h = harness({
    callTeam: async (action) => {
      if (action === 'getTeam') return { team: claimTeam() };
      if (action === 'createTeam') {
        const error = new Error('已有玩家完成发车');
        error.code = 'CLAIM_TAKEN';
        throw error;
      }
      return action === 'myTeams' ? { hosted: [], joined: [] } : { isOrganizer: false };
    },
  });
  const page = h.page('pages/publish/claim');
  page.hooks.onLoad({ teamId: 'night_test' });
  await page.hooks.onShow();
  page.onRoomNo('Steam好友码123');
  await page.onSubmit();
  assert.equal(page.state.claimTeamId, '');
  assert.ok(h.navigation.some((url) => url.includes('/pages/team/detail?') && url.includes('night_test')));
  assert.ok(h.toasts.includes('已有玩家完成发车，前往队伍详情上车'));
});
test('already claimed or missing official car never exposes a stale claim form', async () => {
  for (const missing of [true, false]) {
    const h = harness({
      callTeam: async () => {
        if (missing) throw new Error('队伍不存在');
        return { team: { ...claimTeam(), pendingHost: false } };
      },
    });
    const page = h.page('pages/publish/claim');
    page.hooks.onLoad({ teamId: 'night_test' });
    await page.hooks.onShow();
    assert.equal(page.state.claimTeamId, '');
    if (missing) assert.equal(page.state.editLoadError, '队伍不存在');
    else assert.ok(h.navigation.some((url) => url.includes('night_test')));
  }
});

test('leaving the claim page while it loads prevents late navigation and keeps the publish tab clean', async () => {
  let finish;
  const h = harness({
    callTeam: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const page = h.page('pages/publish/claim');
  page.hooks.onLoad({ teamId: 'night_test' });
  const loading = page.hooks.onShow();
  page.hooks.onUnload();
  finish({ team: { ...claimTeam(), pendingHost: false } });
  await loading;
  assert.equal(h.navigation.length, 0);
  assert.equal(h.store.prefillGame, undefined);
  assert.equal(page.state.claimTeamId, '');
});

test('ranking users open the shared public profile without exposing account fields', async () => {
  const h = harness({ callTeam: async () => ({ hosted: [], joined: [] }) });
  const page = h.page('pages/friday/friday').bindings.page;
  page.openProfile(undefined);
  assert.equal(page.profile.value, null);
  page.openProfile({
    userKey: 'public-key',
    nickName: '搭子',
    avatarUrl: '/avatar.png',
    bio: '今晚一起玩',
    count: 8,
    openid: 'private-id',
  });
  assert.equal(page.profile.value.nickName, '搭子');
  assert.equal(page.profile.value.bio, '今晚一起玩');
  assert.equal(page.profile.value.openid, undefined);
  assert.equal(page.profile.value.userKey, undefined);
});
