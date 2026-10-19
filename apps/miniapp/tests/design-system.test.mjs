import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { harness } = require('../../../tests/support/miniapp.cjs');
const { presentTeam } = harness().load('utils/team-presentation');
const now = 1800000000000;
const base = {
  _id: 't',
  gameName: 'CS2',
  platform: 'Steam',
  capacity: 5,
  memberCount: 3,
  startAt: now + 3600000,
  endAt: now + 7200000,
  displayStatus: 'recruiting',
};

for (const started of [false, true]) {
  for (const full of [false, true]) {
    for (const role of [null, 'member', 'host']) {
      test(`team actions: ${started ? 'active' : 'scheduled'} / ${full ? 'full' : 'open'} / ${role || 'visitor'}`, () => {
        const view = presentTeam(
          {
            ...base,
            startAt: started ? now - 1000 : base.startAt,
            memberCount: full ? 5 : 3,
            displayStatus: full ? 'full' : 'recruiting',
          },
          role,
          now,
        );
        assert.equal(view.lifecycle, started ? 'active' : 'scheduled');
        assert.equal(view.recruitment, full ? 'full' : 'open');
        assert.equal(view.canJoin, !full && !role);
        assert.equal(view.primaryAction, full ? (role ? 'room' : 'browse') : role ? 'share' : 'join');
        assert.equal(view.canViewPassword, false, 'role does not invent an authorized password');
      });
    }
  }
}
for (const status of ['cancelled', 'expired', 'ended']) {
  for (const role of [null, 'member', 'host']) {
    test(`terminal status ${status} / ${role || 'visitor'} never recruits`, () => {
      const view = presentTeam({ ...base, displayStatus: status, roomPwd: 'secret' }, role, now);
      assert.equal(view.canJoin, false);
      assert.equal(view.ongoing, false);
      assert.equal(view.recruitment, 'closed');
      assert.equal(view.timeLabel, '');
      assert.equal(view.primaryAction, 'browse');
      assert.equal(view.canViewPassword, role === 'host' || (role === 'member' && status !== 'cancelled'));
      assert.deepEqual(view.secondaryActions, role === 'host' ? ['republish'] : []);
    });
  }
}
test('end boundary disables a stale recruiting snapshot, cancellation has priority', () => {
  assert.equal(presentTeam({ ...base, startAt: now - 1000, endAt: now }, null, now).lifecycle, 'ended');
  assert.equal(
    presentTeam({ ...base, displayStatus: 'cancelled', startAt: now - 1000, endAt: now }, null, now)
      .lifecycle,
    'cancelled',
  );
});
test('unknown status and invalid counts cannot enable joining', () => {
  for (const patch of [
    { displayStatus: 'mystery' },
    { capacity: 0 },
    { memberCount: 21 },
    { memberCount: -1 },
    { startAt: NaN },
  ]) {
    const view = presentTeam({ ...base, ...patch }, null, now);
    assert.equal(view.confirmed, false);
    assert.equal(view.canJoin, false);
    assert.equal(view.statusLabel, '状态待确认');
  }
});
test('join is guarded throughout authorization and server mutation', async () => {
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const h = harness({
    requestTeamNotify: () => pending,
    callTeam: async (action) =>
      action === 'getTeam'
        ? { team: { ...base, startAt: Date.now(), endAt: Date.now() + 3600000 }, members: [], role: 'member' }
        : { ok: true },
  });
  const page = h.page('pages/team/detail');
  page.state.teamId = 't';
  const first = page.onJoin();
  await Promise.all(Array.from({ length: 4 }, () => page.onJoin()));
  release(false);
  await first;
  assert.equal(h.calls.filter((call) => call.action === 'joinTeam').length, 1);
  assert.equal(page.state.joining, false);
});
test('failed join refreshes team state without replaying the write', async () => {
  const h = harness({
    callTeam: async (action) => {
      if (action === 'joinTeam') throw new Error('刚刚满员');
      return {
        team: {
          ...base,
          startAt: Date.now(),
          endAt: Date.now() + 3600000,
          displayStatus: 'full',
          memberCount: 5,
        },
        role: null,
        members: [],
      };
    },
  });
  const page = h.page('pages/team/detail');
  page.state.teamId = 't';
  await page.onJoin();
  assert.deepEqual(
    h.calls.map((call) => call.action),
    ['joinTeam', 'getTeam'],
  );
  assert.equal(page.state.team.displayStatus, 'full');
});
test('profile failure does not discard successfully loaded personal teams', async () => {
  const h = harness({
    callTeam: async (action) => {
      if (action === 'getProfile') throw new Error('offline');
      return { hosted: [{ ...base, startAt: Date.now(), endAt: Date.now() + 3600000 }], joined: [] };
    },
  });
  const page = h.page('pages/mine/mine');
  await page.load();
  assert.equal(page.state.visibleTeams.length, 1);
  assert.ok(page.state.profileError);
  assert.equal(page.state.listError, '');
});

test('correcting a field clears its own error without discarding other values', async () => {
  const page = harness().page('pages/publish/publish');
  page.onRoomNo('keep-this-room');
  await page.onSubmit();
  assert.equal(page.state.validationError.anchor, 'field-game');
  page.onGameName('CS2');
  assert.equal(page.state.validationError, null);
  assert.equal(page.state.roomNo, 'keep-this-room');
});
