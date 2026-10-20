const { createHash } = require('node:crypto');
const HOUR = 3600000;
const hash = (...parts) => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
const dayId = at => new Date(at + 8 * HOUR).toISOString().slice(0, 10);
async function optional(ref) {
  try { return (await ref.get()).data || null; }
  catch (error) {
    if (/not exist|not found|不存在/i.test(String(error.errMsg || error.message))) return null;
    throw error;
  }
}
const clean = row => { const { _id, ...data } = row; return data; };
function createDailyPlay(db, { now = Date.now } = {}) {
  async function view(option, openid) {
    const team = option.teamId ? await optional(db.collection('teams').doc(option.teamId)) : null;
    const members = team ? (await db.collection('members').where({ teamId: option.teamId }).get()).data : [];
    return {
      id: option.id, gameName: option.gameName, platform: option.platform,
      startAt: option.startAt, endAt: option.endAt, createdAt: option.createdAt,
      votes: Object.keys(option.voters).length, mine: !!option.voters[hash(openid)],
      teamId: option.teamId || '', memberCount: team?.memberCount || 0,
      joined: members.some(m => (m.openid || m._openid) === openid),
      status: team?.status || '', capacity: team?.capacity || 20,
      expired: now() >= (team?.endAt || option.endAt),
    };
  }
  async function get(openid) {
    const day = dayId(now());
    const index = await optional(db.collection('daily_play').doc(day));
    const options = await Promise.all((index?.ids || []).map(id => optional(db.collection('play_options').doc(id))));
    return { dayId: day, serverNow: now(), options: await Promise.all(options.filter(Boolean).map(o => view(o, openid))) };
  }
  // Hydration must never turn a committed write into an apparent failure.
  async function refreshed(openid) {
    try { return await get(openid); }
    catch (error) { console.error('daily board refresh failed', error.message); return null; }
  }
  async function create(openid, user, input) {
    const at = now(), day = dayId(at);
    if (typeof input.requestId !== 'string' || !/^[\w-]{8,80}$/.test(input.requestId)) throw new Error('请重新提交选项');
    if (!input.gameName || input.gameName.length > 40) throw new Error('游戏名称需为 1–40 字');
    if (!['Steam', '手游', '端游', '主机'].includes(input.platform)) throw new Error('请选择游戏平台');
    if (!Number.isFinite(input.startAt) || !Number.isFinite(input.endAt) ||
      dayId(input.startAt) !== day || input.endAt <= Math.max(at, input.startAt) ||
      input.endAt - input.startAt > 24 * HOUR) throw new Error('请选择今天的开始时间和有效的结束时间（最长24小时）');
    const id = hash(day, openid, input.requestId);
    await db.runTransaction(async tx => {
      if (dayId(now()) !== day || input.endAt <= now()) throw new Error('时间已变化，请重新选择');
      const ref = tx.collection('daily_play').doc(day);
      const index = await optional(ref) || { ids: [] };
      const optionRef = tx.collection('play_options').doc(id);
      if (await optional(optionRef)) return;
      if (index.ids.length >= 50) throw new Error('今天的选项已满，先看看大家想玩什么吧');
      await optionRef.set({ data: {
        id, dayId: day, gameName: input.gameName, platform: input.platform,
        startAt: input.startAt, endAt: input.endAt, createdAt: at, creator: openid,
        voters: { [hash(openid)]: { openid, nickName: user.nickName, avatarUrl: user.avatarUrl || '' } },
      } });
      await ref.set({ data: { ids: [...index.ids, id] } });
    });
    return refreshed(openid);
  }
  async function mutate(openid, user, input, launch = false) {
    if (typeof input.optionId !== 'string' || !/^[a-f0-9]{64}$/.test(input.optionId)) throw new Error('选项不存在');
    if (!launch && typeof input.want !== 'boolean') throw new Error('请选择是否想玩');
    let teamId = '';
    await db.runTransaction(async tx => {
      const ref = tx.collection('play_options').doc(input.optionId);
      const stored = await optional(ref);
      if (!stored) throw new Error('选项不存在');
      const option = clean(stored), at = now();
      if (option.dayId !== dayId(at) || at >= option.endAt) throw new Error('这个选项已结束，请选择新的时间');
      const key = hash(openid);
      teamId = option.teamId || '';
      if (launch && teamId) return; // A retried/concurrent launch always opens the same team.
      if (launch) {
        if (Object.keys(option.voters).length < 2) throw new Error('至少两个人想玩后才能发车');
        const voters = { ...option.voters, [key]: { openid, nickName: user.nickName, avatarUrl: user.avatarUrl || '' } };
        if (Object.keys(voters).length > 20) throw new Error('人数已满，请由已投票的人发车');
        // Recheck voter profiles: a banned account cannot be automatically boarded.
        const eligible = [];
        for (const voter of Object.values(voters)) {
          const profile = await optional(tx.collection('users').doc(voter.openid));
          if (profile?.nickName && !profile.banned) eligible.push({ ...voter, nickName: profile.nickName, avatarUrl: profile.avatarUrl || '' });
        }
        if (eligible.length < 2 || !eligible.some(v => v.openid === openid)) throw new Error('当前可上车的人不足两人，请刷新后再试');
        teamId = 'play_' + option.id;
        await tx.collection('teams').doc(teamId).set({ data: {
          gameName: option.gameName, platform: option.platform, startAt: option.startAt,
          endAt: option.endAt, expireAt: option.endAt, zone: 'game', dailyOptionId: option.id,
          capacity: 20, memberCount: eligible.length, status: eligible.length === 20 ? 'full' : 'recruiting',
          openid, hostNickName: user.nickName, hostAvatarUrl: user.avatarUrl || '',
          roomNo: '通过车头公开资料联系进游戏，房间信息待车头补充', roomPwd: '',
          server: '', voice: '不限', rankReq: '', note: '来自今天玩啥，想玩的搭子已自动上车。', createdAt: at,
        } });
        for (const voter of eligible) {
          await tx.collection('members').doc(hash(teamId, voter.openid)).set({ data: {
            ...voter, teamId, role: voter.openid === openid ? 'host' : 'member', joinedAt: at,
          } });
        }
        option.teamId = teamId;
      } else {
        if (teamId) {
          if (!input.want) throw new Error('已发车，请到队伍详情下车');
          const teamRef = tx.collection('teams').doc(teamId);
          const team = await optional(teamRef);
          if (!team || team.status === 'cancelled' || at >= team.endAt) throw new Error('这趟车已结束');
          const members = (await db.collection('members').where({ teamId }).get()).data;
          if (!members.some(m => (m.openid || m._openid) === openid)) {
            if (team.memberCount >= team.capacity) throw new Error('这趟车已满员');
            const memberCount = team.memberCount + 1;
            await tx.collection('members').doc(hash(teamId, openid)).set({ data: {
              teamId, openid, nickName: user.nickName, avatarUrl: user.avatarUrl || '', role: 'member', joinedAt: at,
            } });
            await teamRef.update({ data: { memberCount, status: memberCount >= team.capacity ? 'full' : 'recruiting' } });
          }
        }
        if (input.want) {
          if (!option.voters[key] && Object.keys(option.voters).length >= 20) throw new Error('想玩人数已满20人，试试其他选项吧');
          option.voters[key] = { openid, nickName: user.nickName, avatarUrl: user.avatarUrl || '' };
        } else delete option.voters[key];
      }
      await ref.set({ data: option });
    });
    return { board: await refreshed(openid), teamId };
  }
  return { get, create, vote: (id, user, input) => mutate(id, user, input), launch: (id, user, input) => mutate(id, user, input, true) };
}
module.exports = { createDailyPlay, dayId };
