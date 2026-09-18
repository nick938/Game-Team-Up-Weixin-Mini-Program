const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  HOUR_MS,
  MIN_MS,
  MORE_HINT,
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
  durationPresetHoursFromMinutes,
  formatDurationLabel,
  buildDurationPicker,
  buildTimeSummary,
  validatePublishTeam,
} = require("../miniprogram/utils/publish-form.js");

const ALL = ["Steam", "手游", "端游", "主机"];

test("platform order follows the game but keeps the original values", () => {
  assert.deepEqual(sortPlatforms("Steam", ALL), ["Steam", "端游", "主机", "手游"]);
  assert.deepEqual(sortPlatforms("手游", ALL), ["手游", "端游", "Steam", "主机"]);
  assert.deepEqual(sortPlatforms("端游", ALL), ["端游", "Steam", "主机", "手游"]);
  assert.deepEqual(sortPlatforms("Steam", ["Steam", "手游"]), ["Steam", "手游"]);
  assert.deepEqual(sortPlatforms("unknown", ALL), ALL);
});

test("more settings stay collapsed unless optional fields were filled", () => {
  assert.equal(hasExtraSettings({ voice: "KOOK" }), false);
  assert.equal(moreSettingsHint({ voice: "KOOK" }), MORE_HINT);
  assert.equal(
    moreSettingsHint({ voice: "KOOK", server: "欧服", rankReq: "娱乐局" }),
    "KOOK · 欧服 · 娱乐局"
  );
  assert.equal(hasExtraSettings({ roomNo: "ABC" }), true);
});

test("now / tonight / duration presets map onto startAt and endAt", () => {
  const now = new Date(2026, 8, 18, 15, 1, 20).getTime();
  const nearby = nearbyStartAt(now);
  const nearbyDate = new Date(nearby);
  assert.equal(nearbyDate.getSeconds(), 0);
  assert.equal(nearbyDate.getMinutes() % 5, 0);
  assert.ok(nearby >= now);
  assert.equal(nearbyDate.getHours(), 15);
  assert.equal(nearbyDate.getMinutes(), 5);

  const exact = new Date(2026, 8, 18, 20, 0, 0).getTime();
  assert.equal(nearbyStartAt(exact), exact);

  const tonight = new Date(2026, 8, 18, 21, 0, 0).getTime();
  assert.equal(resolveStartAt("now", now, tonight), nearby);
  assert.equal(resolveStartAt("tonight", now, tonight), tonight);
  assert.equal(resolveStartAt("custom", now, tonight), null);

  const startAt = new Date(2026, 8, 18, 20, 0, 0).getTime();
  assert.equal(resolveEndAt(startAt, 1), startAt + HOUR_MS);
  assert.equal(resolveEndAt(startAt, 2), startAt + 2 * HOUR_MS);
  assert.equal(resolveEndAt(startAt, 3), startAt + 3 * HOUR_MS);
  assert.equal(resolveEndAt(startAt, 0), null);
  assert.equal(detectDurationHours(startAt, startAt + 2 * HOUR_MS), 2);
  assert.equal(detectDurationHours(startAt, startAt + 2.5 * HOUR_MS), 0);
});

test("tonight preset prefers 20:00 today, then rolls forward to half hours", () => {
  const before = new Date(2026, 8, 18, 14, 30, 0).getTime();
  const eight = new Date(2026, 8, 18, 20, 0, 0).getTime();
  assert.equal(tonightStartAt(before), eight);

  const at20 = new Date(2026, 8, 18, 20, 0, 0).getTime();
  assert.equal(tonightStartAt(at20), eight);

  const past = new Date(2026, 8, 18, 20, 5, 0).getTime();
  const half = new Date(2026, 8, 18, 20, 30, 0).getTime();
  assert.equal(tonightStartAt(past), half);

  const past2 = new Date(2026, 8, 18, 21, 10, 0).getTime();
  const nextHour = new Date(2026, 8, 18, 21, 30, 0).getTime();
  assert.equal(tonightStartAt(past2), nextHour);

  // 太晚时不再跨天，退回到当前附近时间。
  const late = new Date(2026, 8, 18, 23, 40, 0).getTime();
  const fallback = tonightStartAt(late);
  assert.ok(fallback >= late);
  assert.ok(new Date(fallback).getDate() === 18);
});

