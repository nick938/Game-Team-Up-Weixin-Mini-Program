const { createHash, randomInt } = require('node:crypto');
const games = require('./play-games.json');
const HOUR = 3600000;
// Each collection period runs from Saturday 00:00 to the following Friday 20:00, UTC+8.
function period(now = Date.now()) {
  const local = new Date(now + 8 * HOUR);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - 8 * HOUR;
  const days = (5 - local.getUTCDay() + 7) % 7;
  const startAt = midnight + days * 24 * HOUR + 21 * HOUR;
  const weekId = new Date(startAt + 8 * HOUR).toISOString().slice(0, 10);
  return { weekId, startAt, drawAt: startAt - HOUR, endAt: startAt + 2 * HOUR };
}
async function optional(ref) {
  try { return (await ref.get()).data || null; }
  catch (error) {
    if (/not exist|not found|不存在/i.test(String(error.errMsg || error.message))) return null;
    throw error;
  }
}
function createWeeklyPlay(db, { now = Date.now, pick = randomInt } = {}) {
  async function execute(openid, input) {
    const at = now();
    const current = period(at);
    const voting = input !== undefined;
    if (voting && input.weekId !== current.weekId) throw new Error('活动已更新，请刷新后再投票');
    if (voting && input.gameId !== '' && !games.some(g => g.id === input.gameId)) throw new Error('请选择游戏列表中的游戏');
    const actorId = createHash('sha256').update(JSON.stringify([current.weekId, openid])).digest('hex');
    return db.runTransaction(async tx => {
      const weekRef = tx.collection('weekly_play').doc(current.weekId);
      const ballotRef = tx.collection('play_votes').doc(actorId);
      const stored = await optional(weekRef);
      const own = await optional(ballotRef);
      const week = stored ? { ...stored } : { ...current, counts: {}, selectedGameId: '', drawnAt: 0 };
      delete week._id;
      // Decide using server time again on every transaction retry.
      const serverNow = now();
      if (period(serverNow).weekId !== current.weekId) throw new Error('活动已更新，请刷新后再试');
      const closed = serverNow >= current.drawAt;
      if (voting && (closed || period(serverNow).weekId !== current.weekId)) throw new Error('本期投票已截止，请等待下一期');
      let changed = !stored;
      let mine = own?.gameId || '';
      if (voting && mine !== input.gameId) {
        const counts = { ...week.counts };
        if (mine) counts[mine] = Math.max(0, (counts[mine] || 0) - 1);
        if (input.gameId) counts[input.gameId] = (counts[input.gameId] || 0) + 1;
        week.counts = counts;
        mine = input.gameId;
        await ballotRef.set({ data: { weekId: current.weekId, gameId: mine, updatedAt: serverNow } });
        changed = true;
      }
      if (closed && (!week.drawnAt || !week.selectedGameId)) {
        const candidates = games;
        week.selectedGameId = candidates.length ? candidates[pick(candidates.length)].id : '';
        week.drawnAt = serverNow;
        changed = true;
      }
      if (changed) await weekRef.set({ data: week });
      const selectedGame = games.find(g => g.id === week.selectedGameId) || null;
      return {
        ...current, serverNow, votingClosed: closed, mine, selectedGame,
        totalVotes: Object.values(week.counts).reduce((sum, n) => sum + Number(n), 0),
        games: games.map(g => ({ ...g, votes: week.counts[g.id] || 0 })),
      };
    });
  }
  return { get: openid => execute(openid), vote: (openid, input) => execute(openid, input) };
}
module.exports = { period, createWeeklyPlay, games };
