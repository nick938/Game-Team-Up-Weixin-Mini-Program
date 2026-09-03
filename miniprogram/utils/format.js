const { STATUS_TEXT } = require("./constants");

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatStartAt(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((day - today) / 86400000);
  if (diff === 0) {
    return `${d.getHours() < 18 ? "今天" : "今晚"} ${hm}`;
  }
  if (diff === 1) return `明天 ${hm}`;
  if (diff === -1) return `昨天 ${hm}`;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
}

function formatTimeRange(startAt, endAt) {
  const start = formatStartAt(startAt);
  if (!endAt) return start;
  const startDay = new Date(startAt).setHours(0, 0, 0, 0);
  const endDay = new Date(endAt).setHours(0, 0, 0, 0);
  const endHm = `${pad(new Date(endAt).getHours())}:${pad(
    new Date(endAt).getMinutes()
  )}`;
  if (startDay === endDay) {
    return `${start}–${endHm}`;
  }
  return `${start} – ${formatStartAt(endAt)}`;
}

function isSoon(ts) {
  const delta = ts - Date.now();
  return delta > 0 && delta <= 60 * 60 * 1000;
}

function dateParts(ts) {
  const d = new Date(ts || Date.now());
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function combineDateTime(dateStr, timeStr) {
  const [y, m, d] = (dateStr || "").split("-").map(Number);
  const [hh, mm] = (timeStr || "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

function defaultStartAt() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const minutes = d.getMinutes();
  if (minutes === 0) {
    d.setSeconds(0, 0);
  } else if (minutes <= 30) {
    d.setMinutes(30, 0, 0);
  } else {
    d.setHours(d.getHours() + 1, 0, 0, 0);
  }
  return d.getTime();
}

function defaultEndAt(startAt) {
  return (startAt || defaultStartAt()) + 2 * 60 * 60 * 1000;
}

function teamEndAt(team) {
  if (!team) return 0;
  return team.endAt || team.expireAt || team.startAt || 0;
}

function statusText(status) {
  return STATUS_TEXT[status] || status || "";
}

function decorateTeam(team) {
  if (!team) return team;
  return {
    ...team,
    timeText: formatTimeRange(team.startAt, teamEndAt(team)),
    statusText: statusText(team.displayStatus || team.status),
    soon: isSoon(team.startAt),
  };
}

module.exports = {
  formatStartAt,
  formatTimeRange,
  isSoon,
  dateParts,
  combineDateTime,
  defaultStartAt,
  defaultEndAt,
  teamEndAt,
  statusText,
  decorateTeam,
};
