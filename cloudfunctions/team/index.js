const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

let collectionsReady = false;

const NOTE_MAX = 80;
const ROOM_MAX = 80;
const GAME_MAX = 40;
const SERVER_MAX = 20;
const RANK_MAX = 20;
const CAP_MIN = 2;
const CAP_MAX = 20;
const MAX_TEAM_MS = 24 * 60 * 60 * 1000;
const BAD =
  /微信群|加微|加v|加V|vx\s*:|代练|外挂|脚本|出租账号|买号|卖号|色情|赌博/i;
const FEEDBACK_TO = "liuyi4781@foxmail.com";
const FEEDBACK_KINDS = ["遇到问题", "功能建议", "体验吐槽", "其他"];
const FEEDBACK_PAGES = ["大厅", "发车", "组队详情", "我的", "其他"];
const FEEDBACK_MAX = 800;
const FEEDBACK_CONTACT_MAX = 40;
const FEEDBACK_COOLDOWN_MS = 2 * 60 * 1000;

const PLATFORMS = ["Steam", "手游", "端游", "主机"];
const VOICES = ["不限", "KOOK", "游戏内语音", "开麦"];

// 与小程序 constants.js 同一模板：游戏组局即将发车
// thing5 日程标题 / time6 开始时间 / thing11 备注
const SUBSCRIBE_TMPL_ID = "6CGZ2ttjMY5Dl_PC2TrrXmrF-KT8awGU7SLPHif2EJ4";

function ok(data) {
  return { ok: true, ...(data || {}) };
}

function fail(errMsg) {
  return { ok: false, errMsg };
}

function teamExists(team) {
  return !!(team && (team.gameName || team.startAt));
}

function nowMs() {
  return Date.now();
}

function trim(value, max) {
  return String(value || "").trim().slice(0, max);
}

function teamEndAt(team) {
  if (!team) return 0;
  return Number(team.endAt || team.expireAt || team.startAt || 0);
}

function resolveStatus(team, now) {
  if (!team) return "expired";
  if (team.status === "cancelled") return "cancelled";
  if (now >= teamEndAt(team)) return "expired";
  if (team.memberCount >= team.capacity) return "full";
  return "recruiting";
}

function isOngoing(team, now) {
  const status = resolveStatus(team, now);
  return status === "recruiting" || status === "full";
}

function stripSecret(team, showPwd) {
  const copy = { ...team };
  delete copy.startRemindedOpenids;
  if (!showPwd) {
    copy.roomPwd = "";
    copy.hasPwd = !!(team.roomPwd && String(team.roomPwd).length);
  } else {
    copy.hasPwd = !!(team.roomPwd && String(team.roomPwd).length);
  }
  if (copy.voice === "Discord") copy.voice = "KOOK";
  copy.displayStatus = resolveStatus(team, nowMs());
  copy.needCount = Math.max(0, (team.capacity || 0) - (team.memberCount || 0));
  return copy;
}

