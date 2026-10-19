import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { harness } = require('../../../tests/support/miniapp.cjs');
const flush = () => new Promise((resolve) => setImmediate(resolve));
const futureTeam = (patch = {}) => ({
  _id: 't',
  gameName: 'CS2',
  platform: 'Steam',
  capacity: 5,
  memberCount: 2,
  startAt: Date.now() + 600000,
  endAt: Date.now() + 3600000,
  status: 'recruiting',
  roomNo: '123',
  ...patch,
});

test('returning to the lobby retains loaded teams until the refresh finishes', async () => {
  let refresh;
  let requests = 0;
  const h = harness({
    callTeam: (action) => {
      if (action !== 'listTeams') return { hosted: [], joined: [] };
      if (++requests === 1) return { list: [futureTeam({ _id: 'old' })], total: 1 };
      return new Promise((resolve) => {
        refresh = resolve;
      });
    },
  });
  const page = h.page('pages/index/index');
  await page.loadList();
  page.hooks.onShow();
  assert.equal(page.state.loading, true);
  assert.equal(page.state.filtered[0]._id, 'old');
  refresh({ list: [futureTeam({ _id: 'new' })], total: 1 });
  await flush();
  assert.equal(page.state.filtered[0]._id, 'new');
  page.state.keyword = 'different';
  page.hooks.onShow();
  assert.equal(page.state.filtered.length, 0, 'changed queries never retain mismatching results');
  refresh({ list: [], total: 0 });
  await flush();
});

test('publish and mine reuse the startup profile request while their pages remain usable', async () => {
  let finish;
  const h = harness({
    callTeam: (action) =>
      action === 'getProfile'
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : { hosted: [], joined: [] },
  });
  const bootstrap = h.load('utils/my-profile').loadMyProfile();
  const publish = h.page('pages/publish/publish');
  const showing = publish.hooks.onShow();
  publish.onRoomNo('ready-before-profile');
  assert.equal(publish.state.roomNo, 'ready-before-profile');
  finish({ user: { nickName: '玩家' }, isOrganizer: true });
  await Promise.all([bootstrap, showing]);
  await h.page('pages/mine/mine').load();
  assert.equal(publish.state.canProxy, true);
  assert.equal(h.calls.filter((call) => call.action === 'getProfile').length, 1);
});

test('fresh welcome hides native tabs until dismissal finishes, but returning users do not hide them', () => {
  let hidden = 0,
    shown = 0;
  const h = harness({ platform: { hideTabBar: () => hidden++, showTabBar: () => shown++ } });
  const welcome = h.page('components/welcome-letter/index');
  welcome.hooks.mounted();
  assert.equal(hidden, 1);
  welcome.dismiss();
  assert.equal(shown, 0, 'native tabs must not appear through the closing mask');
  welcome.afterLeave();
  assert.equal(shown, 1);
  h.page('components/welcome-letter/index').hooks.mounted();
  assert.equal(hidden, 1, 'an already-read welcome never hides native tabs');
});

test('filter changes query the server and discard an older response arriving last', async () => {
  const pending = [];
  const h = harness({
    callTeam: (action, input) => new Promise((resolve) => pending.push({ input, resolve })),
  });
  const page = h.page('pages/index/index');
  const first = page.loadList();
  page.setFilters({ platform: '手游', sourceGroup: 'group:A群', time: 'soon' });
  assert.equal(pending[1].input.platform, '手游');
  assert.equal(pending[1].input.offset, 0);
  pending[1].resolve({ list: [futureTeam({ _id: 'new' })], total: 1, hasMore: false });
  await flush();
  pending[0].resolve({ list: [futureTeam({ _id: 'old' })], total: 99, hasMore: true });
  await first;
  assert.equal(page.state.filtered[0]._id, 'new');
  assert.equal(page.state.total, 1);
  assert.equal(page.state.loading, false);
});

test('search debounce invalidates a pending old response before dispatching the next request', async () => {
  let resolve;
  const h = harness({
    callTeam: () =>
      new Promise((done) => {
        resolve = done;
      }),
  });
  const page = h.page('pages/index/index');
  const loading = page.loadList();
  page.onSearch('no-match');
  resolve({ list: [futureTeam()], total: 1 });
  await loading;
  assert.equal(page.state.filtered.length, 0);
  assert.equal(page.state.loading, true);
  page.cancelSearch();
});

test('game pages pass aliases to the same global search and preserve the game when filters reset', async () => {
  const h = harness();
  const page = h.page('pages/game/game');
  page.applyGame({ game: 'cs2' });
  await page.loadList();
  assert.ok(h.calls[0].input.gameNames.includes('csgo'));
  page.clearFilters();
  assert.ok(h.calls.at(-1).input.gameNames.includes('CS2'));
  page.goPublish();
  assert.equal(h.store.prefillGame.name, 'CS2');
});

