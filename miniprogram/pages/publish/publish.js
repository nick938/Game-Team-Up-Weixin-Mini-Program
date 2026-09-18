const { isSinglePage } = require("../../utils/runtime");
const { PLATFORMS, VOICES, MAX_TEAM_HOURS } = require("../../utils/constants");
const MAX_TEAM_MS = MAX_TEAM_HOURS * 60 * 60 * 1000;
const {
  dateParts,
  combineDateTime,
  defaultStartAt,
  defaultEndAt,
} = require("../../utils/format");
const { callTeam, showError } = require("../../utils/cloud");
const { requestTeamNotify } = require("../../utils/subscribe");
const { plazaShare, bindCopyUrl, unbindCopyUrl } = require("../../utils/share");
const { teamDetailPath } = require("../../utils/team-entry");
const { GAME_CATALOG, findGame } = require("../../utils/games");
const {
  START_PRESETS,
  DURATION_PRESETS,
  sortPlatforms,
  hasExtraSettings,
  moreSettingsHint,
  nearbyStartAt,
  tonightStartAt,
  resolveStartAt,
  resolveEndAtMinutes,
  detectDurationMinutes,
  durationPresetHoursFromMinutes,
  formatDurationLabel,
  buildDurationPicker,
  buildTimeSummary,
  validatePublishTeam,
} = require("../../utils/publish-form");

const DURATION_PICKER = buildDurationPicker();
const DURATION_PICKER_LABELS = DURATION_PICKER.map((item) => item.label);
function durationPickerIndexFor(minutes) {
  const idx = DURATION_PICKER.findIndex((item) => item.minutes === minutes);
  return idx >= 0 ? idx : 0;
}

function emptyForm() {
  const startAt = defaultStartAt();
  const endAt = defaultEndAt(startAt);
  const start = dateParts(startAt);
  const end = dateParts(endAt);
  const today = dateParts(Date.now());
  const durationMinutes = detectDurationMinutes(startAt, endAt) || 120;
  const summary = buildTimeSummary({
    startDate: start.date, startTime: start.time,
    endDate: end.date, endTime: end.time,
    todayDate: today.date, startAt, endAt,
  });
  return {
    editingId: "",
    platforms: sortPlatforms("Steam", PLATFORMS),
    voices: VOICES,
    gameName: "",
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    minDate: today.date,
    startPreset: "custom",
    durationHours: durationPresetHoursFromMinutes(durationMinutes),
    durationMinutes,
    durationLabel: formatDurationLabel(durationMinutes),
    durationPickerIndex: durationPickerIndexFor(durationMinutes),
    timeSummaryLine1: summary.line1,
    timeSummaryLine2: summary.line2,
    capacity: 5,
    roomNo: "",
    roomPwd: "",
    platform: "Steam",
    server: "",
    voice: "KOOK",
    rankReq: "",
    note: "",
    moreHint: moreSettingsHint({}),
    submitting: false,
    showProfile: false,
    pendingAction: "",
    fromLast: false,
    showMore: false,
    proxyMode: false,
    proxyKeyword: "",
    proxySearching: false,
    proxyResults: [],
    proxyHost: null,
  };
}