function clipThing(s, max) {
  const t = String(s || "").trim() || "来开黑";
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function subscribeTime(ts) {
  const d = new Date(Number(ts) || nowMs());
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

async function sendSubscribe(touser, teamId, gameName, statusText, startAt) {
  if (!SUBSCRIBE_TMPL_ID || !touser) return "skipped";
  try {
    const user = await getUser(touser, { strict: true });
    // 偏好关闭即停止发送；它与微信侧的订阅授权是两个独立条件。
    if (user && user.notifyEnabled === false) return "skipped";
    await cloud.openapi.subscribeMessage.send({
      touser,
      templateId: SUBSCRIBE_TMPL_ID,
      page: `pages/team/detail?id=${teamId}`,
      data: {
        thing5: { value: clipThing(gameName, 20) },
        time6: { value: subscribeTime(startAt) },
        thing11: { value: clipThing(statusText, 20) },
      },
    });
    return "sent";
  } catch (e) {
    console.error("subscribe send fail", (e && (e.errCode || e.message)) || e);
    return "failed";
  }
}

async function notifyMany(openids, teamId, team, statusText) {
  const ids = [...new Set((openids || []).filter(Boolean))];
  await Promise.all(
    ids.map((id) =>
      sendSubscribe(
        id,
        teamId,
        team && team.gameName,
        statusText,
        team && team.startAt
      )
    )
  );
}

const START_REMIND_BEFORE_MS = 5 * 60 * 1000;
const START_REMIND_GRACE_MS = 2 * 60 * 1000;

async function remindStartingTeams() {
  const now = nowMs();
  const from = now - START_REMIND_GRACE_MS;
  const to = now + START_REMIND_BEFORE_MS;
  let data = [];
  try {
    const res = await db
      .collection("teams")
      .where({
        startAt: _.gte(from).and(_.lte(to)),
      })
      .limit(50)
      .get();
    data = res.data || [];
  } catch (e) {
    const res = await db.collection("teams").limit(100).get();
    data = (res.data || []).filter((t) => {
      const start = Number(t.startAt || 0);
      return start >= from && start <= to;
    });
  }
  const targets = data.filter(
    (t) =>
      isOngoing(t, now) && !t.startRemindedAt
  );
  let reminded = 0;
  for (let i = 0; i < targets.length; i += 1) {
    const team = targets[i];
    const teamId = team._id;
    if (!teamId) continue;
    try {
      const memRes = await db.collection("members").where({ teamId }).get();
      const ids = (memRes.data || [])
        .map((m) => memberUid(m))
        .filter(Boolean);
      const host = hostUid(team);
      if (host) ids.push(host);
      // 按收件人保存已处理结果（发送成功或按偏好跳过）；下一轮仅补发失败的收件人。
      const sent = new Set(team.startRemindedOpenids || []);
      const recipients = [...new Set(ids)];
      for (const uid of recipients) {
        if (sent.has(uid)) continue;
        const outcome = await sendSubscribe(
          uid, teamId, team.gameName, "即将开打，请准时上线", team.startAt
        );
        if (outcome !== "failed") {
          sent.add(uid);
          await db.collection("teams").doc(teamId).update({
            data: { startRemindedOpenids: [...sent] },
          });
        }
      }
      if (!recipients.length || !recipients.every((uid) => sent.has(uid))) continue;
      await db.collection("teams").doc(teamId).update({
        data: { startRemindedAt: now },
      });
      reminded += 1;
    } catch (e) {
      // 下一轮再试
    }
  }
  return ok({ reminded });
}

function memberUid(m) {
  return (m && (m.openid || m._openid)) || "";
}

function hostUid(team) {
  return (team && (team.openid || team._openid)) || "";
}

function memberKey(m, team) {
  const uid = memberUid(m);
  if (uid) return "id:" + uid;
  const hid = hostUid(team);
  if (
    hid &&
    m.role === "host"
  ) {
    return "id:" + hid;
  }
  return "anon:" + m._id;
}

async function persistHostOpenid(teamId, openid) {
  if (!teamId || !openid) return;
  await db.collection("teams").doc(teamId).update({
    data: { openid },
  });
}

async function isTeamHost(team, openid, teamId, members) {
  if (!team || !openid) return false;
  if (hostUid(team)) return hostUid(team) === openid;

  const id = teamId || team._id;
  let hostMem = null;
  if (members) {
    hostMem = members.find((m) => m.role === "host") || null;
  } else if (id) {
    try {
      const memRes = await db.collection("members").where({ teamId: id }).get();
      hostMem = (memRes.data || []).find((m) => m.role === "host") || null;
    } catch (e) {
      hostMem = null;
    }
  }
  if (hostMem && memberUid(hostMem) === openid) {
    await persistHostOpenid(id, openid);
    team.openid = openid;
    return true;
  }
  return false;
}

async function findMembersByOpenid(openid) {
  const seen = {};
  const out = [];
  const pushAll = (list) => {
    (list || []).forEach((m) => {
      if (!m || !m._id || seen[m._id]) return;
      seen[m._id] = true;
      out.push(m);
    });
  };
  try {
    const a = await db.collection("members").where({ _openid: openid }).get();
    pushAll(a.data);
  } catch (e) {
    // ignore
  }
  try {
    const b = await db.collection("members").where({ openid }).get();
    pushAll(b.data);
  } catch (e) {
    // ignore
  }
  return out;
}

async function ensureCollections() {
  if (collectionsReady) return;
  for (const name of ["users", "teams", "members", "feedback"]) {
    try {
      await db.createCollection(name);
    } catch (e) {
      // already exists
    }
  }
  collectionsReady = true;
}

async function getOpenid() {
  const wxContext = cloud.getWXContext();
  if (!wxContext.OPENID) {
    throw new Error("无法获取用户身份");
  }
  return wxContext.OPENID;
}

async function getUser(openid, { strict = false } = {}) {
  try {
    const res = await db.collection("users").doc(openid).get();
    if (res.data) {
      return { _id: openid, ...res.data };
    }
  } catch (e) {
    // no doc with this id yet
  }
  try {
    const res = await db
      .collection("users")
      .where({ _openid: openid })
      .limit(1)
      .get();
    return res.data[0] || null;
  } catch (e) {
    if (strict) throw e;
    return null;
  }
}

async function requireProfile(openid) {
  const user = await getUser(openid);
  if (!user || !user.nickName) {
    const err = new Error("请先填写头像和昵称");
    err.code = "NEED_PROFILE";
    throw err;
  }
  return user;
}

async function getTeamsByIds(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  const teams = [];
  for (let i = 0; i < unique.length; i += 10) {
    const part = unique.slice(i, i + 10);
    const res = await db
      .collection("teams")
      .where({ _id: _.in(part) })
      .get();
    teams.push(...res.data);
  }
  return teams;
}

function validateTeamInput(input, { isCreate }) {
  const gameName = trim(input.gameName, GAME_MAX);
  const roomNo = trim(input.roomNo, ROOM_MAX);
  const roomPwd = trim(input.roomPwd, ROOM_MAX);
  const server = trim(input.server, SERVER_MAX);
  const rankReq = trim(input.rankReq, RANK_MAX);
  const note = trim(input.note, NOTE_MAX);
  const platform = PLATFORMS.includes(input.platform)
    ? input.platform
    : "Steam";
  const voiceRaw = input.voice === "Discord" ? "KOOK" : input.voice;
  const voice = VOICES.includes(voiceRaw) ? voiceRaw : "不限";
  const capacity = Number(input.capacity);
  const startAt = Number(input.startAt);
  const endAt = Number(input.endAt);

  if (!gameName) return { error: "请填写玩什么" };
  if (!Number.isFinite(capacity) || capacity < CAP_MIN || capacity > CAP_MAX) {
    return { error: `人数需在 ${CAP_MIN}–${CAP_MAX} 之间` };
  }
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) {
    return { error: "请选择开始和结束时间" };
  }
  if (endAt <= startAt) {
    return { error: "结束时间要晚于开始时间" };
  }
  if (endAt <= nowMs()) {
    return { error: "结束时间必须晚于现在" };
  }
  if (endAt - startAt > MAX_TEAM_MS) {
    return { error: "一局最长 24 小时" };
  }
  const text = `${gameName}${roomNo}${roomPwd}${server}${rankReq}${note}`;
  if (BAD.test(text)) {
    return { error: "内容包含不允许发布的信息" };
  }
  if (isCreate && startAt - nowMs() > 7 * 24 * 60 * 60 * 1000) {
    return { error: "开始时间请选 7 天内" };
  }
  return {
    value: {
      gameName,
      roomNo,
      roomPwd,
      server,
      rankReq,
      note,
      platform,
      voice,
      capacity,
      startAt,
      endAt,
      expireAt: endAt,
      zone: "game",
    },
  };
}

const PUBLIC_PROFILE_FIELDS = {
  steamFriendCode: { max: 20, label: "Steam 好友代码" },
  gameId: { max: 40, label: "游戏内 ID" },
  kookId: { max: 40, label: "KOOK ID" },
  bio: { max: 80, label: "个人简介" },
};

function validatePublicProfile(event) {
  const value = {};
  for (const [key, rule] of Object.entries(PUBLIC_PROFILE_FIELDS)) {
    // 老版本只保存昵称头像时，保留已填写的公开资料；空字符串表示主动清空。
    if (!Object.prototype.hasOwnProperty.call(event, key)) continue;
    if (typeof event[key] !== "string") return { error: `${rule.label}格式不正确` };
    const text = event[key].trim();
    if (text.length > rule.max) return { error: `${rule.label}最多 ${rule.max} 字` };
    if (key === "steamFriendCode" && text && !/^\d+$/.test(text)) {
      return { error: "Steam 好友代码请填写数字" };
    }
    if (key !== "steamFriendCode" && BAD.test(text)) return { error: `${rule.label}包含不支持的内容` };
    value[key] = text;
  }
  return { value };
}

function publicProfile(user, member) {
  // 仅返回明确公开的字段，不透传 OpenID、提醒偏好或其他账户信息。
  const profile = {
    nickName: (user && user.nickName) || member.nickName || "玩家",
    avatarUrl: (user && user.avatarUrl) || member.avatarUrl || "",
  };
  for (const key of Object.keys(PUBLIC_PROFILE_FIELDS)) {
    profile[key] = (user && typeof user[key] === "string") ? user[key] : "";
  }
  return profile;
}

async function getPublicProfile(event) {
  const { teamId, memberId } = event;
  if (typeof teamId !== "string" || !teamId || typeof memberId !== "string" || !memberId) {
    return fail("缺少队伍或成员");
  }
  const team = (await db.collection("teams").doc(teamId).get()).data;
  if (!teamExists(team)) return fail("队伍不存在");
  const member = (await db.collection("members").doc(memberId).get()).data;
  if (!member || member.teamId !== teamId) return fail("该成员已不在这趟车上");
  const uid = memberUid(member) || (member.role === "host" ? hostUid(team) : "");
  const user = uid ? await getUser(uid, { strict: true }) : null;
  return ok({ profile: publicProfile(user, member) });
}

async function saveProfile(event, openid) {
  const nickName = trim(event.nickName, 32);
  const avatarUrl = trim(event.avatarUrl, 1000);
  if (!nickName) return fail("请填写昵称");
  const checked = validatePublicProfile(event);
  if (checked.error) return fail(checked.error);
  const existed = await getUser(openid);
  const payload = {
    ...checked.value,
    nickName,
    avatarUrl: avatarUrl || (existed && existed.avatarUrl) || "",
    updatedAt: nowMs(),
  };
  const id = existed ? existed._id : openid;
  if (existed) {
    await db.collection("users").doc(id).update({ data: payload });
  } else {
    await db.collection("users").doc(id).set({ data: { ...payload, _openid: openid } });
  }
  return ok({ user: { ...existed, ...payload, _id: id, _openid: openid } });
}

async function saveNotifyPreference(event, openid) {
  if (typeof event.enabled !== "boolean") return fail("提醒设置无效");
  const existed = await getUser(openid);
  const id = existed ? existed._id : openid;
  const payload = { notifyEnabled: event.enabled, updatedAt: nowMs() };
  if (existed) {
    await db.collection("users").doc(id).update({ data: payload });
  } else {
    await db.collection("users").doc(id).set({ data: { ...payload, _openid: openid } });
  }
  return ok({ user: { ...existed, ...payload, _id: id, _openid: openid } });
}

async function getProfile(openid) {
  const user = await getUser(openid);
  return ok({ user: user || null });
}

async function createTeam(event, openid) {
  const user = await requireProfile(openid);
  const checked = validateTeamInput(event.team || {}, { isCreate: true });
  if (checked.error) return fail(checked.error);

  const teamData = {
    ...checked.value,
    openid,
    memberCount: 1,
    status: "recruiting",
    hostNickName: user.nickName,
    hostAvatarUrl: user.avatarUrl || "",
    createdAt: nowMs(),
  };

  const addRes = await db.collection("teams").add({ data: teamData });
  const teamId = addRes._id;
  await db.collection("members").add({
    data: {
      teamId,
      openid,
      role: "host",
      nickName: user.nickName,
      avatarUrl: user.avatarUrl || "",
      joinedAt: nowMs(),
    },
  });

  return ok({ teamId });
}

async function updateTeam(event, openid) {
  await requireProfile(openid);
  const teamId = event.teamId;
  if (!teamId) return fail("缺少队伍");
  const teamRes = await db.collection("teams").doc(teamId).get();
  const team = teamRes.data;
  if (!teamExists(team)) return fail("队伍不存在");
  if (!(await isTeamHost(team, openid, teamId))) {
    return fail("只有车头可以编辑");
  }
  if (!isOngoing(team, nowMs())) return fail("队伍已结束，不能再改");

  const checked = validateTeamInput(
    { ...team, ...(event.team || {}) },
    { isCreate: false }
  );
  if (checked.error) return fail(checked.error);
  if (checked.value.capacity < team.memberCount) {
    return fail("人数不能少于当前已加入人数");
  }

  const nextStatus =
    checked.value.capacity <= team.memberCount ? "full" : "recruiting";

  await db.collection("teams").doc(teamId).update({
    data: {
      ...checked.value,
      status: nextStatus,
    },
  });
  return ok();
}

async function cancelTeam(event, openid) {
  const teamId = event.teamId;
  const teamRes = await db.collection("teams").doc(teamId).get();
  const team = teamRes.data;
  if (!teamExists(team)) return fail("队伍不存在");
  if (!(await isTeamHost(team, openid, teamId))) {
    return fail("只有车头可以散了这趟");
  }
  if (team.status === "cancelled") return fail("已经散了");
  if (nowMs() >= teamEndAt(team)) return fail("已经结束，不用散");

  await db.collection("teams").doc(teamId).update({
    data: { status: "cancelled" },
  });
  try {
    const memRes = await db.collection("members").where({ teamId }).get();
    const others = (memRes.data || [])
      .map((m) => memberUid(m))
      .filter((id) => id && id !== openid);
    await notifyMany(others, teamId, team, "这趟已经散了");
  } catch (e) {
    // 通知失败不影响散局
  }
  return ok();
}

async function joinTeam(event, openid) {
  const user = await requireProfile(openid);
  const teamId = event.teamId;
  if (!teamId) return fail("缺少队伍");
  try {
    const peek = await db.collection("teams").doc(teamId).get();
    if (peek.data && (await isTeamHost(peek.data, openid, teamId))) {
      return fail("你已经是车头，不用再上车");
    }
  } catch (e) {
    // 事务里会再校验
  }

  let joinedTeam = null;
  try {
    await db.runTransaction(async (transaction) => {
      const teamRes = await transaction.collection("teams").doc(teamId).get();
      const team = teamRes.data;
      if (!teamExists(team)) throw new Error("队伍不存在");
      if (team.status === "cancelled") throw new Error("这趟已经散了");
      if (nowMs() >= teamEndAt(team)) throw new Error("已经结束，不能上车");
      if (hostUid(team) === openid) {
        throw new Error("你已经是车头，不用再上车");
      }
      const exist = await transaction.collection("members").where({ teamId }).get();
      if (exist.data.some((m) => memberUid(m) === openid)) {
        throw new Error("你已经在车上了");
      }
      if (team.memberCount >= team.capacity) throw new Error("人已经满了");

      const nextCount = team.memberCount + 1;
      await transaction.collection("members").add({
        data: {
          teamId,
          openid,
          role: "member",
          nickName: user.nickName,
          avatarUrl: user.avatarUrl || "",
          joinedAt: nowMs(),
        },
      });
      const nextStatus = nextCount >= team.capacity ? "full" : "recruiting";
      await transaction.collection("teams").doc(teamId).update({
        data: {
          memberCount: nextCount,
          status: nextStatus,
        },
      });
      joinedTeam = {
        ...team,
        memberCount: nextCount,
        status: nextStatus,
      };
    });
  } catch (e) {
    return fail(e.message || "上车失败");
  }
  if (joinedTeam) {
    const host = hostUid(joinedTeam);
    if (host && host !== openid) {
      const text =
        joinedTeam.status === "full" ? "人已经齐了" : "有人上车了";
      await sendSubscribe(
        host,
        teamId,
        joinedTeam.gameName,
        text,
        joinedTeam.startAt
      );
    }
  }
  return ok();
}

async function leaveTeam(event, openid) {
  const teamId = event.teamId;
  try {
    const peek = await db.collection("teams").doc(teamId).get();
    if (peek.data && (await isTeamHost(peek.data, openid, teamId))) {
      return fail("车头不能下车，请散了这趟");
    }
  } catch (e) {
    // 事务里会再校验
  }
  try {
    await db.runTransaction(async (transaction) => {
      const teamRes = await transaction.collection("teams").doc(teamId).get();
      const team = teamRes.data;
      if (!teamExists(team)) throw new Error("队伍不存在");
      if (hostUid(team) === openid) {
        throw new Error("车头不能下车，请散了这趟");
      }
      if (!isOngoing(team, nowMs())) throw new Error("队伍已结束");

      const mem = await transaction.collection("members").where({ teamId }).get();
      const mineList = mem.data.filter((m) => memberUid(m) === openid);
      if (!mineList.length) throw new Error("你不在这趟车上");

      for (let i = 0; i < mineList.length; i += 1) {
        await transaction.collection("members").doc(mineList[i]._id).remove();
      }
      const nextCount = Math.max(1, team.memberCount - mineList.length);
      await transaction.collection("teams").doc(teamId).update({
        data: {
          memberCount: nextCount,
          status: nextCount >= team.capacity ? "full" : "recruiting",
        },
      });
    });
  } catch (e) {
    return fail(e.message || "下车失败");
  }
  return ok();
}

async function kickMember(event, openid) {
  const teamId = event.teamId;
  const targetOpenid = event.openid;
  if (!targetOpenid) return fail("缺少成员");
  try {
    const peek = await db.collection("teams").doc(teamId).get();
    if (!peek.data || !(await isTeamHost(peek.data, openid, teamId))) {
      return fail("只有车头可以踢人");
    }
  } catch (e) {
    return fail(e.message || "踢人失败");
  }
  try {
    await db.runTransaction(async (transaction) => {
      const teamRes = await transaction.collection("teams").doc(teamId).get();
      const team = teamRes.data;
      if (!teamExists(team)) throw new Error("队伍不存在");
      if (hostUid(team) && hostUid(team) !== openid) {
        throw new Error("只有车头可以踢人");
      }
      if (targetOpenid === openid) throw new Error("不能踢自己");
      if (!isOngoing(team, nowMs())) throw new Error("队伍已结束");

      const mem = await transaction.collection("members").where({ teamId }).get();
      const targets = mem.data.filter((m) => memberUid(m) === targetOpenid);
      if (!targets.length) throw new Error("对方不在队伍里");

      for (let i = 0; i < targets.length; i += 1) {
        await transaction.collection("members").doc(targets[i]._id).remove();
      }
      const nextCount = Math.max(1, team.memberCount - targets.length);
      await transaction.collection("teams").doc(teamId).update({
        data: {
          memberCount: nextCount,
          status: nextCount >= team.capacity ? "full" : "recruiting",
        },
      });
    });
  } catch (e) {
    return fail(e.message || "踢人失败");
  }
  try {
    const teamRes = await db.collection("teams").doc(teamId).get();
    await sendSubscribe(
      targetOpenid,
      teamId,
      teamRes.data && teamRes.data.gameName,
      "你被请下车了",
      teamRes.data && teamRes.data.startAt
    );
  } catch (e) {
    // 通知失败不影响踢人
  }
  return ok();
}

async function backfillMemberOpenid(members, team) {
  const jobs = (members || [])
    .filter((m) => m && m._id && !m.openid)
    .map((m) => {
      const uid =
        memberUid(m) ||
        (team &&
        m.role === "host"
          ? hostUid(team)
          : "");
      if (!uid) return null;
      return db.collection("members").doc(m._id).update({
        data: { openid: uid },
      });
    })
    .filter(Boolean);
  if (jobs.length) await Promise.all(jobs);
}

async function dedupeTeamMembers(teamId, team, list) {
  const data = list || [];
  const groups = {};
  data.forEach((m) => {
    const key = memberKey(m, team);
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  });
  const toDelete = [];
  const kept = [];
  Object.keys(groups).forEach((key) => {
    const listGroup = groups[key].slice().sort((a, b) => {
      if (a.role === "host") return -1;
      if (b.role === "host") return 1;
      return (a.joinedAt || 0) - (b.joinedAt || 0);
    });
    kept.push(listGroup[0]);
    toDelete.push(...listGroup.slice(1));
  });
  if (toDelete.length) {
    await Promise.all(
      toDelete.map((m) => db.collection("members").doc(m._id).remove())
    );
    const left = kept.length;
    const nextStatus =
      team.status === "cancelled"
        ? "cancelled"
        : left >= team.capacity
        ? "full"
        : "recruiting";
    await db.collection("teams").doc(teamId).update({
      data: {
        memberCount: left,
        status: nextStatus,
      },
    });
  }
  const needBackfill = kept.some((m) => m && m._id && !m.openid);
  if (needBackfill) await backfillMemberOpenid(kept, team);
  return { repaired: toDelete.length > 0, kept };
}

async function getTeam(event, openid) {
  const teamId = event.teamId;
  if (!teamId) return fail("缺少队伍");
  let team;
  try {
    const teamRes = await db.collection("teams").doc(teamId).get();
    team = teamRes.data;
  } catch (e) {
    return fail("队伍不存在");
  }
  if (!teamExists(team)) return fail("队伍不存在");

  let memList = (await db.collection("members").where({ teamId }).get()).data;
  const { repaired, kept } = await dedupeTeamMembers(teamId, team, memList);
  memList = kept;
  if (repaired) {
    const teamRes = await db.collection("teams").doc(teamId).get();
    team = teamRes.data;
  }

  const members = memList
    .slice()
    .sort((a, b) => {
      if (a.role === "host") return -1;
      if (b.role === "host") return 1;
      return (a.joinedAt || 0) - (b.joinedAt || 0);
    })
    .map((m) => ({
      _id: m._id,
      openid: memberUid(m) || (m.role === "host" ? hostUid(team) : ""),
      role: m.role,
      nickName: m.nickName,
      avatarUrl: m.avatarUrl,
      joinedAt: m.joinedAt,
    }));
  const mine = members.find((m) => m.openid === openid);
  const owner = await isTeamHost(team, openid, teamId, memList);
  const role = owner ? "host" : mine ? "member" : null;
  const displayStatus = resolveStatus(team, nowMs());
  const showPwd = owner || (!!mine && displayStatus !== "cancelled");

  return ok({
    team: stripSecret(team, showPwd),
    members,
    role,
    openid,
  });
}

async function listTeams(event, openid) {
  const now = nowMs();
  let data = [];
  try {
    const res = await db
      .collection("teams")
      .where({
        endAt: _.gt(now),
      })
      .orderBy("endAt", "asc")
      .limit(50)
      .get();
    data = res.data;
  } catch (e) {
    const res = await db.collection("teams").limit(80).get();
    data = res.data.filter((t) => teamEndAt(t) > now);
  }
  const mems = openid ? await findMembersByOpenid(openid) : [];
  const roleByTeam = {};
  mems.forEach((m) => {
    if (!m.teamId) return;
    if (m.role === "host") roleByTeam[m.teamId] = "host";
    else if (!roleByTeam[m.teamId]) roleByTeam[m.teamId] = "member";
  });
  const list = data
    .filter((t) => t.status === "recruiting" || t.status === "full")
    .map((t) => {
      const row = stripSecret(t, false);
      const role = roleByTeam[t._id];
      if (role === "host") row.mark = "我发的";
      else if (role) row.mark = "已上车";
      return row;
    });
  list.sort((a, b) => {
    const ar = a.displayStatus === "recruiting" ? 0 : 1;
    const br = b.displayStatus === "recruiting" ? 0 : 1;
    if (ar !== br) return ar - br;
    return teamEndAt(a) - teamEndAt(b);
  });
  return ok({ list });
}

async function myTeams(openid) {
  const mems = await findMembersByOpenid(openid);
  if (!mems.length) {
    return ok({ hosted: [], joined: [] });
  }
  const ids = mems.map((m) => m.teamId);
  const teamList = await getTeamsByIds(ids);
  const teamMap = {};
  teamList.forEach((t) => {
    teamMap[t._id] = stripSecret(t, false);
  });
  const hosted = [];
  const joined = [];
  mems
    .slice()
    .sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0))
    .forEach((m) => {
    const team = teamMap[m.teamId];
    if (!team) return;
    if (m.role === "host") hosted.push(team);
    else joined.push(team);
  });
  return ok({ hosted, joined });
}

