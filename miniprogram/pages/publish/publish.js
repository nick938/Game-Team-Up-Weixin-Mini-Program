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

function emptyForm() {
  const startAt = defaultStartAt();
  const endAt = defaultEndAt(startAt);
  const start = dateParts(startAt);
  const end = dateParts(endAt);
  const today = dateParts(Date.now());
  return {
    editingId: "",
    platforms: PLATFORMS,
    voices: VOICES,
    gameName: "",
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    minDate: today.date,
    capacity: 5,
    roomNo: "",
    roomPwd: "",
    platform: "Steam",
    server: "",
    voice: "KOOK",
    rankReq: "",
    note: "",
    submitting: false,
    showProfile: false,
    pendingAction: "",
    fromLast: false,
    showMore: false,
  };
}

Page({
  data: emptyForm(),

  async onShow() {
    const app = getApp();
    const editingId = app.globalData.editingTeamId;
    app.globalData.editingTeamId = null;
    if (editingId) {
      await this.loadEdit(editingId);
      return;
    }
    const draft = app.globalData.republishTeam;
    app.globalData.republishTeam = null;
    if (draft) {
      this.applyDraft(draft);
      return;
    }
    if (this.data.editingId || this.data.fromLast) {
      this.setData(emptyForm());
    }
  },

  async loadEdit(id) {
    wx.showLoading({ title: "加载中" });
    try {
      const res = await callTeam("getTeam", { teamId: id });
      const team = res.team;
      const start = dateParts(team.startAt);
      const end = dateParts(team.endAt || team.expireAt || team.startAt);
      const voice = team.voice === "Discord" ? "KOOK" : team.voice;
      this.setData({
        ...emptyForm(),
        editingId: id,
        showMore: true,
        gameName: team.gameName || "",
        startDate: start.date,
        startTime: start.time,
        endDate: end.date,
        endTime: end.time,
        capacity: team.capacity,
        roomNo: team.roomNo || "",
        roomPwd: team.roomPwd || "",
        platform: PLATFORMS.indexOf(team.platform) >= 0 ? team.platform : "Steam",
        server: team.server || "",
        voice: VOICES.indexOf(voice) >= 0 ? voice : "KOOK",
        rankReq: team.rankReq || "",
        note: team.note || "",
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
    this.setData({
      ...emptyForm(),
      fromLast: true,
      showMore: true,
      gameName: draft.gameName || "",
      startDate: start.date,
      startTime: start.time,
      endDate: end.date,
      endTime: end.time,
      minDate: today.date,
      capacity: draft.capacity || 5,
      roomNo: draft.roomNo || "",
      roomPwd: draft.roomPwd || "",
      platform: PLATFORMS.indexOf(draft.platform) >= 0 ? draft.platform : "Steam",
      server: draft.server || "",
      voice: VOICES.indexOf(voice) >= 0 ? voice : "KOOK",
      rankReq: draft.rankReq || "",
      note: draft.note || "",
    });
  },

  toggleMore() {
    this.setData({ showMore: !this.data.showMore });
  },

  onGameName(e) {
    this.setData({ gameName: e.detail.value });
  },
  onStartDate(e) {
    this.setData({ startDate: e.detail.value });
  },
  onStartTime(e) {
    this.setData({ startTime: e.detail.value });
  },
  onEndDate(e) {
    this.setData({ endDate: e.detail.value });
  },
  onEndTime(e) {
    this.setData({ endTime: e.detail.value });
  },
  decCap() {
    if (this.data.capacity <= 2) return;
    this.setData({ capacity: this.data.capacity - 1 });
  },
  incCap() {
    if (this.data.capacity >= 20) return;
    this.setData({ capacity: this.data.capacity + 1 });
  },
  onRoomNo(e) {
    this.setData({ roomNo: e.detail.value });
  },
  onRoomPwd(e) {
    this.setData({ roomPwd: e.detail.value });
  },
  pickPlatform(e) {
    this.setData({ platform: e.currentTarget.dataset.name });
  },
  onServer(e) {
    this.setData({ server: e.detail.value });
  },
  pickVoice(e) {
    this.setData({ voice: e.currentTarget.dataset.name });
  },
  onRank(e) {
    this.setData({ rankReq: e.detail.value });
  },
  onNote(e) {
    this.setData({ note: e.detail.value });
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

  async onSubmit() {
    if (this.data.submitting) return;
    const team = this.buildTeam();
    if (!team.gameName) {
      wx.showToast({ title: "请填写玩什么", icon: "none" });
      return;
    }
    if (team.endAt <= team.startAt) {
      wx.showToast({ title: "结束时间要晚于开始", icon: "none" });
      return;
    }
    if (team.endAt - team.startAt > MAX_TEAM_MS) {
      wx.showToast({ title: `一局最长 ${MAX_TEAM_HOURS} 小时`, icon: "none" });
      return;
    }
    this.setData({ submitting: true });
    try {
      if (!this.data.editingId) {
        await requestTeamNotify();
      }
      if (this.data.editingId) {
        await callTeam("updateTeam", { teamId: this.data.editingId, team });
        wx.showToast({ title: "已保存", icon: "success" });
        setTimeout(() => {
          wx.navigateTo({
            url: `/pages/team/detail?id=${this.data.editingId}`,
          });
        }, 400);
      } else {
        const res = await callTeam("createTeam", { team });
        wx.showToast({ title: "已发车", icon: "success" });
        setTimeout(() => {
          wx.navigateTo({
            url: `/pages/team/detail?id=${res.teamId}`,
          });
        }, 400);
      }
    } catch (e) {
      if (e.code === "NEED_PROFILE") {
        this.setData({ showProfile: true, pendingAction: "submit" });
      } else {
        showError(e);
      }
    } finally {
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
    return {
      title: "来开黑 - 发起组队",
      path: "/pages/index/index",
    };
  },

  onShareTimeline() {
    return {
      title: "来开黑 - 发起组队",
      path: "/pages/index/index",
    };
  },
});
