import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { harness } = require('../../../tests/support/miniapp.cjs');
const flush = () => new Promise((resolve) => setImmediate(resolve));
const future = {
  _id: 'hosted',
  gameName: 'CS2',
  platform: 'Steam',
  memberCount: 1,
  capacity: 5,
  startAt: Date.now() + 3600000,
  endAt: Date.now() + 7200000,
  displayStatus: 'recruiting',
};
function fixture() {
  return harness({
    callTeam: async (action) =>
      action === 'getProfile'
        ? { user: { nickName: '玩家' } }
        : {
            hosted: [future],
            joined: [
              future,
              { ...future, _id: 'joined' },
              { ...future, _id: 'past', displayStatus: 'ended' },
            ],
          },
  });
}

test('profile hub counts ongoing teams once and its three entries open the matching records filter', async () => {
  const h = fixture();
  const page = h.page('pages/mine/mine');
  assert.equal(page.state.teamsLoaded, false);
  await page.load();
  assert.equal(page.state.teamsLoaded, true);
  assert.equal(page.view.ongoingCount, 2);
  assert.equal(page.state.hostedCount, 1);
  assert.equal(page.state.joinedCount, 3);
  for (const tab of ['hosted', 'joined', 'all']) page.openMyTeams(tab);
  assert.deepEqual(
    h.navigation,
    ['hosted', 'joined', 'all'].map((tab) => `/pages/mine/teams?tab=${tab}&phase=Ongoing`),
  );
  page.openSettings();
  assert.equal(h.navigation.at(-1), '/pages/mine/settings');
});

test('records deep links select the requested tab, deduplicate all teams and retain visited lists', async () => {
  const h = fixture();
  const page = h.page('pages/mine/teams');
  page.hooks.onLoad({ tab: 'all', phase: 'Ongoing' });
  await page.load();
  assert.deepEqual(
    page.bindings.visibleTeams.value.map((team) => team._id),
    ['hosted', 'joined'],
  );
  assert.equal(page.bindings.hostedIds.value.has('hosted'), true);
  assert.equal(page.bindings.hostedIds.value.has('joined'), false);
  page.pickPhase('Past');
  await flush();
  assert.deepEqual(
    page.bindings.visibleTeams.value.map((team) => team._id),
    ['past'],
  );
  page.pickPhase('Ongoing');
  await flush();
  assert.equal(page.bindings.visitedLists['all-Ongoing'], true);
  assert.equal(page.bindings.visitedLists['all-Past'], true);
  page.hooks.onLoad({ tab: 'joined', phase: 'Past' });
  assert.equal(page.bindings.tab.value, 'joined');
  assert.equal(page.state.phase, 'Past');
  page.hooks.onLoad({ tab: 'unexpected', phase: 'unexpected' });
  assert.equal(page.bindings.tab.value, 'hosted');
  assert.equal(page.state.phase, 'Ongoing');
});

test('failed team loading keeps summary counts unavailable and retry recovers', async () => {
  let fails = true;
  const h = harness({
    callTeam: async (action) => {
      if (action === 'getProfile') return { user: { nickName: '玩家' } };
      if (fails) throw new Error('offline');
      return { hosted: [future], joined: [] };
    },
  });
  const page = h.page('pages/mine/mine');
  await page.load();
  assert.equal(page.state.teamsLoaded, false);
  assert.ok(page.state.listError);
  fails = false;
  await page.load();
  assert.equal(page.state.teamsLoaded, true);
  assert.equal(page.view.ongoingCount, 1);
});

test('settings legal entries use existing document routes and profile editor closes on page hide', () => {
  const h = harness();
  const page = h.page('pages/mine/settings');
  for (const type of ['agreement', 'privacy', 'community']) page.openLegal(type);
  assert.deepEqual(
    h.navigation,
    ['agreement', 'privacy', 'community'].map((type) => `/pages/legal/legal?type=${type}`),
  );
  page.view.showProfile = true;
  page.hooks.onHide();
  assert.equal(page.view.showProfile, false);
});
