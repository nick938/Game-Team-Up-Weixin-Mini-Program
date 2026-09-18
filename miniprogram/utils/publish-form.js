const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;
const MIN_DURATION_MIN = 30;
const MAX_DURATION_MIN = 24 * 60;
const MORE_HINT = "区服、语音、队友要求、房间信息、备注";

const START_PRESETS = [
  { key: "now", label: "现在" },
  { key: "tonight", label: "今晚" },
  { key: "custom", label: "自定义" },
];

const DURATION_PRESETS = [
  { hours: 1, label: "1小时" },
  { hours: 2, label: "2小时" },
  { hours: 3, label: "3小时" },
  { hours: 0, label: "自定义" },
];

const PLATFORM_ORDERS = {
  Steam: ["Steam", "端游", "主机", "手游"],
  端游: ["端游", "Steam", "主机", "手游"],
  手游: ["手游", "端游", "Steam", "主机"],
  主机: ["主机", "端游", "Steam", "手游"],
};

function sortPlatforms(preferred, all) {
  const list = (all || []).slice();
  const order = PLATFORM_ORDERS[preferred];
  if (!order) return list;
  const ranked = order.filter((item) => list.indexOf(item) >= 0);
  list.forEach((item) => {
    if (ranked.indexOf(item) < 0) ranked.push(item);
  });
  return ranked;
}

function hasExtraSettings(data) {
  if (!data) return false;
  return !!(
    String(data.roomNo || "").trim() ||
    String(data.roomPwd || "").trim() ||
    String(data.server || "").trim() ||
    String(data.rankReq || "").trim() ||
    String(data.note || "").trim()
  );
}

function moreSettingsHint(data) {
  if (!hasExtraSettings(data)) return MORE_HINT;
  const bits = [];
  if (data.voice && data.voice !== "不限") bits.push(data.voice);
  const server = String(data.server || "").trim();
  const rankReq = String(data.rankReq || "").trim();
  if (server) bits.push(server);
  if (rankReq) bits.push(rankReq);
  if (String(data.roomNo || "").trim()) bits.push("有房间信息");
  if (String(data.roomPwd || "").trim()) bits.push("有密码");
  if (String(data.note || "").trim()) bits.push("有备注");
  return bits.filter(Boolean).join(" · ") || MORE_HINT;
}

// 取当前时刻附近的整 5 分钟，给「现在」用。正好落在 5 分钟点上则不往后推。
function nearbyStartAt(nowMs) {
  const now = nowMs == null ? Date.now() : nowMs;
  const d = new Date(now);
  const leftover = d.getSeconds() * 1000 + d.getMilliseconds();
  d.setSeconds(0, 0);
  const extra = d.getMinutes() % 5;
  if (extra !== 0 || leftover > 0) {
    d.setMinutes(d.getMinutes() + (extra === 0 ? 5 : 5 - extra));
  }
  return d.getTime();
}

// 「今晚」优先当天 20:00；如果已经过了，就取当天后续最近的整点/半点；
// 当天实在没有合适晚间时间（超过 22:30）时，退回到当前时刻附近的整 5 分钟，避免落到明天。
function tonightStartAt(nowMs) {
  const now = nowMs == null ? Date.now() : nowMs;
  const base = new Date(now);
  base.setSeconds(0, 0, 0);
  const tonight20 = new Date(base);
  tonight20.setHours(20, 0, 0, 0);
  if (now <= tonight20.getTime()) return tonight20.getTime();
  // 已过 20:00，按整点/半点往后找。
  const minute = base.getMinutes();
  const step = minute <= 0 ? 30 : minute <= 30 ? 30 - minute : 60 - minute;
  const next = new Date(base);
  next.setMinutes(minute + step, 0, 0);
  // 22:30 之后的「今晚」已经不太合理，退回到当前附近时间，避免跨天。
  const cap = new Date(base);
  cap.setHours(22, 30, 0, 0);
  if (next.getTime() > cap.getTime()) {
    return nearbyStartAt(now);
  }
  return next.getTime();
}

function resolveStartAt(preset, nowMs, tonightAt) {
  if (preset === "now") return nearbyStartAt(nowMs);
  if (preset === "tonight") return tonightAt != null ? tonightAt : tonightStartAt(nowMs);
  return null;
}

function resolveEndAt(startAt, hours) {
  const n = Number(hours);
  if (!startAt || n <= 0) return null;
  return startAt + n * HOUR_MS;
}

function resolveEndAtMinutes(startAt, minutes) {
  const m = Number(minutes);
  if (!startAt || !Number.isFinite(m) || m <= 0) return null;
  if (m < MIN_DURATION_MIN || m > MAX_DURATION_MIN) return null;
  return startAt + m * MIN_MS;
}

function detectDurationHours(startAt, endAt) {
  const delta = Number(endAt) - Number(startAt);
  if (![1, 2, 3].some((h) => h * HOUR_MS === delta)) return 0;
  return delta / HOUR_MS;
}

// 把开始-结束的差值映射成分钟；必须是 30 分钟步进且在合法范围内，否则返回 null（自定义/异常）。
function detectDurationMinutes(startAt, endAt) {
  const deltaMin = Math.round((Number(endAt) - Number(startAt)) / MIN_MS);
  if (!Number.isFinite(deltaMin) || deltaMin < MIN_DURATION_MIN || deltaMin > MAX_DURATION_MIN) return null;
  if (deltaMin % MIN_DURATION_MIN !== 0) return null;
  return deltaMin;
}

