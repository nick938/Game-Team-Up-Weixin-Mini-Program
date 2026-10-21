const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDailyPlay, dayId, schedule } = require('../cloudfunctions/team/lib/daily-play');
function fixture() {
  const records = new Map();
  let queue = Promise.resolve();
  function collection(table, writes = records) {
    return {
      doc(id) {
        const key = `${table}/${id}`;
        return {
          get: async () => ({ data: structuredClone(writes.get(key)) }),
          set: async ({ data }) => { assert.equal(data._id, undefined); writes.set(key, { ...structuredClone(data), _id: id }); },
          update: async ({ data }) => { writes.set(key, { ...writes.get(key), ...structuredClone(data) }); },
          remove: async () => { writes.delete(key); },
        };
      },
      where(query) { return { get: async () => ({ data: [...records.entries()].filter(([k,v]) => k.startsWith(table + '/') && Object.entries(query).every(([key, value]) => v[key] === value)).map(([,v]) => structuredClone(v)) }) }; },
    };
  }
  const db = { collection, runTransaction(callback) {
    const task = queue.then(async () => {
      const writes = new Map(structuredClone([...records]));
      const result = await callback({ collection: table => collection(table, writes) });
      records.clear();
      writes.forEach((value, key) => records.set(key, value));
      return result;
    });
    queue = task.catch(() => {});
    return task;
  } };
  const users = ['a','b','c','d'].map(openid => ({ openid, nickName: `玩家${openid}`, avatarUrl: '' }));
  users.forEach(user => records.set('users/' + user.openid, { _id: user.openid, ...user }));
  let at = Date.parse('2026-10-20T15:00:00+08:00');
  const service = createDailyPlay(db, { now: () => at, history: async () => [...records.entries()].filter(([key]) => key.startsWith('teams/')).map(([,value]) => value), pick: () => 0 });
  const input = { gameName: '饥荒联机版', platform: 'Steam', requestId: 'request-one' };
  return { db, records, service, users, input, setTime: value => { at = value; } };
}
const start = Date.parse('2026-10-20T21:00:00+08:00');
const cutoff = start - 5 * 3600000;
test('daily schedule uses Shanghai 21:00–23:00 across midnight and year rollover', () => {
  assert.equal(schedule(start).startAt, start);
  assert.equal(schedule(start).settleAt, cutoff);
  assert.equal(schedule(start).endAt, start + 7200000);
  assert.equal(dayId(Date.parse('2026-10-20T16:00:00Z')), '2026-10-21');
  assert.equal(schedule(Date.parse('2026-12-31T23:59:59+08:00')).dayId, '2026-12-31');
  assert.equal(schedule(Date.parse('2027-01-01T00:00:00+08:00')).startAt, Date.parse('2027-01-01T21:00:00+08:00'));
});
test('multiple games per user, duplicate proposals merge votes and profiles remain private', async () => {
  const { service, input, users } = fixture();
  await Promise.all(Array.from({ length: 4 }, (_, i) => service.create('a', users[0], { ...input, requestId: 'different-' + i })));
  await service.create('a', users[0], { ...input, gameName: '双人成行', requestId: 'request-two' });
  const board = await service.get('b');
  assert.equal(board.options.length, 2);
  assert.ok(board.options.every(o => o.votes === 1 && !o.mine));
  const existing = board.options.find(o => o.gameName === input.gameName);
  await service.create('b', users[1], { ...input, gameName: ' 饥荒联机版 ' });
  await service.vote('b', users[1], { optionId: existing.id, want: true });
  const updated = await service.get('a');
  assert.equal(updated.options.length, 2);
  assert.equal(updated.options[0].votes, 2);
  assert.ok(updated.options.every(o => o.mine));
  for (const value of ['openid', 'voters', 'avatarUrl', '玩家a']) assert.ok(!JSON.stringify(updated).includes(value));
});
test('same game merges across case, fullwidth names and legacy platform values', async () => {
  const { service, input, users } = fixture();
  await service.create('a', users[0], { ...input, gameName: 'ＣＳ２' });
  await service.create('b', users[1], { ...input, gameName: ' cs2 ' });
  await service.create('a', users[0], { ...input, gameName: 'CS2', platform: '端游' });
  const board = await service.get('b');
  assert.equal(board.options.length, 1);
  assert.equal(board.options[0].votes, 2);
});
test('votes are multi-select, cancellation is idempotent and votes never create or board a team', async () => {
  const { service, input, users, records } = fixture();
  await service.create('a', users[0], input);
  await service.create('a', users[0], { ...input, gameName: '双人成行' });
  const board = await service.get('b');
  for (const option of board.options) {
    await service.vote('b', users[1], { optionId: option.id, want: true });
    await service.vote('b', users[1], { optionId: option.id, want: true });
  }
  assert.ok((await service.get('b')).options.every(o => o.votes === 2 && o.mine));
  for (let i = 0; i < 2; i++) await service.vote('b', users[1], { optionId: board.options[0].id, want: false });
  assert.equal((await service.get('b')).options.find(o => o.id === board.options[0].id).votes, 1);
  assert.equal([...records.keys()].filter(k => k.startsWith('teams/') || k.startsWith('members/')).length, 0);
});
test('16:00 snapshots the official champion while live voting remains open all day', async () => {
  const { service, input, users, records, setTime } = fixture();
  const first = (await service.create('a', users[0], input)).options[0];
  setTime(cutoff - 10000);
  const second = (await service.create('b', users[1], { ...input, gameName: '双人成行' })).options.find(o => o.id !== first.id);
  await service.vote('c', users[2], { optionId: second.id, want: true });
  await service.settle();
  assert.equal([...records.keys()].filter(k => k.startsWith('teams/')).length, 0);
  setTime(cutoff);
  await Promise.all([service.settle(), service.settle(), service.get('c')]);
  const board = await service.get('c');
  assert.equal(board.winnerId, second.id);
  assert.equal(board.teamId, 'night_2026-10-20');
  const teams = [...records.entries()].filter(([k]) => k.startsWith('teams/'));
  assert.equal(teams.length, 1);
  const team = teams[0][1];
  assert.equal(team.openid, undefined);
  assert.equal(team.pendingHost, true);
  assert.equal(team.roomNo, '');
  assert.equal(team.capacity, 4);
  assert.equal(team.startAt, start);
  assert.equal(team.endAt, start + 7200000);
  assert.equal(team.memberCount, 0);
  assert.equal(team.dailyOptionId, second.id);
  assert.equal([...records.entries()].filter(([k]) => k.startsWith('members/')).length, 0);
  await service.vote('c', users[2], { optionId: second.id, want: false });
  await service.create('a', users[0], { ...input, gameName: '新游戏' });
  assert.equal((await service.get('a')).votingClosed, false);
  assert.equal(team.officialSource, 'champion');
  setTime(start + 3600000);
  assert.equal((await service.get('a')).winnerId, second.id);
});
test('tie breaks by oldest proposal and stable id; a single vote is sufficient', async () => {
  const { service, input, users, setTime } = fixture();
  const first = (await service.create('a', users[0], input)).options[0];
  setTime(cutoff - 10000);
  await service.create('b', users[1], { ...input, gameName: '双人成行' });
  setTime(cutoff);
  assert.equal((await service.get('b')).winnerId, first.id);
});
test('no votes and no usable history produces a clear empty state', async () => {
  const { service, input, users, setTime } = fixture();
  const first = (await service.create('a', users[0], input)).options[0];
  await service.vote('a', users[0], { optionId: first.id, want: false });
  setTime(cutoff);
  const board = await service.get('a');
  assert.equal(board.winnerId, '');
  assert.equal(board.teamId, '');
  setTime(start + 86400000);
  assert.equal((await service.get('a')).teamId, '');
});
test('proposer profile does not assign or block the unowned car', async () => {
  for (const missing of [false, true]) {
    const { service, input, users, records, setTime } = fixture();
    const first = (await service.create('a', users[0], input)).options[0];
    if (missing) records.delete('users/a');
    else records.get('users/a').banned = true;
    setTime(cutoff);
    const board = await service.get('a');
    assert.equal(board.winnerId, first.id);
    assert.equal(board.teamId, 'night_2026-10-20');
    assert.equal(board.team.pendingHost, true);
    assert.equal(board.team.memberCount, 0);
  }
});
test('23:00 never backfills an expired car; midnight opens a fresh board and rejects yesterday options', async () => {
  const { service, input, users, setTime } = fixture();
  const first = (await service.create('a', users[0], input)).options[0];
  setTime(start + 7200000);
  const expired = await service.get('a');
  assert.equal(expired.winnerId, first.id);
  assert.equal(expired.teamId, '');
  assert.match(expired.unavailableReason, /结束/);
  setTime(Date.parse('2026-10-21T00:00:00+08:00'));
  const next = await service.get('a');
  assert.equal(next.options.length, 0);
  assert.equal(next.votingClosed, false);
  await assert.rejects(service.vote('a', users[0], { optionId: first.id, want: true }), /结束/);
  assert.equal((await service.create('a', users[0], input)).options.length, 1);
});
test('votes are not capped by twenty team seats', async () => {
  const { service, input, users, setTime } = fixture();
  const first = (await service.create('a', users[0], input)).options[0];
  for (let i = 0; i < 25; i++) await service.vote('voter-' + i, users[0], { optionId: first.id, want: true });
  setTime(cutoff);
  const board = await service.get('a');
  assert.equal(board.options[0].votes, 26);
  assert.equal(board.team.memberCount, 0);
});
test('list hydration outage preserves committed create and vote success', async () => {
  const { db, service, input, users } = fixture();
  const original = db.collection;
  db.collection = table => { if (table === 'daily_play') throw new Error('list offline'); return original(table); };
  assert.equal(await service.create('a', users[0], input), null);
  db.collection = original;
  const first = (await service.get('a')).options[0];
  db.collection = table => { if (table === 'daily_play') throw new Error('list offline'); return original(table); };
  assert.equal((await service.vote('b', users[1], { optionId: first.id, want: true })).board, null);
  db.collection = original;
  assert.equal((await service.get('b')).options[0].votes, 2);
});
test('crossing 16:00 persists the official snapshot before accepting later votes', async () => {
  const { service, input, users, db } = fixture();
  const first = (await service.create('a', users[0], input)).options[0];
  let calls = 0;
  const crossing = createDailyPlay(db, { now: () => calls++ === 0 ? cutoff - 1 : cutoff });
  await crossing.vote('b', users[1], { optionId: first.id, want: true });
  const board = await crossing.get('b');
  assert.equal(board.winnerId, first.id);
  assert.equal(board.options[0].votes, 2);
  assert.equal(board.votingClosed, false);
});
test('no board or zero votes picks from eligible historical cars and inherits capacity without leaking old contact info', async () => {
  for (const hasBoard of [false, true]) {
    const { service, input, users, records, setTime } = fixture();
    records.set('teams/old', { _id: 'old', gameName: '深岩银河', platform: 'Steam', capacity: 6, openid: 'a', roomNo: 'private-code', roomPwd: 'secret', createdAt: 100 });
    records.set('teams/pending', { _id: 'pending', gameName: '不能选', platform: 'Steam', capacity: 4, pendingHost: true, createdAt: 999 });
    if (hasBoard) { const { id } = (await service.create('a', users[0], input)).options[0]; await service.vote('a', users[0], { optionId: id, want: false }); }
    setTime(cutoff);
    await Promise.all([service.settle(), service.settle()]);
    const board = await service.get('a');
    assert.equal(board.source, 'history');
    assert.equal(board.team.gameName, '深岩银河');
    assert.equal(board.team.capacity, 6);
    assert.equal(board.team.memberCount, 0);
    const team = records.get('teams/' + board.teamId);
    assert.equal(team.roomNo, '');
    assert.equal(team.roomPwd, '');
    assert.equal(team.officialSource, 'random');
    assert.equal(team.openid, undefined);
    assert.equal(team.startAt, start);
    assert.ok(!JSON.stringify(board).includes('private-code'));
  }
});
test('voted game wins over random history and reuses its latest completed capacity', async () => {
  const { service, input, users, records, setTime } = fixture();
  records.set('teams/older', { _id: 'older', ...input, capacity: 6, openid: 'a', createdAt: 1 });
  records.set('teams/newer', { _id: 'newer', ...input, capacity: 8, openid: 'b', createdAt: 2 });
  records.set('teams/other', { _id: 'other', gameName: '不能选', platform: 'Steam', capacity: 3, openid: 'a', createdAt: 9 });
  await service.create('a', users[0], input);
  setTime(cutoff);
  const board = await service.get('a');
  assert.equal(board.source, 'vote');
  assert.equal(board.team.gameName, input.gameName);
  assert.equal(board.team.capacity, 8);
});
test('votes and new proposals after 16:00 can change the live leader without changing the official car', async () => {
  const { service, input, users, setTime, records } = fixture();
  const first = (await service.create('a', users[0], input)).options[0];
  setTime(cutoff);
  const official = await service.get('a');
  const second = (await service.create('b', users[1], { ...input, gameName: '后来的游戏' })).options.find(option => option.id !== first.id);
  await service.vote('c', users[2], { optionId: second.id, want: true });
  await service.vote('a', users[0], { optionId: first.id, want: false });
  const live = await service.get('c');
  assert.equal(live.options[0].id, second.id);
  assert.equal(live.winnerId, first.id);
  assert.equal(live.selectedGame.gameName, input.gameName);
  assert.equal(live.teamId, official.teamId);
  assert.equal(records.get('teams/' + live.teamId).officialSource, 'champion');
});
test('a missed timer is settled before a late first proposal and never retroactively turns it into champion', async () => {
  const { service, input, users, records, setTime } = fixture();
  records.set('teams/history', { _id: 'history', gameName: '历史游戏', platform: 'Steam', capacity: 6, openid: 'a', createdAt: 1 });
  setTime(cutoff + 3600000);
  const board = await service.create('b', users[1], input);
  assert.equal(board.options[0].gameName, input.gameName);
  assert.equal(board.source, 'history');
  assert.equal(board.team.gameName, '历史游戏');
  assert.equal(board.winnerId, '');
});
