const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createWeeklyPlay, period, games } = require('../cloudfunctions/team/lib/weekly-play');
function fixture() {
  const records = new Map();
  let queue = Promise.resolve();
  const db = { runTransaction(callback) {
    const task = queue.then(async () => {
      const writes = new Map();
      const result = await callback({ collection: table => ({ doc: id => {
        const key = table + '/' + id;
        return {
          get: async () => ({ data: records.has(key) ? { _id: id, ...structuredClone(records.get(key)) } : undefined }),
          set: async ({ data }) => { assert.equal(data._id, undefined); writes.set(key, structuredClone(data)); },
        };
      } }) });
      writes.forEach((value, key) => records.set(key, value));
      return result;
    });
    queue = task.catch(() => {});
    return task;
  } };
  return { db, records };
}
const before = Date.parse('2026-10-23T19:59:00+08:00');
const cutoff = Date.parse('2026-10-23T20:00:00+08:00');
test('Friday schedule follows Shanghai boundaries, including Saturday and year rollover', () => {
  assert.equal(period(Date.parse('2026-10-20T09:00:00+08:00')).startAt, Date.parse('2026-10-23T21:00:00+08:00'));
  assert.equal(period(Date.parse('2026-10-23T23:59:59+08:00')).weekId, '2026-10-23');
  assert.equal(period(Date.parse('2026-10-24T00:00:00+08:00')).weekId, '2026-10-30');
  assert.equal(period(Date.parse('2026-12-31T00:00:00+08:00')).weekId, '2027-01-01');
});
test('one ballot per authenticated user: repeats are idempotent, switches and cancellation correct counts', async () => {
  const { db } = fixture();
  const service = createWeeklyPlay(db, { now: () => before });
  const weekId = period(before).weekId;
  const [a, b] = games;
  await Promise.all(Array.from({ length: 8 }, () => service.vote('user-a', { weekId, gameId: a.id })));
  let activity = await service.get('user-a');
  assert.equal(activity.totalVotes, 1);
  await service.vote('user-a', { weekId, gameId: b.id });
  activity = await service.vote('user-b', { weekId, gameId: a.id });
  assert.equal(activity.totalVotes, 2);
  assert.equal(activity.games.find(g => g.id === a.id).votes, 1);
  await service.vote('user-a', { weekId, gameId: '' });
  activity = await service.get('user-a');
  assert.equal(activity.mine, '');
  assert.equal(activity.totalVotes, 1);
  assert.equal(activity.games.find(g => g.id === b.id).votes, 0);
  assert.ok(!JSON.stringify(activity).includes('user-b'));
});
test('draw considers all common multiplayer games regardless of ballots, and is shared and immutable', async () => {
  const { db } = fixture();
  let now = before, calls = 0;
  const service = createWeeklyPlay(db, { now: () => now, pick: size => { calls++; assert.equal(size, games.length); return 1; } });
  const weekId = period(before).weekId;
  await Promise.all(Array.from({ length: 10 }, (_, i) => service.vote('actor-' + i, { weekId, gameId: games[0].id })));
  await service.vote('other', { weekId, gameId: games[1].id });
  now = cutoff;
  const views = await Promise.all(Array.from({ length: 5 }, (_, i) => service.get('visitor-' + i)));
  assert.equal(calls, 1);
  views.forEach(activity => assert.equal(activity.selectedGame.id, games[1].id));
  const anotherInstance = createWeeklyPlay(db, { now: () => cutoff, pick: () => assert.fail('must reuse persisted selection') });
  assert.equal((await anotherInstance.get('new')).selectedGame.id, games[1].id);
  await assert.rejects(service.vote('actor-0', { weekId, gameId: games[1].id }), /截止/);
});
test('Friday draws a game even without votes; next week starts independently', async () => {
  const { db } = fixture();
  let now = cutoff;
  const service = createWeeklyPlay(db, { now: () => now, pick: () => 0 });
  assert.equal((await service.get('u')).selectedGame.id, games[0].id);
  now = Date.parse('2026-10-24T00:00:00+08:00');
  const next = await service.get('u');
  assert.equal(next.weekId, '2026-10-30');
  assert.equal(next.totalVotes, 0);
  assert.equal(next.votingClosed, false);
});
test('stale period and unknown game are rejected before a ballot is written', async () => {
  const { db, records } = fixture();
  const service = createWeeklyPlay(db, { now: () => before });
  await assert.rejects(service.vote('u', { weekId: '2026-10-16', gameId: games[0].id }), /刷新/);
  await assert.rejects(service.vote('u', { weekId: period(before).weekId, gameId: '<script>' }), /游戏列表/);
  assert.equal(records.size, 0);
});
test('transaction crossing the cutoff cannot admit a late ballot', async () => {
  const { db, records } = fixture();
  let n = 0;
  const service = createWeeklyPlay(db, { now: () => n++ === 0 ? before : cutoff });
  await assert.rejects(service.vote('u', { weekId: period(before).weekId, gameId: games[0].id }), /截止/);
  assert.equal(records.size, 0);
});
