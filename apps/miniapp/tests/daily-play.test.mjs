import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { harness } = require('../../../tests/support/miniapp.cjs');
const board = () => ({ dayId: '2026-10-20', serverNow: Date.now(), options: [] });
const option = () => ({
  id: 'choice-1',
  gameName: '饥荒联机版',
  votes: 2,
  mine: false,
  teamId: '',
  joined: false,
});
test('multiple choices retain schedule and platform, with a new idempotency key per new choice', async () => {
  const h = harness({ callTeam: async () => ({ board: board() }) });
  const page = h.page('pages/play/play').bindings.page;
  page.form.gameName = '饥荒联机版';
  await page.create();
  page.form.gameName = '双人成行';
  await page.create();
  const requests = h.calls.filter((c) => c.action === 'createPlayOption').map((c) => c.input);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].gameName, '饥荒联机版');
  assert.equal(requests[1].gameName, '双人成行');
  assert.equal(requests[0].platform, 'Steam');
  assert.ok(requests[0].endAt > requests[0].startAt);
  assert.notEqual(requests[0].requestId, requests[1].requestId);
  assert.equal(page.form.gameName, '');
});
test('network failure keeps the draft and reuses its key without reporting success', async () => {
  const h = harness({
    callTeam: async () => {
      throw new Error('网络失败');
    },
  });
  const page = h.page('pages/play/play').bindings.page;
  page.form.gameName = '饥荒联机版';
  await page.create();
  await page.create();
  assert.equal(h.calls[0].input.requestId, h.calls[1].input.requestId);
  assert.equal(page.form.gameName, '饥荒联机版');
  assert.equal(page.state.busy, false);
  assert.deepEqual(h.toasts, ['网络失败', '网络失败']);
});
test('a failed vote preserves the visible board and a launch opens the authoritative team', async () => {
  const current = { ...board(), options: [option()] };
  const h = harness({
    callTeam: async (action) => {
      if (action === 'getDailyPlay') return { board: current };
      if (action === 'votePlayOption') throw new Error('网络失败');
      return { board: current, teamId: 'real-team' };
    },
  });
  const page = h.page('pages/play/play').bindings.page;
  await page.load();
  await page.vote(option());
  assert.equal(page.state.board.options[0].mine, false);
  assert.equal(page.state.board.options[0].votes, 2);
  assert.ok(h.toasts.includes('网络失败'));
  await page.launch(option());
  assert.ok(h.navigation.includes('/pages/team/detail?teamId=real-team'));
});
test('after departure, wanting joins the car; an onboard user opens details without cancelling their vote', async () => {
  const h = harness({ callTeam: async () => ({ board: board() }) });
  const page = h.page('pages/play/play').bindings.page;
  await page.vote({ ...option(), mine: true, teamId: 'real-team' });
  assert.deepEqual({ ...h.calls[0].input }, { optionId: 'choice-1', want: true });
  await page.vote({ ...option(), teamId: 'real-team', joined: true });
  assert.equal(h.calls.length, 1);
  assert.ok(h.navigation.includes('/pages/team/detail?teamId=real-team'));
});
test('missing profile opens the existing editor and resumes the requested action after saving', async () => {
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
test('committed writes survive a board refresh outage: creation clears its draft and departure still opens the car', async () => {
  const h = harness({ callTeam: async () => ({ board: null, teamId: 'committed-team' }) });
  const page = h.page('pages/play/play').bindings.page;
  page.form.gameName = '饥荒联机版';
  await page.create();
  assert.equal(page.form.gameName, '');
  assert.match(page.state.error, /操作已成功/);
  await page.launch(option());
  assert.ok(h.toasts.includes('发车成功，想玩的搭子已自动上车'));
  assert.ok(h.navigation.includes('/pages/team/detail?teamId=committed-team'));
});
