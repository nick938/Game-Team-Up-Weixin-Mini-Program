const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFixedTeams, validatePlan, occurrence } = require('../cloudfunctions/team/lib/fixed-teams');
function fixture() {
  const rows = new Map();
  let at = Date.parse('2026-10-27T12:00:00+08:00');
  let queue = Promise.resolve();
  let failMember = false;
  function collection(table, source = rows) {
    return { doc(id) {
      const key = `${table}/${id}`;
      return {
        get: async () => ({ data: structuredClone(source.get(key)) }),
        set: async ({ data }) => { if (table === 'members' && failMember) throw new Error('member write failed'); source.set(key, { ...structuredClone(data), _id: id }); },
        update: async ({ data }) => source.set(key, { ...source.get(key), ...structuredClone(data) }),
      };
    } };
  }
  const db = { collection, runTransaction(fn) {
    const task = queue.then(async () => {
      const writes = new Map(structuredClone([...rows]));
      const result = await fn({ collection: name => collection(name, writes) });
      rows.clear(); writes.forEach((value, key) => rows.set(key, value));
      return result;
    });
    queue = task.catch(() => {});
    return task;
  } };
  rows.set('users/host', { _id: 'host', nickName: '车头', groupIds: ['group-a'] });
  const service = createFixedTeams(db, { now: () => at, readPlans: async () => [...rows.entries()].filter(([key]) => key.startsWith('fixed_team_plans/')).map(([,value]) => value),
    requireHost: async id => { const user = rows.get('users/' + id); if (!user || user.banned || !user.nickName) throw new Error('车头不可用'); return user; }, onError() {} });
  const plan = { id: 'plan-test-1', gameName: 'CS2', hostOpenid: 'host', startTime: '21:00', endTime: '23:00', capacity: 4, platform: 'Steam', voice: '不限', enabled: true };
  return { rows, service, plan, time: value => { at = Date.parse(value); }, failMember: value => { failMember = value; } };
}
test('fixed car retries and concurrent ticks create one independent car and host per Shanghai day', async () => {
  const { rows, service, plan, time } = fixture();
  await service.save(plan, 'admin');
  await Promise.all([service.generate(), service.generate(), service.generate()]);
  const first = rows.get('teams/fixed_plan-test-1_2026-10-27');
  assert.equal(first.memberCount, 1);
  assert.deepEqual(first.groupIds, ['group-a']);
  assert.equal([...rows.keys()].filter(k => k.startsWith('members/')).length, 1);
  first.memberCount = 4;
  time('2026-10-28T00:00:00+08:00');
  await service.generate();
  assert.equal(rows.get('teams/fixed_plan-test-1_2026-10-28').memberCount, 1);
  assert.equal(first.memberCount, 4);
  assert.equal([...rows.keys()].filter(k => k.startsWith('teams/')).length, 2);
});
test('pause, resume and edit do not recreate cancelled cars or rewrite existing registrations', async () => {
  const { rows, service, plan, time } = fixture();
  await service.save(plan, 'admin'); await service.generate();
  const first = rows.get('teams/fixed_plan-test-1_2026-10-27');
  first.status = 'cancelled';
  await service.save({ ...plan, gameName: '饥荒', capacity: 8 }, 'admin');
  await service.generate();
  assert.equal(rows.get('teams/fixed_plan-test-1_2026-10-27').gameName, 'CS2');
  assert.equal(rows.get('teams/fixed_plan-test-1_2026-10-27').status, 'cancelled');
  await service.setEnabled(plan.id, false, 'admin');
  time('2026-10-28T00:00:00+08:00'); await service.generate();
  assert.ok(!rows.has('teams/fixed_plan-test-1_2026-10-28'));
  await service.setEnabled(plan.id, true, 'admin'); await service.generate();
  assert.equal(rows.get('teams/fixed_plan-test-1_2026-10-28').gameName, '饥荒');
});
test('banned hosts are skipped and member failure rolls back the team for a later retry', async () => {
  const { rows, service, plan, failMember } = fixture();
  await service.save(plan, 'admin');
  rows.get('users/host').banned = true;
  assert.equal((await service.generate()).length, 1);
  assert.ok(!rows.has('teams/fixed_plan-test-1_2026-10-27'));
  rows.get('users/host').banned = false;
  failMember(true);
  assert.equal((await service.generate()).length, 1);
  assert.ok(!rows.has('teams/fixed_plan-test-1_2026-10-27'));
  failMember(false); await service.generate();
  assert.equal(rows.get('teams/fixed_plan-test-1_2026-10-27').memberCount, 1);
});
test('overnight recovery, year rollover, missed days and creation after start have correct boundaries', async () => {
  const { rows, service, plan, time } = fixture();
  await service.save({ ...plan, startTime: '23:00', endTime: '02:00' }, 'admin');
  time('2026-10-28T01:00:00+08:00'); await service.generate();
  assert.equal(rows.get('teams/fixed_plan-test-1_2026-10-27').endAt, Date.parse('2026-10-28T02:00:00+08:00'));
  time('2026-11-01T12:00:00+08:00'); await service.generate();
  assert.ok(!rows.has('teams/fixed_plan-test-1_2026-10-30'));
  const window = occurrence({ startTime: '23:00', endTime: '01:00' }, '2026-12-31');
  assert.equal(window.endAt, Date.parse('2027-01-01T01:00:00+08:00'));
  const late = fixture(); late.time('2026-10-27T22:00:00+08:00');
  await late.service.save(late.plan, 'admin'); await late.service.generate();
  assert.ok(!late.rows.has('teams/fixed_plan-test-1_2026-10-27'));
});
test('invalid times, duration, capacity, IDs and unavailable hosts cannot create plans', async () => {
  const { service, plan } = fixture();
  for (const patch of [{ startTime: '25:00' }, { endTime: '21:00' }, { capacity: 1 }, { id: '../bad' }, { enabled: 'true' }, { platform: 'bad' }]) {
    assert.throws(() => validatePlan({ ...plan, ...patch }));
  }
  await assert.rejects(service.save({ ...plan, hostOpenid: 'missing' }, 'admin'));
});
