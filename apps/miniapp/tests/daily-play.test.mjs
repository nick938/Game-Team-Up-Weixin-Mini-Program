import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { harness } = require('../../../tests/support/miniapp.cjs');
const board = () => ({
  dayId: new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10),
  serverNow: Date.now(),
  settleAt: Date.now() + 600000,
  startAt: Date.now() + 3600000,
  endAt: Date.now() + 10800000,
  votingClosed: false,
  winnerId: '',
  teamId: '',
  team: null,
  options: [],
});
const option = () => ({
  id: 'choice-1',
  gameName: '饥荒联机版',
  platform: 'Steam',
  votes: 2,
  mine: false,
  createdAt: 1,
});
test('multiple game proposals contain no schedule fields and retain distinct retry keys', async () => {
  const h = harness({ callTeam: async () => ({ board: board() }) });
  const page = h.page('pages/play/play').bindings.page;
  page.showEditor.value = true;
  page.form.gameName = '饥荒联机版';
  await page.create();
  page.form.gameName = '双人成行';
  await page.create();
  const requests = h.calls.filter((c) => c.action === 'createPlayOption').map((c) => c.input);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].gameName, '饥荒联机版');
  assert.equal(requests[1].gameName, '双人成行');
  assert.equal(requests[0].platform, 'Steam');
  assert.equal(requests[0].startAt, undefined);
  assert.equal(requests[0].endAt, undefined);
  assert.notEqual(requests[0].requestId, requests[1].requestId);
  assert.equal(page.form.gameName, '');
  assert.equal(page.showEditor.value, false);
});
test('network failure keeps draft and retry key without reporting success', async () => {
  const h = harness({
    callTeam: async () => {
      throw new Error('网络失败');
    },
  });
  const page = h.page('pages/play/play').bindings.page;
  page.showEditor.value = true;
  page.form.gameName = '饥荒联机版';
  await page.create();
  await page.create();
  assert.equal(page.showEditor.value, true);
  assert.equal(h.calls[0].input.requestId, h.calls[1].input.requestId);
  assert.equal(page.form.gameName, '饥荒联机版');
  assert.equal(page.state.busy, false);
  assert.deepEqual(h.toasts, ['网络失败', '网络失败']);
});
test('failed vote preserves counts; successful voting only changes intent and never navigates to a team', async () => {
  const current = { ...board(), options: [option()] };
  let fail = true;
  const h = harness({
    callTeam: async (action) => {
      if (action === 'getDailyPlay') return { board: current };
      if (fail) throw new Error('网络失败');
      return { board: { ...current, options: [{ ...option(), mine: true, votes: 3 }] } };
    },
  });
  const page = h.page('pages/play/play').bindings.page;
  await page.load();
  await page.vote(option());
  assert.equal(page.state.board.options[0].votes, 2);
  fail = false;
  await page.vote(option());
  assert.equal(page.state.board.options[0].votes, 3);
  assert.equal(h.navigation.length, 0);
  await page.vote({ ...option(), mine: true });
  assert.equal(h.calls.at(-1).input.want, false);
});
test('podium sorts by score then proposal time; stale boards cannot write', async () => {
  const current = {
    ...board(),
    options: [
      { ...option(), id: 'z', votes: 1, createdAt: 1 },
      { ...option(), id: 'b', votes: 3, createdAt: 3 },
      { ...option(), id: 'a', votes: 3, createdAt: 2 },
    ],
  };
  const h = harness({ callTeam: async () => ({ board: current }) });
  const page = h.page('pages/play/play').bindings.page;
  await page.load();
  assert.deepEqual(
    Array.from(page.options.value, (o) => o.id),
    ['a', 'b', 'z'],
  );
  page.state.board.dayId = '2000-01-01';
  page.form.gameName = '新游戏';
  await page.create();
  await page.vote(option());
  assert.equal(h.calls.filter((call) => call.action !== 'getDailyPlay').length, 0);
  assert.ok(h.toasts.includes('投票日期已更新，正在刷新，请稍后重试'));
  page.open('night_2026-10-20');
  assert.ok(h.navigation.includes('/pages/team/detail?teamId=night_2026-10-20'));
});
test('missing profile resumes requested proposal after editing', async () => {
  let first = true;
  const h = harness({
    callTeam: async () => {
      if (first) {
        first = false;
        const error = new Error('请填写资料');
        error.code = 'NEED_PROFILE';
        throw error;
      }
      return { board: board() };
    },
  });
  const page = h.page('pages/play/play').bindings.page;
  page.form.gameName = '饥荒联机版';
  await page.create();
  assert.equal(page.showProfile.value, true);
  page.profileDone();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(page.showProfile.value, false);
  assert.equal(h.calls.length, 2);
  assert.equal(page.form.gameName, '');
});
test('committed creation survives board refresh outage and clears draft', async () => {
  const h = harness({ callTeam: async () => ({ board: null }) });
  const page = h.page('pages/play/play').bindings.page;
  page.form.gameName = '饥荒联机版';
  await page.create();
  assert.equal(page.form.gameName, '');
  assert.match(page.state.error, /操作已成功/);
  assert.ok(h.toasts.includes('投票已发起，已为你投一票'));
});

test('after the official selection, the live board still accepts votes and proposals', async () => {
  const current = { ...board(), settleAt: Date.now() - 3600000, settledAt: Date.now() - 3600000 };
  const h = harness({ callTeam: async () => ({ board: current }) });
  const page = h.page('pages/play/play').bindings.page;
  await page.load();
  assert.equal(page.officialReady.value, true);
  assert.equal(page.closed.value, false);
  await page.vote(option());
  page.form.gameName = '今晚再提议';
  await page.create();
  assert.ok(h.calls.some((call) => call.action === 'votePlayOption'));
  assert.ok(h.calls.some((call) => call.action === 'createPlayOption'));
});
test('player departure prefills only the chosen game, leaving schedule and capacity editable without old settings', async () => {
  const h = harness({
    callTeam: async (action) => (action === 'myTeams' ? { hosted: [], joined: [] } : { isOrganizer: false }),
  });
  const page = h.page('pages/play/play').bindings.page;
  h.store.editingTeamId = 'old';
  page.launch(option());
  assert.equal(h.store.editingTeamId, null);
  assert.equal(h.store.prefillGame.name, option().gameName);
  assert.equal(h.store.prefillGame.claimTeamId, undefined);
  assert.equal(h.store.prefillGame.startAt, undefined);
  assert.equal(h.store.prefillGame.capacity, undefined);
  h.storage.set('publish-game-v2:' + option().gameName, {
    capacity: 15,
    durationMinutes: 30,
    contact: 'old-contact',
  });
  const publish = h.page('pages/publish/publish');
  await publish.hooks.onShow();
  assert.equal(publish.state.gameName, option().gameName);
  assert.equal(publish.state.claimTeamId, '');
  assert.equal(publish.state.capacity, 4);
  assert.equal(publish.state.roomNo, '');
  publish.state.capacity = 6;
  publish.changeDuration(180);
  assert.equal(publish.buildTeam().capacity, 6);
  assert.equal(publish.buildTeam().endAt - publish.buildTeam().startAt, 10800000);
});
test('official badges distinguish random and champion cars, ordinary cars remain unlabelled', () => {
  const { officialTeamLabel } = harness().load('utils/team-source');
  assert.equal(officialTeamLabel({ dailyNightId: 'today', officialSource: 'random' }), '官方 · 随机车');
  assert.equal(officialTeamLabel({ dailyNightId: 'today', officialSource: 'champion' }), '官方 · 冠军车');
  assert.equal(officialTeamLabel({}), '');
});
