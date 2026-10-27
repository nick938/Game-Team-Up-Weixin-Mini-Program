const { dayId } = require('./daily-play');
const DAY = 86400000;
const clock = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
function validatePlan(input) {
  if (!input || typeof input !== 'object') throw new Error('缺少固定车设置');
  if (typeof input.id !== 'string' || !/^[\w-]{8,64}$/.test(input.id)) throw new Error('请重新创建固定车计划');
  const gameName = String(input.gameName || '').trim();
  if (!gameName || gameName.length > 40) throw new Error('游戏名称需为1–40字');
  if (typeof input.hostOpenid !== 'string' || !input.hostOpenid.trim() || input.hostOpenid.length > 64) throw new Error('请选择有效车头');
  if (!clock(input.startTime) || !clock(input.endTime) || input.startTime === input.endTime) throw new Error('时间请使用HH:mm格式，开始和结束不能相同');
  if (!Number.isInteger(input.capacity) || input.capacity < 2 || input.capacity > 20) throw new Error('人数需在2–20之间');
  if (!['Steam', '手游', '端游', '主机'].includes(input.platform)) throw new Error('请选择游戏平台');
  if (!['不限', 'KOOK', '游戏内语音', '开麦'].includes(input.voice)) throw new Error('请选择语音方式');
  if (typeof input.enabled !== 'boolean') throw new Error('请选择启用状态');
  return { id: input.id, gameName, hostOpenid: input.hostOpenid.trim(), startTime: input.startTime,
    endTime: input.endTime, capacity: input.capacity, platform: input.platform, voice: input.voice, enabled: input.enabled };
}
function occurrence(plan, day) {
  const startAt = Date.parse(`${day}T${plan.startTime}:00+08:00`);
  let endAt = Date.parse(`${day}T${plan.endTime}:00+08:00`);
  if (endAt <= startAt) endAt += DAY;
  return { startAt, endAt };
}
async function optional(ref) {
  try { return (await ref.get()).data || null; }
  catch (error) {
    if (/not exist|not found|不存在/i.test(String(error.errMsg || error.message))) return null;
    throw error;
  }
}
function createFixedTeams(db, { now = Date.now, readPlans, requireHost, onError = console.error }) {
  async function save(input, actor) {
    const plan = validatePlan(input);
    const host = await requireHost(plan.hostOpenid);
    if (host._id !== plan.hostOpenid && host._openid !== plan.hostOpenid) throw new Error('车头不存在');
    await db.runTransaction(async tx => {
      const ref = tx.collection('fixed_team_plans').doc(plan.id);
      const previous = await optional(ref);
      await ref.set({ data: { ...plan, hostNickName: host.nickName, createdAt: previous?.createdAt || now(),
        updatedAt: now(), updatedBy: actor } });
    });
    return plan.id;
  }
  async function setEnabled(id, enabled, actor) {
    if (typeof id !== 'string' || !/^[\w-]{8,64}$/.test(id) || typeof enabled !== 'boolean') throw new Error('固定车参数不正确');
    await db.runTransaction(async tx => {
      const ref = tx.collection('fixed_team_plans').doc(id);
      if (!(await optional(ref))) throw new Error('固定车计划不存在');
      await ref.update({ data: { enabled, updatedAt: now(), updatedBy: actor } });
    });
  }
  async function generate() {
    const errors = [];
    for (const candidate of await readPlans()) {
      if (!candidate.enabled) continue;
      try {
        const host = await requireHost(candidate.hostOpenid);
        // Yesterday only recovers a still-running overnight car; never backfill expired cars.
        for (const day of [dayId(now() - DAY), dayId(now())]) {
          await db.runTransaction(async tx => {
            const stored = await optional(tx.collection('fixed_team_plans').doc(candidate._id));
            if (!stored?.enabled) return;
            const plan = validatePlan(stored);
            if (plan.hostOpenid !== candidate.hostOpenid) return; // Next tick uses the new host.
            const { startAt, endAt } = occurrence(plan, day);
            if (endAt <= now() || startAt < Number(stored.createdAt)) return;
            const teamId = `fixed_${plan.id}_${day}`;
            const ref = tx.collection('teams').doc(teamId);
            if (await optional(ref)) return; // Includes cancelled cars: never resurrect today's car.
            const currentHost = await optional(tx.collection('users').doc(host._id));
            if (!currentHost?.nickName || currentHost.banned) return;
            const at = now();
            await ref.set({ data: { gameName: plan.gameName, platform: plan.platform, capacity: plan.capacity,
              zone: 'game', voice: plan.voice, startAt, endAt, expireAt: endAt, openid: plan.hostOpenid,
              groupIds: Array.isArray(currentHost.groupIds) ? [...currentHost.groupIds] : [],
              hostNickName: currentHost.nickName, hostAvatarUrl: currentHost.avatarUrl || '',
              memberCount: 1, status: 'recruiting', fixedPlanId: plan.id, fixedDayId: day,
              roomNo: '', roomPwd: '', server: '', rankReq: '', note: '', createdAt: at } });
            await tx.collection('members').doc(teamId + '_host').set({ data: { teamId, openid: plan.hostOpenid,
              role: 'host', nickName: currentHost.nickName, avatarUrl: currentHost.avatarUrl || '', joinedAt: at } });
          });
        }
      } catch (error) {
        errors.push({ id: candidate._id, message: error.message });
        onError('fixed car generation failed', candidate._id, error.message);
      }
    }
    return errors;
  }
  return { save, setEnabled, generate };
}
module.exports = { createFixedTeams, validatePlan, occurrence };
