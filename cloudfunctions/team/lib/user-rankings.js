const { createHash } = require('node:crypto');
function buildUserRankings({ teams, members, events, users }) {
  const profiles = new Map(), identities = new Map();
  // Keep document IDs authoritative, matching getUser()'s direct lookup first.
  for (const user of users) {
    const id = user._id || user.openid || user._openid;
    if (!id) continue;
    profiles.set(id, user);
    identities.set(id, id);
  }
  // Legacy profiles can have a generated document ID and a separate OpenID.
  // Resolve every supported alias to one profile before counting unique teams.
  for (const [id, user] of profiles) {
    for (const alias of [user.openid, user._openid]) {
      if (alias && !identities.has(alias)) identities.set(alias, id);
    }
  }
  const profileId = uid => identities.get(uid) || '';
  const cars = new Map(teams.filter(team => !team.pendingHost && (team.openid || team._openid)).map(team => [team._id, team]));
  const hosted = new Map(), joined = new Map();
  function add(target, uid, teamId) {
    const id = profileId(uid), user = profiles.get(id);
    if (!user?.nickName || user.banned) return;
    if (!target.has(id)) target.set(id, new Set());
    target.get(id).add(teamId);
  }
  for (const [id, team] of cars) add(hosted, team.openid || team._openid, id);
  for (const entry of [...members.filter(member => member.role !== 'host'), ...events.filter(event => event.kind === 'join')]) {
    const team = cars.get(entry.teamId), uid = entry.openid || entry._openid;
    if (team && uid && profileId(uid) !== profileId(team.openid || team._openid)) add(joined, uid, entry.teamId);
  }
  function top(counts) {
    return [...counts].map(([uid, ids]) => {
      const user = profiles.get(uid);
      return {
        userKey: createHash('sha256').update('ranking:' + uid).digest('hex'),
        nickName: user.nickName,
        avatarUrl: user.avatarUrl || '',
        bio: typeof user.bio === 'string' ? user.bio : '',
        // Match the public fields shown in the member profile sheet; keep account fields private.
        steamFriendCode: typeof user.steamFriendCode === 'string' ? user.steamFriendCode : '',
        wechatId: typeof user.wechatId === 'string' ? user.wechatId : '',
        groupIds: Array.isArray(user.groupIds) ? user.groupIds : [],
        favoriteGames: Array.isArray(user.favoriteGames) ? user.favoriteGames : [],
        playTimes: Array.isArray(user.playTimes) ? user.playTimes : [],
        count: ids.size,
      };
    }).sort((a, b) => b.count - a.count || a.userKey.localeCompare(b.userKey)).slice(0, 10);
  }
  return { hosted: top(hosted), joined: top(joined) };
}
module.exports = { buildUserRankings };