function readEnv(name) {
  try {
    return String((process.env || {})[name] || "");
  } catch (e) {
    return "";
  }
}

function loadMailSecrets() {
  let local = {};
  try {
    const loaded = require("./mail.local");
    if (loaded && typeof loaded === "object" && !loaded.database) local = loaded;
  } catch (e) {
    // 没有本地密钥文件就只用环境变量
  }
  return {
    to: (readEnv("FEEDBACK_TO") || local.FEEDBACK_TO || FEEDBACK_TO).trim(),
    host: (readEnv("SMTP_HOST") || local.SMTP_HOST || "smtp.qq.com").trim(),
    port: Number(readEnv("SMTP_PORT") || local.SMTP_PORT || 465),
    user: (readEnv("SMTP_USER") || local.SMTP_USER || FEEDBACK_TO).trim().toLowerCase(),
    pass: String(readEnv("SMTP_PASS") || local.SMTP_PASS || "").replace(/\s+/g, ""),
  };
}

function feedbackFilled(text) {
  const stripped = String(text || "")
    .replace(/【我遇到的情况】/g, "")
    .replace(/【我希望怎样】/g, "")
    .replace(/\s/g, "");
  return stripped.length >= 4;
}

function explainMailError(err) {
  const msg = String((err && (err.response || err.message)) || err || "");
  if (/535|authentication failed|Invalid login/i.test(msg)) {
    return "邮箱认证失败。SMTP_PASS 必须是 QQ 邮箱生成的授权码，不是登录密码。在 foxmail.com 设置里开启 SMTP 后重新上传云函数。";
  }
  if (/ETIMEDOUT|ECONNECTION|ESOCKET|timeout/i.test(msg)) {
    return "云函数连不上 QQ 发信服务器，请确认已上传 mail.local.js 并勾选云端安装依赖。";
  }
  return msg.slice(0, 120) || "发信失败";
}

