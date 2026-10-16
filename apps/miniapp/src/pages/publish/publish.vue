<script>
import { eventWithDataset } from "../../utils/state";
import { platform } from "../../platform/host";
import { getApplication } from "../../stores/app";
import { updateState } from "../../utils/state";
import { isSinglePage } from "../../utils/runtime";
import { PLATFORMS, VOICES, MAX_TEAM_HOURS } from "../../utils/constants";
const MAX_TEAM_MS = MAX_TEAM_HOURS * 60 * 60 * 1000;
import {
  dateParts,
  combineDateTime,
  defaultStartAt,
  defaultEndAt,
} from "../../utils/format";
import { callTeam, showError } from "../../utils/cloud";
import { requestTeamNotify } from "../../utils/subscribe";
import { plazaShare, bindCopyUrl, unbindCopyUrl, shareToFriend, shareToTimeline } from "../../utils/share";
import { teamDetailPath } from "../../utils/team-entry";
import { GAME_CATALOG, findGame } from "../../utils/games";
import {
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
} from "../../utils/publish-form";

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

export default {
 data() { return { singlePage: false, ...Object.assign(emptyForm(), {
    canProxy: false,
    suggestedGames: GAME_CATALOG,
    startPresets: START_PRESETS,
    durationPresets: DURATION_PRESETS,
    durationPickerLabels: DURATION_PICKER_LABELS,
  }) }; },
async onShow() {
    const singlePage = isSinglePage();
    this.setData({ singlePage });
    if (singlePage) return;
    bindCopyUrl(platform, () => plazaShare("开黑星球｜发起组队开黑"));
    const app = getApplication();
    const editingId = app.globalData.editingTeamId;
    const draft = app.globalData.republishTeam;
    const prefill = app.globalData.prefillGame;
    if (editingId) {
      app.globalData.editingTeamId = null;
      app.globalData.republishTeam = null;
      app.globalData.prefillGame = null;
      if (this.editingId === editingId) return;
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
    unbindCopyUrl(platform);
  },
onUnload() {
    this.cancelProxySearch();
    unbindCopyUrl(platform);
  },
onShareAppMessage() {
    return shareToFriend(plazaShare("开黑星球｜发起组队开黑"));
  },
onShareTimeline() {
    return shareToTimeline(plazaShare("开黑星球｜发起组队开黑"));
  },
methods: { eventWithDataset, setData: updateState,
async loadEdit(id) {
    platform.showLoading({ title: "加载中" });
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
      platform.hideLoading();
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
    this.setData({ showMore: !this.showMore });
  },
applyDurationTo(patch) {
    const minutes = patch.durationMinutes != null ? patch.durationMinutes : this.durationMinutes;
    const startDate = patch.startDate || this.startDate;
    const startTime = patch.startTime || this.startTime;
    const endAt = resolveEndAtMinutes(combineDateTime(startDate, startTime), minutes);
    if (!endAt) return patch;
    const end = dateParts(endAt);
    patch.endDate = end.date;
    patch.endTime = end.time;
    return patch;
  },
withTimeSummary(patch) {
    const startDate = patch.startDate || this.startDate;
    const startTime = patch.startTime || this.startTime;
    const endDate = patch.endDate || this.endDate;
    const endTime = patch.endTime || this.endTime;
    const startAt = combineDateTime(startDate, startTime);
    const endAt = combineDateTime(endDate, endTime);
    const summary = buildTimeSummary({
      startDate, startTime, endDate, endTime,
      todayDate: this.minDate, startAt, endAt,
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
    if (this.capacity <= 2) return;
    this.setData({ capacity: this.capacity - 1 });
  },
incCap() {
    if (this.capacity >= 20) return;
    this.setData({ capacity: this.capacity + 1 });
  },
patchExtras(partial) {
    const extras = {
      roomNo: this.roomNo,
      roomPwd: this.roomPwd,
      server: this.server,
      voice: this.voice,
      rankReq: this.rankReq,
      note: this.note,
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
    if (this.editingId) {
      this.setData({ canProxy: false, proxyMode: false });
      return;
    }
    const app = getApplication();
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
    if (this.editingId || !this.canProxy) return;
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
      gameName: (this.gameName || "").trim(),
      startAt: combineDateTime(this.startDate, this.startTime),
      endAt: combineDateTime(this.endDate, this.endTime),
      capacity: this.capacity,
      roomNo: (this.roomNo || "").trim(),
      roomPwd: (this.roomPwd || "").trim(),
      platform: this.platform,
      server: (this.server || "").trim(),
      voice: this.voice,
      rankReq: (this.rankReq || "").trim(),
      note: (this.note || "").trim(),
    };
  },
scrollToField(id) {
    if (!id || !platform.createSelectorQuery || !platform.pageScrollTo) return;
    platform.createSelectorQuery()
      .select(`#${id}`)
      .boundingClientRect()
      .selectViewport()
      .scrollOffset()
      .exec((res) => {
        const rect = res && res[0];
        const viewport = res && res[1];
        if (!rect || !viewport) return;
        platform.pageScrollTo({
          scrollTop: Math.max(0, viewport.scrollTop + rect.top - 80),
          duration: 240,
        });
      });
  },
async onSubmit() {
    if (this.submitting || this.submitting) return;
    const team = this.buildTeam();
    const error = validatePublishTeam(team, {
      maxMs: MAX_TEAM_MS,
      maxHours: MAX_TEAM_HOURS,
      now: Date.now(),
      needProxyHost: !this.editingId && this.proxyMode && !(this.proxyHost && this.proxyHost.userId),
    });
    if (error) {
      platform.showToast({ title: error.message, icon: "none" });
      this.scrollToField(error.anchor);
      return;
    }
    const editingId = this.editingId;
    this.submitting = true;
    this.setData({ submitting: true });
    try {
      if (!editingId) {
        await requestTeamNotify();
      }
      if (editingId) {
        await callTeam("updateTeam", { teamId: editingId, team });
        this.setData(emptyForm());
        platform.showToast({ title: "已保存", icon: "success" });
        setTimeout(() => {
          const url = teamDetailPath(editingId, { gameName: team.gameName });
          if (url) platform.navigateTo({ url });
        }, 400);
      } else {
        const payload = { team };
        if (this.proxyMode && this.proxyHost && this.proxyHost.userId) {
          payload.hostOpenid = this.proxyHost.userId;
        }
        const res = await callTeam("createTeam", payload);
        const helped = !!(payload.hostOpenid);
        this.setData(emptyForm());
        platform.showToast({ title: helped ? "已帮 TA 发车" : "已发车", icon: "success" });
        setTimeout(() => {
          const url = teamDetailPath(res.teamId, { gameName: team.gameName });
          if (url) platform.navigateTo({ url });
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
      const app = getApplication();
      app.globalData.user = user;
    }
    this.setData({ showProfile: false });
    if (this.pendingAction === "submit") {
      this.setData({ pendingAction: "" });
      this.onSubmit();
    }
  } }
};
</script>
<template>
<timeline-preview v-if="singlePage" />
<template v-else>
<view class="page publish-page">
  <view class="publish-heading">
    <view class="publish-copy">
      <view class="page-heading">{{editingId ? '调整这趟车' : (proxyMode ? '帮群友开一局' : '喊上好友，开一局')}}</view>
      <view class="page-caption">{{editingId ? '选定游戏和时间，发车后分享给好友。' : (proxyMode ? '车头是群友，发车后出现在他的「我发起的」里。' : '选定游戏和时间，发车后分享给好友。')}}</view>
    </view>
    <image class="brand-avatar" src="/static/images/brand/avatar-v1.jpg" mode="aspectFit" aria-label="开黑星球" />
  </view>
  <view class="form">
    <label v-if="canProxy && !editingId" :class="'proxy-switch ' + (proxyMode ? 'proxy-switch-on' : '')">
      <view class="proxy-switch-copy">
        <view class="proxy-switch-title">帮群友发车</view>
        <view class="proxy-switch-hint">帮朋友代发一辆车</view>
      </view>
      <switch class="proxy-toggle" :checked="proxyMode" color="#6255e7" @change="toggleProxy(eventWithDataset($event, {}))" aria-label="帮群友发车" />
    </label>

    <template v-if="proxyMode && !editingId">
      <view id="field-proxy" class="label">帮谁发车</view>
      <view v-if="proxyHost" class="proxy-picked">
        <image class="proxy-avatar" :src="proxyHost.avatarUrl || (proxyHost.avatarBase64 ? 'data:image/jpeg;base64,' + proxyHost.avatarBase64 : '/static/images/avatar.png')" mode="aspectFill" />
        <view class="proxy-picked-name">{{proxyHost.nickName}}</view>
        <view class="proxy-picked-clear" @tap.stop.prevent="clearProxyHost(eventWithDataset($event, {}))">换一个</view>
      </view>
      <template v-else>
        <input class="field" placeholder="搜对方在小程序里的昵称" maxlength="32" :value="proxyKeyword" @input="onProxyKeyword(eventWithDataset($event, {}))" />
        <view class="proxy-search-hint">对方需要先打开过小程序并设置昵称</view>
        <view v-if="proxySearching" class="proxy-search-status">搜索中…</view>
        <view v-else-if="proxyKeyword && !proxyResults.length" class="proxy-search-status">没找到这个昵称</view>
        <template v-for="(item, index) in proxyResults" :key="item.userId"><view class="proxy-result" :data-host="item" @tap="pickProxyHost(eventWithDataset($event, {'host': item}))">
          <image class="proxy-avatar" :src="item.avatarUrl || (item.avatarBase64 ? 'data:image/jpeg;base64,' + item.avatarBase64 : '/static/images/avatar.png')" mode="aspectFill" />
          <view class="proxy-result-name">{{item.nickName}}</view>
        </view></template>
      </template>
    </template>

    <view id="field-game" class="label">玩什么</view>
    <input class="field field-lg" placeholder="搜索游戏..." maxlength="40" :value="gameName" @input="onGameName(eventWithDataset($event, {}))" />
    <view class="games suggest-games">
      <template v-for="(item, index) in suggestedGames" :key="item.slug"><view :class="'game ' + (gameName === item.name ? 'game-on' : '')" :data-slug="item.slug" @tap="pickSuggestedGame(eventWithDataset($event, {'slug': item.slug}))">{{item.name}}</view></template>
    </view>
    <view class="from-last" v-if="fromLast">已填入上一趟，时间改到最近</view>

    <view id="field-platform" class="label">平台</view>
    <view class="games">
      <template v-for="(item, index) in platforms" :key="item"><view :class="'game ' + (platform === item ? 'game-on' : '')" :data-name="item" @tap="pickPlatform(eventWithDataset($event, {'name': item}))">{{item}}</view></template>
    </view>

    <view id="field-start" class="label">什么时候开始</view>
    <view class="games">
      <template v-for="(item, index) in startPresets" :key="item.key"><view :class="'game ' + (startPreset === item.key ? 'game-on' : '')" :data-key="item.key" @tap="pickStartPreset(eventWithDataset($event, {'key': item.key}))">{{item.label}}</view></template>
    </view>
    <view v-if="startPreset === 'custom'" class="time-row time-row-follow">
      <picker mode="date" :value="startDate" :start="minDate" @change="onStartDate(eventWithDataset($event, {}))">
        <view class="picker">{{startDate}}</view>
      </picker>
      <picker mode="time" :value="startTime" @change="onStartTime(eventWithDataset($event, {}))">
        <view class="picker">{{startTime}}</view>
      </picker>
    </view>

    <view id="field-end" class="label">玩多久</view>
    <view class="games">
      <template v-for="(item, index) in durationPresets" :key="item.label"><view :class="'game ' + (durationHours === item.hours ? 'game-on' : '')" v-if="item.hours !== 0" :data-hours="item.hours" @tap="pickDuration(eventWithDataset($event, {'hours': item.hours}))">{{item.label}}</view></template>
      <picker mode="selector" :range="durationPickerLabels" :value="durationPickerIndex" @change="pickCustomDuration(eventWithDataset($event, {}))">
        <view :class="'game ' + (durationHours === 0 ? 'game-on' : '')">自定义{{durationHours === 0 ? ' · ' + durationLabel : ''}}</view>
      </picker>
    </view>
    <view class="time-summary">
      <view class="time-summary-line1">{{timeSummaryLine1}}</view>
      <view class="time-summary-line2">{{timeSummaryLine2}}</view>
    </view>

    <view class="label">队伍人数</view>
    <view class="stepper">
      <view class="step-btn" @tap="decCap(eventWithDataset($event, {}))">−</view>
      <view class="step-num">{{capacity}}</view>
      <view class="step-btn" @tap="incCap(eventWithDataset($event, {}))">+</view>
    </view>
    <view class="step-hint">包含{{proxyMode && proxyHost ? '车头' : '你自己'}}</view>

    <view id="field-room" class="label">房间 / 加入方式（必填）</view>
    <input class="field" placeholder="请填写房间号 / Steam 好友代码 / 房间码" maxlength="80" :value="roomNo" @input="onRoomNo(eventWithDataset($event, {}))" />

    <view class="label">房间密码</view>
    <input class="field" placeholder="没有就空着" maxlength="32" :value="roomPwd" @input="onRoomPwd(eventWithDataset($event, {}))" />
    <view class="step-hint">房间密码仅车头和已上车成员可见</view>

    <button class="more-toggle" @tap="toggleMore(eventWithDataset($event, {}))" hover-class="more-toggle-hover" :aria-label="'更多设置，' + (showMore ? '点击收起' : '点击展开')">
      <view class="more-copy">
        <view class="more-title">更多设置</view>
        <view class="more-hint">{{moreHint}}</view>
      </view>
      <text :class="'more-chevron ' + (showMore ? 'more-chevron-up' : '')"></text>
    </button>
    <view :hidden="!showMore" class="more-fields">
    <view class="label">服务器 / 区服</view>
    <input class="field" placeholder="如 欧服、微信区、国服" maxlength="20" :value="server" @input="onServer(eventWithDataset($event, {}))" />

    <view class="label">语音</view>
    <view class="games">
      <template v-for="(item, index) in voices" :key="item"><view :class="'game ' + (voice === item ? 'game-on' : '')" :data-name="item" @tap="pickVoice(eventWithDataset($event, {'name': item}))">{{item}}</view></template>
    </view>

    <view class="label">队友要求</view>
    <input class="field" placeholder="如 娱乐局、上分、萌新友好" maxlength="20" :value="rankReq" @input="onRank(eventWithDataset($event, {}))" />

    <view class="field-head">
      <view class="label">备注</view>
      <view :class="'field-count ' + (note && note.length >= 500 ? 'field-count-max' : '')">{{note ? note.length : 0}}/500</view>
    </view>
    <textarea class="area" placeholder="玩法、麦序、怎么加好友" maxlength="500" :value="note" @input="onNote(eventWithDataset($event, {}))" />
    </view>
  </view>
  <view class="submit-spacer"></view>

  <view class="submit-bar">
    <button class="btn-primary" :loading="submitting" :disabled="submitting" @tap="onSubmit(eventWithDataset($event, {}))">
      {{editingId ? '保存修改' : (proxyMode && proxyHost ? '帮 TA 发车 · ' + capacity + '人' : '发车 · ' + capacity + '人')}}
    </button>
  </view>

  <profile-gate :show="showProfile" @done="onProfileDone({ detail: $event })" @close="onProfileClose({ detail: $event })" />
  <welcome-letter />
</view>

</template>

</template>
<style scoped>
.publish-page { padding-bottom: 24rpx; }
.publish-heading { display: flex; align-items: center; gap: 16rpx; }
.publish-copy { flex: 1; min-width: 0; }
.publish-heading .page-heading { font-size: 34rpx; line-height: 1.3; }
.publish-heading .page-caption { margin-top: 4rpx; font-size: 23rpx; line-height: 1.5; }
.brand-avatar { width: 84rpx; height: 84rpx; border-radius: 24rpx; flex-shrink: 0; }

.form { margin-top: 20rpx; background: #fff; border: 1rpx solid #e9ebf3; border-radius: 28rpx; padding: 4rpx 28rpx 28rpx; }
.label { margin: 28rpx 0 14rpx; color: #535b72; font-size: 25rpx; font-weight: 600; }
.field, .picker, .area { border: 1rpx solid #e9ebf3; background: #f7f8fc; border-radius: 16rpx; box-sizing: border-box; font-size: 28rpx; color: #202438; }
.field, .picker { height: 84rpx; line-height: 84rpx; padding: 0 20rpx; }
.field-lg { font-size: 32rpx; font-weight: 600; }
.games { display: flex; flex-wrap: wrap; gap: 12rpx; }
.suggest-games { margin-top: 14rpx; }
.game { padding: 15rpx 23rpx; background: #f5f6fa; color: #697188; border-radius: 14rpx; font-size: 25rpx; }
.game-on { background: #eeecff; color: #6255e7; box-shadow: inset 0 0 0 1rpx #c8c1fb; }
.time-row { display: flex; gap: 14rpx; }
.time-row-follow { margin-top: 14rpx; }
.time-row > picker { flex: 1; min-width: 0; }
.time-row > picker:first-child { flex: 1.45; }
.picker { padding: 0 8rpx; text-align: center; }
.stepper { display: flex; align-items: center; border-radius: 16rpx; background: #f7f8fc; height: 84rpx; }
.step-btn { width: 100rpx; line-height: 84rpx; text-align: center; color: #6255e7; font-size: 38rpx; }
.step-num { flex: 1; text-align: center; font-weight: 700; font-size: 34rpx; }
.step-hint { margin-top: 10rpx; font-size: 22rpx; color: #858ba0; }
.area { width: 100%; min-height: 170rpx; padding: 20rpx; line-height: 1.6; }
.field-head { display: flex; align-items: baseline; justify-content: space-between; margin: 28rpx 0 14rpx; }
.field-head .label { margin: 0; }
.field-count { font-size: 22rpx; color: #858ba0; }
.field-count-max { color: #e5484d; font-weight: 600; }

.from-last { color: #6255e7; font-size: 24rpx; margin-top: 12rpx; }
.time-hint { margin-top: 10rpx; font-size: 23rpx; color: #858ba0; }

.time-summary { margin-top: 18rpx; padding: 18rpx 22rpx; background: #f4f1ff; border: 1rpx solid #e6dffb; border-radius: 18rpx; }
.time-summary-line1 { font-size: 29rpx; font-weight: 600; color: #3a2db0; line-height: 1.4; }
.time-summary-line2 { margin-top: 4rpx; font-size: 23rpx; color: #8a83b0; line-height: 1.4; }

button.more-toggle { width: 100% !important; margin-top: 32rpx; padding: 22rpx 8rpx 8rpx 4rpx; box-sizing: border-box; border: none; border-top: 1rpx solid #eef0f6; border-radius: 0; background: transparent; display: flex; gap: 16rpx; justify-content: space-between; align-items: center; text-align: left; line-height: 1.5; }
.more-copy { flex: 1; min-width: 0; }
.more-title { font-size: 28rpx; font-weight: 700; color: #4437b5; }
.more-hint { margin-top: 6rpx; font-size: 23rpx; color: #6b6485; }
.more-chevron { flex-shrink: 0; width: 12rpx; height: 12rpx; margin-right: 8rpx; border-right: 3rpx solid #9b93c9; border-bottom: 3rpx solid #9b93c9; transform: translateY(-2rpx) rotate(-45deg); }
.more-chevron-up { transform: translateY(4rpx) rotate(45deg); }
button.more-toggle-hover { background: #f7f5ff; border-radius: 16rpx; }

.proxy-switch { margin: 20rpx 0 4rpx; padding: 8rpx 0; display: flex; align-items: center; gap: 16rpx; background: transparent; border: none; }
.proxy-switch-on { background: transparent; }
.proxy-switch-copy { flex: 1; min-width: 0; }
.proxy-switch-title { font-size: 26rpx; font-weight: 600; color: #202438; }
.proxy-switch-hint { margin-top: 2rpx; font-size: 22rpx; color: #858ba0; line-height: 1.4; }
.proxy-toggle { flex-shrink: 0; transform: scale(0.92); transform-origin: center right; }
.proxy-picked { display: flex; align-items: center; gap: 16rpx; padding: 16rpx 18rpx; background: #f7f8fc; border-radius: 16rpx; }
.proxy-picked-name { flex: 1; min-width: 0; font-size: 28rpx; font-weight: 600; word-break: break-all; }
.proxy-picked-clear { flex-shrink: 0; font-size: 23rpx; color: #6255e7; }
.proxy-avatar { width: 64rpx; height: 64rpx; border-radius: 20rpx; background: #eeecff; flex-shrink: 0; }
.proxy-search-hint, .proxy-search-status { margin-top: 12rpx; font-size: 22rpx; color: #858ba0; }
.proxy-result { display: flex; align-items: center; gap: 16rpx; padding: 16rpx 4rpx; border-bottom: 1rpx solid #eef0f6; }
.proxy-result-name { font-size: 28rpx; font-weight: 600; word-break: break-all; }

.submit-spacer { height: calc(200rpx + env(safe-area-inset-bottom)); }
.submit-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; padding: 16rpx 32rpx calc(16rpx + env(safe-area-inset-bottom)); background: rgba(245, 246, 250, 0.96); box-shadow: 0 -8rpx 24rpx rgba(32, 36, 56, 0.06); }
.submit-bar .btn-primary { width: 100% !important; }

/* #ifdef H5 */
.submit-bar { bottom: var(--window-bottom, 0px); }
/* #endif */
</style>