Page({
  data: Object.assign(emptyForm(), {
    canProxy: false,
    suggestedGames: GAME_CATALOG,
    startPresets: START_PRESETS,
    durationPresets: DURATION_PRESETS,
    durationPickerLabels: DURATION_PICKER_LABELS,
  }),

  async onShow() {
    const singlePage = isSinglePage();
    this.setData({ singlePage });
    if (singlePage) return;
    bindCopyUrl(wx, () => plazaShare("开黑星球｜发起组队开黑"));
    const app = getApp();
    const editingId = app.globalData.editingTeamId;
    const draft = app.globalData.republishTeam;
    const prefill = app.globalData.prefillGame;
    if (editingId) {
      app.globalData.editingTeamId = null;
      app.globalData.republishTeam = null;
      app.globalData.prefillGame = null;
      if (this.data.editingId === editingId) return;
      await this.loadEdit(editingId);
      return;
    }
    if (draft) {
      app.globalData.republishTeam = null;
      app.globalData.prefillGame = null;
      this.applyDraft(draft);
    } else if (prefill) {
      app.globalData.prefillGame = null;
      const patch = { gameName: prefill.name || "" };
      if (prefill.platform && PLATFORMS.indexOf(prefill.platform) >= 0) {
        patch.platform = prefill.platform;
        patch.platforms = sortPlatforms(prefill.platform, PLATFORMS);
      }
      this.setData(patch);
    }
    await this.loadProxyAccess();
  },

  onHide() {
    unbindCopyUrl(wx);
  },

  onUnload() {
    this.cancelProxySearch();
    unbindCopyUrl(wx);
  },

  async loadEdit(id) {
    wx.showLoading({ title: "加载中" });
    try {
      const res = await callTeam("getTeam", { teamId: id });
      const team = res.team;
      const startAt = team.startAt;
      const endAt = team.endAt || team.expireAt || team.startAt;
      const start = dateParts(startAt);
      const end = dateParts(endAt);
      const voice = team.voice === "Discord" ? "KOOK" : team.voice;
      const platform = PLATFORMS.indexOf(team.platform) >= 0 ? team.platform : "Steam";
      const extras = {
        roomNo: team.roomNo || "",
        roomPwd: team.roomPwd || "",
        server: team.server || "",
        voice: VOICES.indexOf(voice) >= 0 ? voice : "KOOK",
        rankReq: team.rankReq || "",
        note: team.note || "",
      };
      const summary = buildTimeSummary({
        startDate: start.date, startTime: start.time,
        endDate: end.date, endTime: end.time,
        todayDate: dateParts(Date.now()).date, startAt, endAt,
      });
      const durationMinutes = detectDurationMinutes(startAt, endAt) || 120;
      this.setData({
        ...emptyForm(),
        editingId: id,
        showMore: hasExtraSettings(extras),
        gameName: team.gameName || "",
        startDate: start.date,
        startTime: start.time,
        endDate: end.date,
        endTime: end.time,
        startPreset: "custom",
        durationHours: durationPresetHoursFromMinutes(durationMinutes),
        durationMinutes,
        durationLabel: formatDurationLabel(durationMinutes),
        durationPickerIndex: durationPickerIndexFor(durationMinutes),
        timeSummaryLine1: summary.line1,
        timeSummaryLine2: summary.line2,
        capacity: team.capacity,
        platform,
        platforms: sortPlatforms(platform, PLATFORMS),
        ...extras,
        moreHint: moreSettingsHint(extras),
        canProxy: false,
        proxyMode: false,
      });
    } catch (e) {
      showError(e);
    } finally {
      wx.hideLoading();
    }
  },

  applyDraft(draft) {
    const startAt = defaultStartAt();
    const endAt = defaultEndAt(startAt);
    const start = dateParts(startAt);
    const end = dateParts(endAt);
    const today = dateParts(Date.now());
    const voice = draft.voice === "Discord" ? "KOOK" : draft.voice;
    const platform = PLATFORMS.indexOf(draft.platform) >= 0 ? draft.platform : "Steam";
    const extras = {
      roomNo: draft.roomNo || "",
      roomPwd: draft.roomPwd || "",
      server: draft.server || "",
      voice: VOICES.indexOf(voice) >= 0 ? voice : "KOOK",
      rankReq: draft.rankReq || "",
      note: draft.note || "",
    };
    const summary = buildTimeSummary({
      startDate: start.date, startTime: start.time,
      endDate: end.date, endTime: end.time,
      todayDate: today.date, startAt, endAt,
    });
    const durationMinutes = detectDurationMinutes(startAt, endAt) || 120;
    this.setData({
      ...emptyForm(),
      fromLast: true,
      showMore: hasExtraSettings(extras),
      gameName: draft.gameName || "",
      startDate: start.date,
      startTime: start.time,
      endDate: end.date,
      endTime: end.time,
      minDate: today.date,
      startPreset: "custom",
      durationHours: durationPresetHoursFromMinutes(durationMinutes),
      durationMinutes,
      durationLabel: formatDurationLabel(durationMinutes),
      durationPickerIndex: durationPickerIndexFor(durationMinutes),
      timeSummaryLine1: summary.line1,
      timeSummaryLine2: summary.line2,
      capacity: draft.capacity || 5,
      platform,
      platforms: sortPlatforms(platform, PLATFORMS),
      ...extras,
      moreHint: moreSettingsHint(extras),
    });
  },

  toggleMore() {
    this.setData({ showMore: !this.data.showMore });
  },

  applyDurationTo(patch) {
    const minutes = patch.durationMinutes != null ? patch.durationMinutes : this.data.durationMinutes;
    const startDate = patch.startDate || this.data.startDate;
    const startTime = patch.startTime || this.data.startTime;
    const endAt = resolveEndAtMinutes(combineDateTime(startDate, startTime), minutes);
    if (!endAt) return patch;
    const end = dateParts(endAt);
    patch.endDate = end.date;
    patch.endTime = end.time;
    return patch;
  },

  withTimeSummary(patch) {
    const startDate = patch.startDate || this.data.startDate;
    const startTime = patch.startTime || this.data.startTime;
    const endDate = patch.endDate || this.data.endDate;
    const endTime = patch.endTime || this.data.endTime;
    const startAt = combineDateTime(startDate, startTime);
    const endAt = combineDateTime(endDate, endTime);
    const summary = buildTimeSummary({
      startDate, startTime, endDate, endTime,
      todayDate: this.data.minDate, startAt, endAt,
    });
    patch.timeSummaryLine1 = summary.line1;
    patch.timeSummaryLine2 = summary.line2;
    return patch;
  },

  pickStartPreset(e) {
    const startPreset = e.currentTarget.dataset.key;
    if (!START_PRESETS.some((item) => item.key === startPreset)) return;
    const patch = { startPreset };
    const startAt = resolveStartAt(startPreset, Date.now(), tonightStartAt(Date.now()));
    if (startAt) {
      const start = dateParts(startAt);
      patch.startDate = start.date;
      patch.startTime = start.time;
      this.applyDurationTo(patch);
    }
    this.setData(this.withTimeSummary(patch));
  },

  pickDuration(e) {
    const durationHours = Number(e.currentTarget.dataset.hours);
    if (![1, 2, 3].includes(durationHours)) return;
    const durationMinutes = durationHours * 60;
    const patch = {
      durationHours,
      durationMinutes,
      durationLabel: formatDurationLabel(durationMinutes),
      durationPickerIndex: durationPickerIndexFor(durationMinutes),
    };
    this.applyDurationTo(patch);
    this.setData(this.withTimeSummary(patch));
  },

  // 「自定义」时长 picker：30 分钟步进，30分钟 ~ 24小时。
  pickCustomDuration(e) {
    const index = Number(e.detail.value);
    if (!Number.isFinite(index) || index < 0 || index >= DURATION_PICKER.length) return;
    const minutes = DURATION_PICKER[index].minutes;
    const patch = {
      durationHours: 0,
      durationMinutes: minutes,
      durationLabel: formatDurationLabel(minutes),
      durationPickerIndex: index,
    };
    this.applyDurationTo(patch);
    this.setData(this.withTimeSummary(patch));
  },

  onGameName(e) {
    const gameName = e.detail.value;
    const patch = { gameName };
    const game = findGame(gameName);
    if (game && game.platform) patch.platforms = sortPlatforms(game.platform, PLATFORMS);
    this.setData(patch);
  },
  pickSuggestedGame(e) {
    const game = findGame(e.currentTarget.dataset.slug);
    if (!game) return;
    const patch = { gameName: game.name };
    if (PLATFORMS.indexOf(game.platform) >= 0) {
      patch.platform = game.platform;
      patch.platforms = sortPlatforms(game.platform, PLATFORMS);
    }
    this.setData(patch);
  },
  onStartDate(e) {
    const patch = { startDate: e.detail.value, startPreset: "custom" };
    this.applyDurationTo(patch);
    this.setData(this.withTimeSummary(patch));
  },
  onStartTime(e) {
    const patch = { startTime: e.detail.value, startPreset: "custom" };
    this.applyDurationTo(patch);
    this.setData(this.withTimeSummary(patch));
  },
  decCap() {
    if (this.data.capacity <= 2) return;
    this.setData({ capacity: this.data.capacity - 1 });
  },
  incCap() {
    if (this.data.capacity >= 20) return;
    this.setData({ capacity: this.data.capacity + 1 });
  },
  patchExtras(partial) {
    const extras = {
      roomNo: this.data.roomNo,
      roomPwd: this.data.roomPwd,
      server: this.data.server,
      voice: this.data.voice,
      rankReq: this.data.rankReq,
      note: this.data.note,
      ...partial,
    };
    extras.moreHint = moreSettingsHint(extras);
    this.setData(extras);
  },
  onRoomNo(e) {
    this.patchExtras({ roomNo: e.detail.value });
  },
  onRoomPwd(e) {
    this.patchExtras({ roomPwd: e.detail.value });
  },
  pickPlatform(e) {
    this.setData({ platform: e.currentTarget.dataset.name });
  },
  onServer(e) {
    this.patchExtras({ server: e.detail.value });
  },
  pickVoice(e) {
    this.patchExtras({ voice: e.currentTarget.dataset.name });
  },
  onRank(e) {
    this.patchExtras({ rankReq: e.detail.value });
  },
  onNote(e) {
    this.patchExtras({ note: e.detail.value });
  },

  async loadProxyAccess() {
    if (this.data.editingId) {
      this.setData({ canProxy: false, proxyMode: false });
      return;
    }
    const app = getApp();
    const cached = !!(app.globalData.isAdmin || app.globalData.isOrganizer);
    if (cached) this.setData({ canProxy: true });
    try {
      const profile = await callTeam("getProfile");
      const canProxy = !!(profile.isAdmin || profile.isOrganizer);
      app.globalData.isAdmin = !!profile.isAdmin;
      app.globalData.isOrganizer = !!profile.isOrganizer;
      this.setData({ canProxy });
    } catch (e) {
      if (!cached) this.setData({ canProxy: false });
    }
  },

  cancelProxySearch() {
    if (this.proxyTimer) clearTimeout(this.proxyTimer);
    this.proxyTimer = null;
    this.proxySearchToken = (this.proxySearchToken || 0) + 1;
  },

  toggleProxy(e) {
    if (this.data.editingId || !this.data.canProxy) return;
    this.cancelProxySearch();
    const proxyMode = e.detail.value;
    this.setData({
      proxyMode,
      proxyKeyword: "",
      proxySearching: false,
      proxyResults: [],
      proxyHost: null,
    });
  },

  onProxyKeyword(e) {
    const proxyKeyword = e.detail.value;
    this.setData({ proxyKeyword });
    this.cancelProxySearch();
    const keyword = String(proxyKeyword || "").trim();
    if (!keyword) {
      this.setData({ proxyResults: [], proxySearching: false });
      return;
    }
    this.setData({ proxySearching: true, proxyResults: [] });
    this.proxyTimer = setTimeout(() => this.searchProxyUsers(keyword), 280);
  },

  async searchProxyUsers(keyword) {
    const token = (this.proxySearchToken = (this.proxySearchToken || 0) + 1);
    try {
      const res = await callTeam("searchProxyUsers", { keyword });
      if (token !== this.proxySearchToken) return;
      this.setData({ proxyResults: res.list || [], proxySearching: false });
    } catch (e) {
      if (token !== this.proxySearchToken) return;
      this.setData({ proxySearching: false, proxyResults: [] });
      showError(e);
    }
  },

  pickProxyHost(e) {
    const host = e.currentTarget.dataset.host;
    if (!host || !host.userId) return;
    this.cancelProxySearch();
    this.setData({
      proxyHost: host,
      proxyKeyword: host.nickName || "",
      proxyResults: [],
      proxySearching: false,
    });
  },

  clearProxyHost() {
    this.cancelProxySearch();
    this.setData({
      proxyHost: null,
      proxyKeyword: "",
      proxyResults: [],
      proxySearching: false,
    });
  },

  buildTeam() {
    return {
      gameName: (this.data.gameName || "").trim(),
      startAt: combineDateTime(this.data.startDate, this.data.startTime),
      endAt: combineDateTime(this.data.endDate, this.data.endTime),
      capacity: this.data.capacity,
      roomNo: (this.data.roomNo || "").trim(),
      roomPwd: (this.data.roomPwd || "").trim(),
      platform: this.data.platform,
      server: (this.data.server || "").trim(),
      voice: this.data.voice,
      rankReq: (this.data.rankReq || "").trim(),
      note: (this.data.note || "").trim(),
    };
  },

  scrollToField(id) {
    if (!id || !wx.createSelectorQuery || !wx.pageScrollTo) return;
    wx.createSelectorQuery()
      .select(`#${id}`)
      .boundingClientRect()
      .selectViewport()
      .scrollOffset()
      .exec((res) => {
        const rect = res && res[0];
        const viewport = res && res[1];
        if (!rect || !viewport) return;
        wx.pageScrollTo({
          scrollTop: Math.max(0, viewport.scrollTop + rect.top - 80),
          duration: 240,
        });
      });
  },

  async onSubmit() {
    if (this.submitting || this.data.submitting) return;
    const team = this.buildTeam();
    const error = validatePublishTeam(team, {
      maxMs: MAX_TEAM_MS,
      maxHours: MAX_TEAM_HOURS,
      now: Date.now(),
      needProxyHost: !this.data.editingId && this.data.proxyMode && !(this.data.proxyHost && this.data.proxyHost.userId),
    });
    if (error) {
      wx.showToast({ title: error.message, icon: "none" });
      this.scrollToField(error.anchor);
      return;
    }
    const editingId = this.data.editingId;
    this.submitting = true;
    this.setData({ submitting: true });
    try {
      if (!editingId) {
        await requestTeamNotify();
      }
      if (editingId) {
        await callTeam("updateTeam", { teamId: editingId, team });
        this.setData(emptyForm());
        wx.showToast({ title: "已保存", icon: "success" });
        setTimeout(() => {
          const url = teamDetailPath(editingId, { gameName: team.gameName });
          if (url) wx.navigateTo({ url });
        }, 400);
      } else {
        const payload = { team };
        if (this.data.proxyMode && this.data.proxyHost && this.data.proxyHost.userId) {
          payload.hostOpenid = this.data.proxyHost.userId;
        }
        const res = await callTeam("createTeam", payload);
        const helped = !!(payload.hostOpenid);
        this.setData(emptyForm());
        wx.showToast({ title: helped ? "已帮 TA 发车" : "已发车", icon: "success" });
        setTimeout(() => {
          const url = teamDetailPath(res.teamId, { gameName: team.gameName });
          if (url) wx.navigateTo({ url });
        }, 400);
      }
    } catch (e) {
      if (e.code === "NEED_PROFILE") {
        this.setData({ showProfile: true, pendingAction: "submit" });
      } else {
        showError(e);
      }
    } finally {
      this.submitting = false;
      this.setData({ submitting: false });
    }
  },

  onProfileClose() { this.setData({ showProfile: false, pendingAction: "" }); },

  onProfileDone(e) {
    const user = (e && e.detail && e.detail.user) || {};
    if (user.nickName) {
      const app = getApp();
      app.globalData.user = user;
    }
    this.setData({ showProfile: false });
    if (this.data.pendingAction === "submit") {
      this.setData({ pendingAction: "" });
      this.onSubmit();
    }
  },

  onShareAppMessage() {
    const share = plazaShare("开黑星球｜发起组队开黑");
    return { title: share.title, path: share.path };
  },

  onShareTimeline() {
    const share = plazaShare("开黑星球｜发起组队开黑");
    return { title: share.title, query: share.query };
  },
});