function createMailTransport(nodemailer, mail) {
  return nodemailer.createTransport({
    host: mail.host,
    port: mail.port,
    secure: mail.port === 465,
    requireTLS: mail.port === 587,
    tls: { minVersion: "TLSv1.2" },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 15000,
    auth: { user: mail.user, pass: mail.pass },
  });
}

async function sendFeedbackMail({ kind, page, content, contact, nickName, version, envVersion, openid }) {
  const mail = loadMailSecrets();
  if (!mail.pass || !mail.user || !mail.host) {
    return { status: "skipped", error: "未配置发信授权码。请在 mail.local.js 填写 QQ 邮箱授权码后重新上传云函数。" };
  }
  let nodemailer;
  try {
    nodemailer = require("nodemailer");
  } catch (e) {
    return { status: "skipped", error: "云函数未安装发信组件。请右键 team → 上传并部署：云端安装依赖。" };
  }
  if (!nodemailer || typeof nodemailer.createTransport !== "function") {
    return { status: "skipped", error: "云函数未安装发信组件。请右键 team → 上传并部署：云端安装依赖。" };
  }
  const lines = [
    `类型：${kind}`,
    `页面：${page}`,
    `版本：${version || "未知"}${envVersion ? ` · ${envVersion}` : ""}`,
    `昵称：${nickName || "未填写"}`,
    `OpenID：${openid}`,
    contact ? `联系方式：${contact}` : "联系方式：未填",
    "",
    content,
  ];
  try {
    await createMailTransport(nodemailer, mail).sendMail({
      from: `"来开黑反馈" <${mail.user}>`,
      to: mail.to,
      subject: `【来开黑反馈】${kind} · ${nickName || "未命名用户"}`,
      text: lines.join("\n"),
    });
    return { status: "sent" };
  } catch (e) {
    console.error("feedback mail fail", (e && (e.code || e.message)) || e);
    return { status: "failed", error: explainMailError(e) };
  }
}