test('schedule overlaps are advisory but canceling never writes a join or publication', async () => {
  const h = harness({
    dialog: {
      confirm: async () => {
        throw new Error('cancel');
      },
    },
    callTeam: async () => ({ hosted: [futureTeam({ _id: 'another' })], joined: [] }),
  });
  const detail = h.page('pages/team/detail');
  detail.state.team = futureTeam();
  detail.state.teamId = 't';
  await detail.onJoin();
  assert.ok(!h.calls.some((call) => call.action === 'joinTeam'));
  assert.equal(detail.state.joining, false);
  const publish = h.page('pages/publish/publish');
  Object.assign(publish.state, { gameName: 'CS2', roomNo: '123' });
  // Use the same times as the conflicting team rather than the rounded default start.
  const parts = h.load('utils/format').dateParts;
  const conflict = futureTeam();
  Object.assign(publish.state, {
    startDate: parts(conflict.startAt).date,
    startTime: parts(conflict.startAt).time,
    endDate: parts(conflict.endAt).date,
    endTime: parts(conflict.endAt).time,
  });
  await publish.onSubmit();
  assert.ok(!h.calls.some((call) => call.action === 'createTeam'));
  assert.equal(publish.state.submitting, false);
});

test('update notice is visible once; optional analytics failure does not discard the team', async () => {
  const h = harness({
    callTeam: async (action) => {
      if (action === 'trackTeamEvent') throw new Error('analytics unavailable');
      return {
        team: futureTeam({ detailsChangedAt: 100, changedFields: ['server', 'roomPwd'] }),
        role: 'member',
        members: [],
      };
    },
  });
  const page = h.page('pages/team/detail');
  page.state.teamId = 't';
  await page.loadDetail();
  assert.match(page.state.changeNotice, /区服、密码/);
  assert.ok(page.state.team);
  await page.loadDetail();
  assert.equal(page.state.changeNotice, '');
  assert.equal(h.calls.filter((call) => call.action === 'trackTeamEvent').length, 1);
});

test('upcoming entry prefers the nearest future game and excludes terminal teams', () => {
  const { scheduledTeams } = harness().load('utils/team-schedule');
  const now = Date.now();
  const list = scheduledTeams(
    [
      futureTeam({ _id: 'past', startAt: now - 5000 }),
      futureTeam({ _id: 'next' }),
      futureTeam({ _id: 'cancelled', status: 'cancelled' }),
      futureTeam({ _id: 'expired', endAt: now - 1 }),
    ],
    now,
  );
  assert.deepEqual(
    list.map((t) => t._id),
    ['next', 'past'],
  );
});

test('recent games include free text and a game-prefilled publish clears prior edit identity', async () => {
  const h = harness();
  h.load('utils/recent-games').rememberGame('我的自定义游戏');
  const page = h.page('pages/publish/publish');
  page.pickSuggestedGame('我的自定义游戏');
  assert.equal(page.state.gameName, '我的自定义游戏');
  page.state.editingId = 'old';
  h.store.prefillGame = { name: 'CS2', platform: 'Steam' };
  await page.hooks.onShow();
  assert.equal(page.state.editingId, '');
  assert.equal(page.state.gameName, 'CS2');
});

test('native tabs remain visible on normal page entry', async () => {
  for (const route of ['index/index', 'publish/publish', 'mine/mine']) {
    let hidden = 0;
    const h = harness({ platform: { hideTabBar: () => hidden++ } });
    const page = h.page('pages/' + route);
    await page.hooks.onShow();
    assert.equal(hidden, 0, route + ' must not hide native tabs');
  }
});

test('closing the last overlay restores the native tab bar', () => {
  let shown = 0;
  const h = harness({ platform: { showTabBar: () => shown++ } });
  const overlay = h.load('composables/useTabBarOverlay');
  const sheet = h.page('components/team-manage-sheet/index', { show: true });
  assert.equal(overlay.tabBarObscured.value, true);
  sheet.bindings.props.show = false;
  sheet.afterLeave();
  assert.equal(overlay.tabBarObscured.value, false);
  assert.equal(shown, 1);
});

test('cached pages show their portal chrome even when onShow precedes the route-stack update', async (t) => {
  const previous = globalThis.getCurrentPages;
  globalThis.getCurrentPages = () => [{ route: 'pages/team/detail' }];
  t.after(() => {
    if (previous) globalThis.getCurrentPages = previous;
    else delete globalThis.getCurrentPages;
  });
  const page = harness().page('pages/index/index');
  assert.equal(page.bindings.pageActive.value, false, 'a cached page starts inactive during remount');
  await page.hooks.onShow();
  assert.equal(page.bindings.pageActive.value, true, 'onShow itself is authoritative');
  page.hooks.onHide();
  assert.equal(page.bindings.pageActive.value, false);
  await page.hooks.onShow();
  assert.equal(page.bindings.pageActive.value, true, 'returning to the cached tab restores navigation');
});
