const { decorateTeam } = require("../../utils/format");
const { callTeam, showError } = require("../../utils/cloud");
const { requestTeamNotify } = require("../../utils/subscribe");
const { SUBSCRIBE_TMPL_ID } = require("../../utils/constants");
const { getAppVersion } = require("../../utils/version");

function splitTeams(list) {
  const ongoing = [];
  const past = [];
  (list || []).forEach((t) => {
    if (t.ongoing) ongoing.push(t);
    else past.push(t);
  });
  return { ongoing, past };
}

Page({
  data: {
    user: {},
    teamTab: "hosted",
    phase: "Ongoing",
    visibleTeams: [],
    showSettings: false,
    hostedOngoing: [],
    hostedPast: [],
    joinedOngoing: [],
    joinedPast: [],
    showProfile: false,
    notifyEnabled: false,
    notifySaving: false,
    preferenceLoaded: false,
    notifyMessage: "",
    wechatNotifyStatus: "微信授权状态待确认",
    versionText: "",

  },

  onShow() {
    this.setData({ versionText: getAppVersion().text });
    this.load();
    this.refreshWechatNotify();
  },

  onPullDownRefresh() {
    return this.load().finally(() => wx.stopPullDownRefresh());
  },

  async load() {
    try {
      const [profile, teams] = await Promise.all([
        callTeam("getProfile"),
        callTeam("myTeams"),
      ]);
      const app = getApp();
      if (profile.user) {
        app.globalData.user = profile.user;
      }
      const hosted = splitTeams((teams.hosted || []).map(decorateTeam));
      const joined = splitTeams((teams.joined || []).map(decorateTeam));
      this.setData({
        user: profile.user || {},
        ...(this.data.notifySaving ? {} : {
          notifyEnabled: !profile.user || profile.user.notifyEnabled !== false,
          preferenceLoaded: true,
        }),
        hostedOngoing: hosted.ongoing,
        hostedPast: hosted.past,
        joinedOngoing: joined.ongoing,
        joinedPast: joined.past,
      });
      this.updateVisibleTeams();
    } catch (e) {
      showError(e);
    }
  },

  updateVisibleTeams() {
    this.setData({ visibleTeams: this.data[this.data.teamTab + this.data.phase] || [] });
  },
  pickTeamTab(e) {
    this.setData({ teamTab: e.currentTarget.dataset.tab });
    this.updateVisibleTeams();
  },
  pickPhase(e) {
    this.setData({ phase: e.currentTarget.dataset.phase });
    this.updateVisibleTeams();
  },
  toggleSettings() { this.setData({ showSettings: !this.data.showSettings }); },
  goPlaza() { wx.switchTab({ url: "/pages/index/index" }); },

  refreshWechatNotify() {
    wx.getSetting({
      withSubscriptions: true,
      success: (res) => this.showWechatNotify(res.subscriptionsSetting),
      fail: () => this.setData({ wechatNotifyStatus: "暂时无法读取微信授权状态" }),
    });
  },

  showWechatNotify(settings = {}) {
    const status = (settings.itemSettings || {})[SUBSCRIBE_TMPL_ID];
    let text = "每次发车、上车时由微信确认授权";
    if (settings.mainSwitch === false) text = "微信订阅消息总开关已关闭";
    else if (status === "reject" || status === "ban") text = "微信暂未允许此提醒，请检查订阅设置";
    else if (status === "accept") text = "微信已记住允许选择，发送仍需有效订阅次数";
    this.setData({ wechatNotifyStatus: text });
  },

  openWechatNotifySettings() {
    wx.openSetting({
      withSubscriptions: true,
      success: (res) => this.showWechatNotify(res.subscriptionsSetting),
      fail: () => this.setData({ notifyMessage: "打开失败，请在小程序右上角设置中查看订阅消息" }),
    });
  },

  async onNotifyChange(e) {
    if (this.data.notifySaving || !this.data.preferenceLoaded) return;
    const enabled = e.detail.value;
    const previous = this.data.notifyEnabled;
    this.setData({ notifyEnabled: enabled, notifySaving: true, notifyMessage: "" });
    try {
      // 先直接调起原生授权，再保存偏好，避免异步网络请求打断点击手势。
      if (enabled && !(await requestTeamNotify({ force: true }))) {
        this.setData({ notifyEnabled: previous, notifyMessage: "未获得微信授权，提醒偏好未开启；可查看微信订阅设置" });
        return;
      }
      const res = await callTeam("saveNotifyPreference", { enabled });
      getApp().globalData.user = res.user;
      this.setData({ user: res.user, notifyMessage: enabled ? "已开启提醒偏好" : "已关闭，后续组队提醒不再发送" });
    } catch (err) {
      this.setData({ notifyEnabled: previous, notifyMessage: "保存失败，已恢复原设置，请重试" });
      showError(err);
    } finally {
      this.setData({ notifySaving: false });
      this.refreshWechatNotify();
    }
  },

  editProfile() {
    this.setData({ showProfile: true });
  },

  onProfileClose() { this.setData({ showProfile: false, pendingAction: "" }); },

  onProfileDone(e) {
    const user = (e && e.detail && e.detail.user) || {};
    if (user.nickName) {
      this.setData({ showProfile: false, user });
    } else {
      this.setData({ showProfile: false });
    }
    this.load();
  },

  onOpen(e) {
    const id = e.detail.id;
    wx.navigateTo({
      url: `/pages/team/detail?id=${id}`,
    });
  },

  openLegal(e) {
    const type = e.currentTarget.dataset.type;
    wx.navigateTo({
      url: `/pages/legal/legal?type=${type}`,
    });
  },

  openFeedback() {
    wx.navigateTo({ url: "/pages/feedback/feedback" });
  },

  onShareAppMessage() {
    return {
      title: "来开黑 - 一起组队开黑",
      path: "/pages/index/index",
    };
  },

  onShareTimeline() {
    return {
      title: "来开黑 - 一起组队开黑",
      path: "/pages/index/index",
    };
  },
});