async function submitFeedback(event, openid) {
  const kind = FEEDBACK_KINDS.includes(event.kind) ? event.kind : "";
  const page = FEEDBACK_PAGES.includes(event.page) ? event.page : "";
  const content = trim(event.content, FEEDBACK_MAX);
  const contact = trim(event.contact, FEEDBACK_CONTACT_MAX);
  const version = trim(event.version, 20);
  const envVersion = trim(event.envVersion, 20);
  if (!kind) return fail("请选择反馈类型");
  if (!page) return fail("请选择发生页面");
  if (!feedbackFilled(content)) return fail("请把遇到的情况写具体一点");
  if (BAD.test(`${content}${contact}`)) return fail("内容包含不允许提交的信息");

  try {
    const recent = await db
      .collection("feedback")
      .where({ _openid: openid })
      .limit(20)
      .get();
    const last = (recent.data || [])
      .slice()
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];
    if (last && nowMs() - Number(last.createdAt || 0) < FEEDBACK_COOLDOWN_MS) {
      return fail("刚刚已经收到一封，请稍后再写");
    }
  } catch (e) {
    // 集合尚未建好时继续提交
  }

  const user = await getUser(openid);
  const payload = {
    openid,
    _openid: openid,
    kind,
    page,
    content,
    contact,
    nickName: (user && user.nickName) || "",
    version,
    envVersion,
    createdAt: nowMs(),
    mailed: false,
    mailError: "",
  };
  let result = { status: "skipped", error: "未尝试发信" };
  try {
    result = await sendFeedbackMail({ ...payload, nickName: payload.nickName });
  } catch (e) {
    result = { status: "failed", error: explainMailError(e) };
  }
  payload.mailed = result.status === "sent";
  payload.mailError = result.error || "";
  await db.collection("feedback").add({ data: payload });
  return ok({ mailed: payload.mailed, mailError: payload.mailError });
}