test("publish validation keeps required fields and the 24 hour cap", () => {
  const now = new Date(2026, 8, 18, 15, 0, 0).getTime();
  const startAt = new Date(2026, 8, 18, 20, 0, 0).getTime();
  const base = {
    gameName: "CS2",
    platform: "Steam",
    startAt,
    endAt: startAt + 2 * HOUR_MS,
  };
  assert.equal(validatePublishTeam({ ...base, gameName: "" }, { now }).message, "请选择游戏");
  assert.equal(validatePublishTeam({ ...base, platform: "" }, { now }).message, "请选择平台");
  assert.equal(validatePublishTeam({ ...base, startAt: 0 }, { now }).message, "请选择开始时间");
  assert.equal(validatePublishTeam({ ...base, endAt: startAt }, { now }).message, "结束时间必须晚于开始时间");
  assert.equal(
    validatePublishTeam({ ...base, endAt: startAt + 25 * HOUR_MS }, { maxMs: 24 * HOUR_MS, maxHours: 24, now }).message,
    "队伍最长保留 24 小时"
  );
  assert.equal(validatePublishTeam({ ...base, endAt: startAt + 24 * HOUR_MS }, { maxMs: 24 * HOUR_MS, now }), null);
  assert.equal(validatePublishTeam(base, { needProxyHost: true, now }).message, "请先选择要帮谁发车");
  assert.equal(validatePublishTeam(base, { now }), null);
});

test("frontend validation mirrors cloud rules: 7-day start cap and end > now", () => {
  const now = new Date(2026, 8, 18, 15, 0, 0).getTime();
  const startAt = now + 2 * HOUR_MS;
  const base = {
    gameName: "CS2",
    platform: "Steam",
    startAt,
    endAt: startAt + 2 * HOUR_MS,
  };
  // 整段都在过去：开始 < 结束，但结束时间已不晚于现在。
  const pastWindow = { ...base, startAt: now - 3 * HOUR_MS, endAt: now - HOUR_MS };
  assert.equal(validatePublishTeam(pastWindow, { now }).message, "结束时间必须晚于现在");
  // 开始时间超过 7 天。
  const far = { ...base, startAt: now + 8 * 24 * HOUR_MS, endAt: now + 8 * 24 * HOUR_MS + HOUR_MS };
  assert.equal(validatePublishTeam(far, { now }).message, "开始时间请选 7 天内");
  // 刚好卡在 7 天内允许。
  const within7 = { ...base, startAt: now + 7 * 24 * HOUR_MS - HOUR_MS, endAt: now + 7 * 24 * HOUR_MS + HOUR_MS };
  assert.equal(validatePublishTeam(within7, { now }), null);
  // 正常情况通过。
  assert.equal(validatePublishTeam(base, { now }), null);
});

test("time summary uses 今天 / M月D日 and hides redundant dates", () => {
  const today = "2026-09-18";
  const baseSame = {
    startDate: "2026-09-18", startTime: "17:00",
    endDate: "2026-09-18", endTime: "19:00",
    todayDate: today, startAt: 0, endAt: 2 * HOUR_MS,
  };
  let s = buildTimeSummary(baseSame);
  assert.equal(s.line1, "今天 17:00 – 19:00");
  assert.equal(s.line2, "共 2小时 · 最长24小时");

  const otherDay = {
    startDate: "2026-09-19", startTime: "17:00",
    endDate: "2026-09-19", endTime: "19:00",
    todayDate: today, startAt: 0, endAt: 2 * HOUR_MS,
  };
  s = buildTimeSummary(otherDay);
  assert.equal(s.line1, "9月19日 17:00 – 19:00");

  const crossDay = {
    startDate: "2026-09-18", startTime: "23:00",
    endDate: "2026-09-19", endTime: "01:00",
    todayDate: "2026-09-17", startAt: 0, endAt: 2 * HOUR_MS,
  };
  s = buildTimeSummary(crossDay);
  assert.equal(s.line1, "9月18日 23:00 – 9月19日 01:00");
  assert.equal(s.line2, "共 2小时 · 最长24小时");

  const halfHour = {
    startDate: "2026-09-18", startTime: "17:00",
    endDate: "2026-09-18", endTime: "18:30",
    todayDate: today, startAt: 0, endAt: 1.5 * HOUR_MS,
  };
  s = buildTimeSummary(halfHour);
  assert.equal(s.line2, "共 1小时30分 · 最长24小时");
});

