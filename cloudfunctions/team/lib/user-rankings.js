const { createHash } = require('node:crypto');
function buildUserRankings({ teams, members, events, users }) {
  const profiles = new Map(users.filter(user => user.nickName && !user.banned).map(user => [user._id || user.openid || user._openid, user]));
  const cars = new Map(teams.filter(team => !team.pendingHost && (team.openid || team._openid)).map(team => [team._id, team]));
  const hosted = new Map(), joined = new Map();
  function add(target, uid, teamId) {
    if (!profiles.has(uid)) return;
    if (!target.has(uid)) target.set(uid, new Set());
    target.get(uid).add(teamId);
  }
  for (const [id, team] of cars) add(hosted, team.openid || team._openid, id);
  for (const entry of [...members.filter(member => member.role !== 'host'), ...events.filter(event => event.kind === 'join')]) {
    const team = cars.get(entry.teamId), uid = entry.openid || entry._openid;
    if (team && uid && uid !== (team.openid || team._openid)) add(joined, uid, entry.teamId);
  }
  function top(counts) {
    return [...counts].map(([uid, ids]) => {
      const user = profiles.get(uid);
      return { userKey: createHash('sha256').update('ranking:' + uid).digest('hex'), nickName: user.nickName, avatarUrl: user.avatarUrl || '', bio: typeof user.bio === 'string' ? user.bio : '', count: ids.size };
    }).sort((a, b) => b.count - a.count || a.userKey.localeCompare(b.userKey)).slice(0, 10);
  }
  return { hosted: top(hosted), joined: top(joined) };
}
module.exports = { buildUserRankings };
