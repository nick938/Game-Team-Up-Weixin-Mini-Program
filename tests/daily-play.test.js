const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDailyPlay, dayId } = require('../cloudfunctions/team/lib/daily-play');
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
  const service = createDailyPlay(db, { now: () => at });
  const input = { gameName: '饥荒联机版', platform: 'Steam', startAt: at + 3600000, endAt: at + 7200000, requestId: 'request-one' };
  return { db, records, service, users, input, setTime: value => { at = value; } };
}
test('users create multiple game/time choices; retries are idempotent and identities stay private', async () => {
  const { service, input, users } = fixture();
  await Promise.all(Array.from({ length: 4 }, () => service.create('a', users[0], input)));
  let board = await service.get('a');
  assert.equal(board.options.length, 1);
  assert.equal(board.options[0].votes, 1);
  assert.equal(board.options[0].mine, true);
  await service.create('a', users[0], { ...input, gameName: '双人成行', requestId: 'request-two' });
  board = await service.get('b');
  assert.equal(board.options.length, 2);
  assert.ok(board.options.every(o => !o.mine));
  for (const value of ['openid', 'voters', 'avatarUrl', '玩家a']) assert.ok(!JSON.stringify(board).includes(value));
});
test('at least two voters needed; concurrent launches produce one team with clicking user as host and every voter aboard', async () => {
  const { service, input, users, records } = fixture();
  const option = (await service.create('a', users[0], input)).options[0];
  await assert.rejects(service.launch('a', users[0], { optionId: option.id }), /至少两/);
  await service.vote('b', users[1], { optionId: option.id, want: true });
  const results = await Promise.all([service.launch('c', users[2], { optionId: option.id }), service.launch('b', users[1], { optionId: option.id })]);
  assert.equal(results[0].teamId, results[1].teamId);
  const teams = [...records.entries()].filter(([key]) => key.startsWith('teams/'));
  assert.equal(teams.length, 1);
  assert.equal(teams[0][1].openid, 'c');
  assert.equal(teams[0][1].memberCount, 3);
  const members = [...records.entries()].filter(([key]) => key.startsWith('members/')).map(([,value]) => value);
  assert.deepEqual(members.map(m => m.openid).sort(), ['a','b','c']);
  assert.equal(members.find(m => m.role === 'host').openid, 'c');
});
test('new votes after launch board once; external joins and leaving/rejoining never duplicate seats', async () => {
  const { service, input, users, records } = fixture();
  const { id } = (await service.create('a', users[0], input)).options[0];
  await service.vote('b', users[1], { optionId: id, want: true });
  const { teamId } = await service.launch('a', users[0], { optionId: id });
  await Promise.all(Array.from({ length: 5 }, () => service.vote('c', users[2], { optionId: id, want: true })));
  let result = await service.get('c');
  assert.equal(result.options[0].memberCount, 3);
  assert.equal(result.options[0].votes, 3);
  assert.equal(result.options[0].joined, true);
  records.set('members/external', { teamId, openid: 'd', role: 'member' });
  records.get('teams/' + teamId).memberCount = 4;
  await service.vote('d', users[3], { optionId: id, want: true });
  assert.equal(records.get('teams/' + teamId).memberCount, 4);
  for (const [key, value] of records) if (key.startsWith('members/') && value.openid === 'c') records.delete(key);
  records.get('teams/' + teamId).memberCount = 3;
  await service.vote('c', users[2], { optionId: id, want: true });
  assert.equal(records.get('teams/' + teamId).memberCount, 4);
  await assert.rejects(service.vote('c', users[2], { optionId: id, want: false }), /详情下车/);
});
test('cancellation before launch is idempotent; full, ended and cancelled cars reject extra boarding atomically', async () => {
  const { service, input, users, records, setTime } = fixture();
  const { id } = (await service.create('a', users[0], input)).options[0];
  await service.vote('b', users[1], { optionId: id, want: true });
  await service.vote('b', users[1], { optionId: id, want: false });
  await service.vote('b', users[1], { optionId: id, want: false });
  assert.equal((await service.get('b')).options[0].votes, 1);
  await service.vote('b', users[1], { optionId: id, want: true });
  const { teamId } = await service.launch('a', users[0], { optionId: id });
  const team = records.get('teams/' + teamId);
  team.capacity = 2;
  await assert.rejects(service.vote('c', users[2], { optionId: id, want: true }), /满员/);
  assert.equal((await service.get('c')).options[0].votes, 2);
  team.status = 'cancelled';
  await assert.rejects(service.vote('c', users[2], { optionId: id, want: true }), /结束/);
  setTime(input.endAt);
  await assert.rejects(service.vote('b', users[1], { optionId: id, want: true }), /结束/);
});
test('banned voters cannot auto-board or satisfy the two-person threshold', async () => {
  const { service, input, users, records } = fixture();
  const { id } = (await service.create('a', users[0], input)).options[0];
  await service.vote('b', users[1], { optionId: id, want: true });
  records.get('users/b').banned = true;
  await assert.rejects(service.launch('a', users[0], { optionId: id }), /不足两人/);
  assert.equal([...records.keys()].filter(k => k.startsWith('teams/')).length, 0);
});
test('invalid dates and past or cross-day actions fail without changes; Shanghai midnight resets the board', async () => {
  const { service, input, users, records, setTime } = fixture();
  await assert.rejects(service.create('a', users[0], { ...input, startAt: input.startAt + 86400000 }), /今天/);
  await assert.rejects(service.create('a', users[0], { ...input, endAt: input.startAt }), /时间/);
  assert.equal([...records.keys()].filter(k => k.startsWith('play_options/')).length, 0);
  const { id } = (await service.create('a', users[0], input)).options[0];
  setTime(Date.parse('2026-10-21T00:00:00+08:00'));
  assert.equal(dayId(Date.parse('2026-10-20T16:00:00Z')), '2026-10-21');
  assert.equal((await service.get('a')).options.length, 0);
  await assert.rejects(service.vote('a', users[0], { optionId: id, want: true }), /结束/);
});
test('a list hydration outage cannot report failure for a committed choice, vote or departure', async () => {
  const { db, service, input, users, records } = fixture();
  const original = db.collection;
  const failList = () => { db.collection = table => { if (table === 'daily_play') throw new Error('list offline'); return original(table); }; };
  failList();
  assert.equal(await service.create('a', users[0], input), null);
  db.collection = original;
  const { id } = (await service.get('a')).options[0];
  failList();
  assert.equal((await service.vote('b', users[1], { optionId: id, want: true })).board, null);
  const result = await service.launch('a', users[0], { optionId: id });
  assert.equal(result.board, null);
  assert.ok(result.teamId);
  assert.equal(records.get('teams/' + result.teamId).memberCount, 2);
});
