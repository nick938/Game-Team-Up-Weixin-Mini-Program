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
test('ranking profiles include all public profile fields without exposing account fields', () => {
  const result = buildUserRankings({
    teams: [{ _id: 'car', openid: 'private-openid' }], members: [], events: [],
    users: [{ _id: 'private-openid', nickName: '搭子', avatarUrl: 'cloud://avatar', bio: '晚上一起玩', steamFriendCode: '123456', wechatId: 'player_1', groupIds: ['group'], favoriteGames: ['机械狂欢'], playTimes: ['evening'], reminderPreferences: { enabled: true }, phone: 'private-phone' }],
  });
  assert.equal(result.hosted[0].bio, '晚上一起玩');
  assert.deepEqual(Object.keys(result.hosted[0]).sort(), ['avatarUrl', 'bio', 'count', 'favoriteGames', 'groupIds', 'nickName', 'playTimes', 'steamFriendCode', 'userKey', 'wechatId']);
  for (const key of ['steamFriendCode', 'wechatId', 'groupIds', 'favoriteGames', 'playTimes']) {
    assert.deepEqual(result.hosted[0][key], { steamFriendCode: '123456', wechatId: 'player_1', groupIds: ['group'], favoriteGames: ['机械狂欢'], playTimes: ['evening'] }[key]);
  }
  assert.ok(!JSON.stringify(result).includes('private-'));
});

test('older profiles keep empty public field defaults', () => {
  const result = buildUserRankings({ teams: [{ _id: 'car', openid: 'a' }], members: [], events: [], users: [{ _id: 'a', nickName: '老玩家' }] });
  const row = result.hosted[0];
  assert.equal(row.steamFriendCode, '');
  assert.equal(row.wechatId, '');
  assert.deepEqual([row.groupIds, row.favoriteGames, row.playTimes], [[], [], []]);
});

test('legacy profile identities share one ranking entry and never count the host as a passenger', () => {
  const result = buildUserRankings({
    users: [
      { _id: 'host-document', _openid: 'host-openid', nickName: '老车头' },
      { _id: 'member-document', openid: 'member-openid', _openid: 'member-legacy', nickName: '老队友' },
    ],
    teams: [
      { _id: 'one', openid: 'host-openid' },
      { _id: 'two', _openid: 'host-document' },
    ],
    members: [
      { teamId: 'one', openid: 'member-document', role: 'member' },
      { teamId: 'two', _openid: 'member-legacy', role: 'member' },
      { teamId: 'one', openid: 'host-document', role: 'member' },
    ],
    events: [
      { teamId: 'one', openid: 'member-openid', kind: 'join' },
      { teamId: 'two', _openid: 'host-openid', kind: 'join' },
    ],
  });
  assert.deepEqual(result.hosted.map(row => [row.nickName, row.count]), [['老车头', 2]]);
  assert.deepEqual(result.joined.map(row => [row.nickName, row.count]), [['老队友', 2]]);
  assert.ok(!JSON.stringify(result).includes('document'));
  assert.ok(!JSON.stringify(result).includes('openid'));
});

test('banned or incomplete legacy profiles are excluded through every identity alias', () => {
  const users = [
    { _id: 'blocked-doc', _openid: 'blocked-openid', nickName: '禁用', banned: true },
    { _id: 'blank-doc', openid: 'blank-openid', nickName: '' },
  ];
  const result = buildUserRankings({
    users,
    teams: [{ _id: 'car', openid: 'blocked-openid' }, { _id: 'other', openid: 'blank-doc' }],
    members: [{ teamId: 'car', openid: 'blank-openid', role: 'member' }],
    events: [{ teamId: 'other', openid: 'blocked-doc', kind: 'join' }],
  });
  assert.deepEqual(result, { hosted: [], joined: [] });
});

test('direct document identity wins over conflicting aliases regardless of profile order', () => {
  const users = [
    { _id: 'actor', nickName: '直接匹配' },
    { _id: 'legacy-doc', _openid: 'actor', nickName: '别名冲突' },
  ];
  const input = { users, teams: [{ _id: 'car', openid: 'actor' }], members: [], events: [] };
  const result = buildUserRankings(input);
  assert.equal(result.hosted[0].nickName, '直接匹配');
  assert.deepEqual(buildUserRankings({ ...input, users: [...users].reverse() }), result);
});