// 时长（分钟）转成展示文案：30分钟 / 1小时 / 1小时30分 / 2小时 / 24小时。
function formatDurationLabel(minutes) {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m <= 0) return "";
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}分钟`;
  if (rest === 0) return `${h}小时`;
  return `${h}小时${rest}分`;
}

// 自定义时长 picker 的候选项：30分钟 ～ 24小时，步进 30 分钟。
function buildDurationPicker() {
  const list = [];
  for (let m = MIN_DURATION_MIN; m <= MAX_DURATION_MIN; m += MIN_DURATION_MIN) {
    list.push({ minutes: m, label: formatDurationLabel(m) });
  }
  return list;
}

// 给定分钟数，判断该高亮哪个 preset chip：1/2/3 小时命中则返回对应 hours，否则 0（自定义）。
function durationPresetHoursFromMinutes(minutes) {
  const m = Number(minutes);
  if (m === 60) return 1;
  if (m === 120) return 2;
  if (m === 180) return 3;
  return 0;
}

function parseDateParts(dateStr) {
  const parts = String(dateStr || "").split("-");
  if (parts.length !== 3) return null;
  return { y: Number(parts[0]), m: Number(parts[1]), d: Number(parts[2]) };
}

function dateLabel(dateStr, todayDate) {
  if (!dateStr) return "";
  if (todayDate && dateStr === todayDate) return "今天";
  const p = parseDateParts(dateStr);
  if (!p) return dateStr;
  return `${p.m}月${p.d}日`;
}

function formatDurationHours(deltaMs) {
  const hours = deltaMs / HOUR_MS;
  if (!Number.isFinite(hours) || hours <= 0) return "";
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

// 纯展示用的时间摘要，不改任何时间计算或提交逻辑。
function buildTimeSummary(input) {
  const data = input || {};
  const startDate = data.startDate || "";
  const endDate = data.endDate || "";
  const startTime = data.startTime || "";
  const endTime = data.endTime || "";
  const todayDate = data.todayDate || "";
  const startAt = Number(data.startAt) || 0;
  const endAt = Number(data.endAt) || 0;

  const sameDay = startDate && endDate && startDate === endDate;
  const startLabel = dateLabel(startDate, todayDate);

  let line1;
  if (sameDay) {
    line1 = `${startLabel} ${startTime} – ${endTime}`;
  } else {
    const endLabel = dateLabel(endDate, todayDate);
    line1 = `${startLabel} ${startTime} – ${endLabel} ${endTime}`;
  }

  const durationMin = Math.round((endAt - startAt) / MIN_MS);
  const durationLabel = formatDurationLabel(durationMin);
  const line2 = durationLabel
    ? `共 ${durationLabel} · 最长24小时`
    : "队伍最长保留24小时，到期自动结束";

  return { line1, line2 };
}

function validatePublishTeam(team, extra) {
  const opts = extra || {};
  if (!team || !String(team.gameName || "").trim()) {
    return { message: "请选择游戏", anchor: "field-game" };
  }
  if (!team.platform) {
    return { message: "请选择平台", anchor: "field-platform" };
  }
  if (!Number.isFinite(team.startAt) || team.startAt <= 0) {
    return { message: "请选择开始时间", anchor: "field-start" };
  }
  if (!Number.isFinite(team.endAt) || team.endAt <= 0) {
    return { message: "请选择结束时间", anchor: "field-end" };
  }
  if (team.endAt <= team.startAt) {
    return { message: "结束时间必须晚于开始时间", anchor: "field-end" };
  }
  const maxMs = opts.maxMs || 24 * HOUR_MS;
  if (team.endAt - team.startAt > maxMs) {
    const hours = opts.maxHours || 24;
    return { message: `队伍最长保留 ${hours} 小时`, anchor: "field-end" };
  }
  // 与云函数保持一致的前端预校验：开始时间须在 7 天内，结束时间须晚于当前。
  const now = opts.now != null ? opts.now : Date.now();
  const maxStartAheadMs = opts.maxStartAheadMs != null ? opts.maxStartAheadMs : 7 * 24 * HOUR_MS;
  if (team.startAt - now > maxStartAheadMs) {
    return { message: "开始时间请选 7 天内", anchor: "field-start" };
  }
  if (team.endAt <= now) {
    return { message: "结束时间必须晚于现在", anchor: "field-end" };
  }
  if (opts.needProxyHost) {
    return { message: "请先选择要帮谁发车", anchor: "field-proxy" };
  }
  return null;
}

module.exports = {
  HOUR_MS,
  MIN_MS,
  MIN_DURATION_MIN,
  MAX_DURATION_MIN,
  MORE_HINT,
  START_PRESETS,
  DURATION_PRESETS,
  sortPlatforms,
  hasExtraSettings,
  moreSettingsHint,
  nearbyStartAt,
  tonightStartAt,
  resolveStartAt,
  resolveEndAt,
  resolveEndAtMinutes,
  detectDurationHours,
  detectDurationMinutes,
  formatDurationLabel,
  buildDurationPicker,
  durationPresetHoursFromMinutes,
  buildTimeSummary,
  validatePublishTeam,
};
