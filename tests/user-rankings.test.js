const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildUserRankings } = require('../cloudfunctions/team/lib/user-rankings');
test('counts completed hosting and unique passenger teams, with no inflation from repeat joins or host seats', () => {
  const result = buildUserRankings({
    users: [{ _id: 'a', nickName: '甲' }, { _id: 'b', nickName: '乙' }, { _id: 'blocked', nickName: '禁用', banned: true }],
    teams: [{ _id: 'one', openid: 'a' }, { _id: 'two', _openid: 'a' }, { _id: 'three', openid: 'b' }, { _id: 'empty', pendingHost: true }, { _id: 'bad', openid: 'blocked' }],
    members: [{ teamId: 'one', openid: 'a', role: 'host' }, { teamId: 'one', openid: 'b', role: 'member' }, { teamId: 'two', openid: 'blocked', role: 'member' }],
    events: [{ teamId: 'one', openid: 'b', kind: 'join' }, { teamId: 'one', openid: 'b', kind: 'join' }, { teamId: 'two', openid: 'b', kind: 'join' }, { teamId: 'one', openid: 'a', kind: 'join' }, { teamId: 'three', openid: 'a', kind: 'detail_view' }],
  });
  assert.deepEqual(result.hosted.map(row => [row.nickName, row.count]), [['甲', 2], ['乙', 1]]);
  assert.deepEqual(result.joined.map(row => [row.nickName, row.count]), [['乙', 2]]);
  assert.ok(!JSON.stringify(result).includes('openid'));
  assert.ok(!JSON.stringify(result).includes('blocked'));
});
test('returns at most ten real users, deterministic ties and no synthetic entries', () => {
  const users = Array.from({ length: 15 }, (_, i) => ({ _id: 'u' + i, nickName: '玩家' + i }));
  const data = { users, members: [], events: [], teams: users.map((u, i) => ({ _id: 't' + i, openid: u._id })) };
  const first = buildUserRankings(data);
  assert.equal(first.hosted.length, 10);
  assert.equal(first.joined.length, 0);
  assert.deepEqual(first, buildUserRankings({ ...data, users: [...users].reverse(), teams: [...data.teams].reverse() }));
});
test('ranking profiles expose only public nickname, avatar and bio alongside rank fields', () => {
  const result = buildUserRankings({
    teams: [{ _id: 'car', openid: 'private-openid' }], members: [], events: [],
    users: [{ _id: 'private-openid', nickName: '搭子', avatarUrl: 'cloud://avatar', bio: '晚上一起玩', reminderPreferences: { enabled: true }, phone: 'private-phone' }],
  });
  assert.equal(result.hosted[0].bio, '晚上一起玩');
  assert.deepEqual(Object.keys(result.hosted[0]).sort(), ['avatarUrl', 'bio', 'count', 'nickName', 'userKey']);
  assert.ok(!JSON.stringify(result).includes('private-'));
});