test("duration minutes: presets, custom picker, bounds and label", () => {
  const startAt = new Date(2026, 8, 18, 20, 0, 0).getTime();
  assert.equal(resolveEndAtMinutes(startAt, 60), startAt + HOUR_MS);
  assert.equal(resolveEndAtMinutes(startAt, 90), startAt + 90 * MIN_MS);
  assert.equal(resolveEndAtMinutes(startAt, 1440), startAt + 24 * HOUR_MS);
  // 超出 24 小时或低于 30 分钟不返回。
  assert.equal(resolveEndAtMinutes(startAt, 1500), null);
  assert.equal(resolveEndAtMinutes(startAt, 15), null);

  assert.equal(detectDurationMinutes(startAt, startAt + 60 * MIN_MS), 60);
  assert.equal(detectDurationMinutes(startAt, startAt + 90 * MIN_MS), 90);
  assert.equal(detectDurationMinutes(startAt, startAt + 24 * HOUR_MS), 1440);
  // 非 30 分钟步进 → null
  assert.equal(detectDurationMinutes(startAt, startAt + 45 * MIN_MS), null);
  // 超过 24 小时 → null
  assert.equal(detectDurationMinutes(startAt, startAt + 25 * HOUR_MS), null);

  assert.equal(formatDurationLabel(30), "30分钟");
  assert.equal(formatDurationLabel(60), "1小时");
  assert.equal(formatDurationLabel(90), "1小时30分");
  assert.equal(formatDurationLabel(120), "2小时");
  assert.equal(formatDurationLabel(180), "3小时");
  assert.equal(formatDurationLabel(1440), "24小时");

  assert.equal(durationPresetHoursFromMinutes(60), 1);
  assert.equal(durationPresetHoursFromMinutes(120), 2);
  assert.equal(durationPresetHoursFromMinutes(180), 3);
  assert.equal(durationPresetHoursFromMinutes(90), 0);
  assert.equal(durationPresetHoursFromMinutes(240), 0);

  const picker = buildDurationPicker();
  assert.equal(picker[0].minutes, 30);
  assert.equal(picker[0].label, "30分钟");
  assert.equal(picker[picker.length - 1].minutes, 1440);
  assert.equal(picker[picker.length - 1].label, "24小时");
  // 30 分钟步进，共 48 项。
  assert.equal(picker.length, 48);
});

test("editing an old team maps duration onto a preset or custom", () => {
  const startAt = new Date(2026, 8, 18, 20, 0, 0).getTime();
  // 1 小时 → preset 1
  assert.equal(durationPresetHoursFromMinutes(detectDurationMinutes(startAt, startAt + HOUR_MS)), 1);
  // 2 小时 → preset 2
  assert.equal(durationPresetHoursFromMinutes(detectDurationMinutes(startAt, startAt + 2 * HOUR_MS)), 2);
  // 3 小时 → preset 3
  assert.equal(durationPresetHoursFromMinutes(detectDurationMinutes(startAt, startAt + 3 * HOUR_MS)), 3);
  // 90 分钟 → 自定义
  const m90 = detectDurationMinutes(startAt, startAt + 90 * MIN_MS);
  assert.equal(m90, 90);
  assert.equal(durationPresetHoursFromMinutes(m90), 0);
  assert.equal(formatDurationLabel(m90), "1小时30分");
  // 4 小时 → 自定义，显示 4小时
  const m240 = detectDurationMinutes(startAt, startAt + 4 * HOUR_MS);
  assert.equal(m240, 240);
  assert.equal(durationPresetHoursFromMinutes(m240), 0);
  assert.equal(formatDurationLabel(m240), "4小时");
});