exports.main = async (event) => {
  try {
    await ensureCollections();
    if (event && (event.TriggerName === "startRemind" || event.Type === "Timer")) {
      return await remindStartingTeams();
    }
    const openid = await getOpenid();
    switch (event.type) {
      case "saveProfile":
        return await saveProfile(event, openid);
      case "saveNotifyPreference":
        return await saveNotifyPreference(event, openid);
      case "getPublicProfile":
        return await getPublicProfile(event);
      case "getProfile":
        return await getProfile(openid);
      case "createTeam":
        return await createTeam(event, openid);
      case "updateTeam":
        return await updateTeam(event, openid);
      case "cancelTeam":
        return await cancelTeam(event, openid);
      case "joinTeam":
        return await joinTeam(event, openid);
      case "leaveTeam":
        return await leaveTeam(event, openid);
      case "kickMember":
        return await kickMember(event, openid);
      case "getTeam":
        return await getTeam(event, openid);
      case "listTeams":
        return await listTeams(event, openid);
      case "myTeams":
        return await myTeams(openid);
      case "submitFeedback":
        return await submitFeedback(event, openid);
      default:
        return fail("未知操作");
    }
  } catch (e) {
    if (e.code === "NEED_PROFILE") {
      return { ok: false, errMsg: e.message, code: "NEED_PROFILE" };
    }
    return fail(e.message || "服务异常");
  }
};