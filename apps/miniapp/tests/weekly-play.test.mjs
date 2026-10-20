import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { harness } = require('../../../tests/support/miniapp.cjs');
const flush = () => new Promise((resolve) => setImmediate(resolve));
const activity = () => ({
  weekId: '2026-10-23',
  startAt: Math.floor(Date.now() / 60000) * 60000 + 7200000,
  drawAt: Date.now() - 1000,
  endAt: Date.now() + 14400000,
  serverNow: Date.now(),
  mine: '',
  totalVotes: 1,
  votingClosed: true,
  selectedGame: { id: 'cs2', name: 'CS2', platform: 'Steam' },
  games: [{ id: 'cs2', name: 'CS2', platform: 'Steam', votes: 1 }],
});
test('weekly publish carries the chosen game and fixed time into the real form', async () => {
  const h = harness({
    callTeam: async (action) =>
      action === 'getWeeklyPlay' ? { activity: activity() } : { isOrganizer: false },
  });
  const page = h.page('pages/friday/friday');
  await page.hooks.onShow();
  await flush();
  const weekly = page.bindings.page;
  await weekly.load();
  weekly.publish();
  assert.equal(h.store.prefillGame.weeklyId, '2026-10-23');
  const startAt = h.store.prefillGame.startAt;
  const publish = h.page('pages/publish/publish');
  await publish.hooks.onShow();
  const payload = publish.buildTeam();
  assert.equal(payload.weeklyId, '2026-10-23');
  assert.equal(payload.startAt, Math.floor(startAt / 60000) * 60000);
  assert.ok(publish.state.timeSummaryLine1.includes(publish.state.startTime));
  assert.ok(
    publish.state.timeSummaryLine2.includes(publish.state.endTime) ||
      publish.state.timeSummaryLine1.includes(publish.state.endTime),
  );
  publish.state.gameName = '三角洲行动';
  assert.equal(publish.buildTeam().weeklyId, undefined);
  page.hooks.onHide();
});
test('recruitment text includes timing and seats but never room number or password', () => {
  const { recruitmentText } = harness().load('utils/recruitment');
  const text = recruitmentText({
    gameName: 'CS2',
    startAt: Date.now() + 10000,
    endAt: Date.now() + 3600000,
    capacity: 5,
    memberCount: 1,
    status: 'recruiting',
    roomNo: 'private-room',
    roomPwd: 'secret',
    platform: 'Steam',
    timeText: '今晚 21:00',
  });
  assert.match(text, /还缺 4 人/);
  assert.match(text, /今晚 21:00/);
  assert.ok(!text.includes('private-room'));
  assert.ok(!text.includes('secret'));
});

test('Friday activity can still recruit after 21:00, but not after its end', async () => {
  const current = activity();
  current.serverNow = current.startAt + 1800000;
  const h = harness({
    callTeam: async (action) => (action === 'getWeeklyPlay' ? { activity: current } : { list: [], total: 0 }),
  });
  const page = h.page('pages/friday/friday').bindings.page;
  await page.load();
  assert.equal(page.canPublish.value, true);
  current.serverNow = current.endAt;
  await page.load();
  assert.equal(page.canPublish.value, false);
});

test('new vote and Friday pages retain timeline preview without fetching business data', () => {
  for (const route of ['pages/play/play', 'pages/friday/friday']) {
    const h = harness({ launch: { scene: 1154 } });
    h.page(route).hooks.onShow();
    assert.equal(h.calls.length, 0);
  }
});
