const { createHash, randomInt } = require('node:crypto');
const HOUR = 3600000;
const hash = (...parts) => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
const dayId = at => new Date(at + 8 * HOUR).toISOString().slice(0, 10);
function schedule(at) {
  const day = dayId(at);
  const startAt = Date.parse(`${day}T21:00:00+08:00`);
  return { dayId: day, settleAt: startAt - 5 * HOUR, startAt, endAt: startAt + 2 * HOUR };
}
async function optional(ref) {
  try { return (await ref.get()).data || null; }
  catch (error) {
    if (/not exist|not found|不存在/i.test(String(error.errMsg || error.message))) return null;
    throw error;
  }
}
const clean = row => { const { _id, ...data } = row; return data; };
const count = option => Object.keys(option.voters || {}).length;
const rank = options => [...options].sort((a, b) => count(b) - count(a) || a.createdAt - b.createdAt || a.id.localeCompare(b.id));
const normalizeGame = name => String(name || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
function createDailyPlay(db, { now = Date.now, history = async () => [], pick = randomInt } = {}) {
  async function readOptions(source, index) {
    return (await Promise.all((index?.ids || []).map(id => optional(source.collection('play_options').doc(id))))).filter(Boolean);
  }
  // Timer and page recovery share the board lock; only one pending car is created.
  async function settle() {
    const current = schedule(now());
    if (now() < current.settleAt) return;
    const existing = await optional(db.collection('daily_play').doc(current.dayId));
    if (existing?.settledAt) return;
    const past = (await history()).filter(team => !team.pendingHost && (team.openid || team._openid) &&
      team.status !== 'cancelled' && typeof team.gameName === 'string' && team.gameName.trim() &&
      ['Steam', '手游', '端游', '主机'].includes(team.platform) && Number.isInteger(team.capacity) && team.capacity >= 2 && team.capacity <= 20);
    past.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0) || String(a._id).localeCompare(String(b._id)));
    await db.runTransaction(async tx => {
      const at = now();
      if (dayId(at) !== current.dayId || at < current.settleAt) return;
      const ref = tx.collection('daily_play').doc(current.dayId);
      const stored = await optional(ref);
      if (stored?.settledAt) return;
      const index = stored ? clean(stored) : { ids: [] };
      const winner = rank(await readOptions(tx, index)).find(option => count(option) > 0);
      const fallback = !winner && past.length ? past[pick(past.length)] : null;
      const selected = winner || fallback;
      const template = winner ? past.find(team => team.platform === winner.platform && normalizeGame(team.gameName) === normalizeGame(winner.gameName)) : fallback;
      Object.assign(index, { settledAt: at, winnerId: winner?.id || '', teamId: '', source: winner ? 'vote' : fallback ? 'history' : '', selectedGame: selected ? { gameName: selected.gameName, platform: selected.platform, capacity: template?.capacity || 4 } : null, unavailableReason: '' });
      if (!selected) index.unavailableReason = '16:00时无人投票，也没有可参考的历史发车，今日未生成官方车';
      else if (at >= current.endAt) index.unavailableReason = '今晚活动已结束，未补建过期队伍';
      else {
        const teamId = 'night_' + current.dayId;
        const teamRef = tx.collection('teams').doc(teamId);
        if (!(await optional(teamRef))) await teamRef.set({ data: {
          ...index.selectedGame, startAt: current.startAt, endAt: current.endAt, expireAt: current.endAt,
          zone: 'game', dailyOptionId: winner?.id || '', dailyNightId: current.dayId, officialSource: winner ? 'champion' : 'random', pendingHost: true,
          memberCount: 0, status: 'recruiting', hostNickName: '', hostAvatarUrl: '',
          roomNo: '', roomPwd: '', server: '', voice: '不限', rankReq: '',
          note: '每日推荐局，21:00–23:00；等待首位玩家填写联系方式并完成发车。', createdAt: at,
        } });
        index.teamId = teamId;
      }
      await ref.set({ data: index });
    });
  }
  async function get(openid) {
    await settle();
    const current = schedule(now());
    const index = await optional(db.collection('daily_play').doc(current.dayId));
    const options = rank(await readOptions(db, index));
    const team = index?.teamId ? await optional(db.collection('teams').doc(index.teamId)) : null;
    return {
      ...current, serverNow: now(), votingClosed: false,
      settledAt: index?.settledAt || 0, winnerId: index?.winnerId || '', teamId: team ? index.teamId : '',
      unavailableReason: index?.unavailableReason || '', source: index?.source || '', selectedGame: index?.selectedGame || null,
      team: team ? { id: index.teamId, gameName: team.gameName, platform: team.platform, memberCount: team.memberCount,
        capacity: team.capacity, status: team.status, pendingHost: !!team.pendingHost, hostNickName: team.hostNickName, endAt: team.endAt } : null,
      options: options.map(option => ({
        id: option.id, gameName: option.gameName, platform: option.platform, createdAt: option.createdAt,
        votes: count(option), mine: !!option.voters?.[hash(openid)],
      })),
    };
  }
  // A successful write remains successful even if refreshing the board fails.
  async function refreshed(openid) {
    try { return await get(openid); }
    catch (error) { console.error('daily board refresh failed', error.message); return null; }
  }
  function assertCurrentDay(current) {
    const at = now();
    if (dayId(at) !== current.dayId) throw new Error('投票日期已更新，请刷新后再试');
  }
  // Persist the official 16:00 selection before accepting later ballots. All-day
  // votes keep the live ranking moving without rewriting that immutable selection.
  async function write(current, callback) {
    for (let attempt = 0; attempt < 2; attempt++) {
      await settle();
      try { return await db.runTransaction(callback); }
      catch (error) { if (error.code !== 'SETTLE_FIRST') throw error; }
    }
    throw new Error('官方推荐车正在生成，请稍后重试');
  }
  function assertSelection(current, index) {
    if (now() >= current.settleAt && !index?.settledAt) {
      const error = new Error('先生成16:00官方推荐');
      error.code = 'SETTLE_FIRST';
      throw error;
    }
  }
  async function create(openid, user, input) {
    const current = schedule(now());
    if (typeof input.requestId !== 'string' || !/^[\w-]{8,80}$/.test(input.requestId)) throw new Error('请重新提交选项');
    const gameName = String(input.gameName || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (!gameName || gameName.length > 40) throw new Error('游戏名称需为 1–40 字');
    if (!['Steam', '手游', '端游', '主机'].includes(input.platform)) throw new Error('请选择游戏平台');
    const id = hash(current.dayId, normalizeGame(gameName));
    await write(current, async tx => {
      assertCurrentDay(current);
      const ref = tx.collection('daily_play').doc(current.dayId);
      const stored = await optional(ref);
      const index = stored ? clean(stored) : { ids: [] };
      assertSelection(current, index);
      // Match legacy proposals too, so an upgrade does not split their votes.
      const options = await readOptions(tx, index);
      const previous = options.find(option => normalizeGame(option.gameName) === normalizeGame(gameName));
      if (previous) {
        const option = clean(previous);
        option.voters = { ...option.voters, [hash(openid)]: true };
        await tx.collection('play_options').doc(option.id).set({ data: option });
      } else {
        if (index.ids.length >= 50) throw new Error('今天的选项已满，先看看大家想玩什么吧');
        await tx.collection('play_options').doc(id).set({ data: {
          id, dayId: current.dayId, gameName, platform: input.platform, createdAt: now(), creator: openid,
          voters: { [hash(openid)]: true },
        } });
        index.ids.push(id);
      }
      // Every write touches the index; settlement and all ballots share the same lock.
      await ref.set({ data: { ...index, updatedAt: now() } });
    });
    return refreshed(openid);
  }
  async function vote(openid, user, input) {
    if (typeof input.optionId !== 'string' || !/^[a-f0-9]{64}$/.test(input.optionId)) throw new Error('选项不存在');
    if (typeof input.want !== 'boolean') throw new Error('请选择是否想玩');
    const current = schedule(now());
    await write(current, async tx => {
      assertCurrentDay(current);
      const indexRef = tx.collection('daily_play').doc(current.dayId);
      const storedIndex = await optional(indexRef);
      if (!storedIndex || !storedIndex.ids.includes(input.optionId)) throw new Error('选项已结束，请刷新后再试');
      assertSelection(current, storedIndex);
      const ref = tx.collection('play_options').doc(input.optionId);
      const stored = await optional(ref);
      if (!stored || stored.dayId !== current.dayId) throw new Error('选项已结束，请刷新后再试');
      const option = clean(stored);
      option.voters ||= {};
      if (input.want) option.voters[hash(openid)] = true;
      else delete option.voters[hash(openid)];
      await ref.set({ data: option });
      await indexRef.set({ data: { ...clean(storedIndex), updatedAt: now() } });
    });
    return { board: await refreshed(openid), teamId: '' };
  }
  return { get, create, vote, settle };
}
module.exports = { createDailyPlay, dayId, schedule };
