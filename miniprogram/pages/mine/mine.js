const { isSinglePage } = require("../../utils/runtime");
const { decorateTeam } = require("../../utils/format");
const { callTeam, showError } = require("../../utils/cloud");
const { getAppVersion } = require("../../utils/version");
const { plazaShare, bindCopyUrl, unbindCopyUrl } = require("../../utils/share");
const { teamDetailPath } = require("../../utils/team-entry");

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
    hostedOngoing: [],
    hostedPast: [],
    joinedOngoing: [],
    joinedPast: [],
    showProfile: false,
    versionText: "",
    isAdmin: false,
    isOrganizer: false,
  },

  onShow() {
    const singlePage = isSinglePage();
    this.setData({ singlePage });
    if (singlePage) return;
    bindCopyUrl(wx, () => plazaShare());
    this.setData({ versionText: getAppVersion().text });
    this.load();
  },

  onHide() {
    unbindCopyUrl(wx);
  },

  onUnload() {
    unbindCopyUrl(wx);
  },

  onPullDownRefresh() {
    return this.load().finally(() => wx.stopPullDownRefresh());
  },

  async load() {
    if (isSinglePage()) return;
    try {
      const [profile, teams] = await Promise.all([
        callTeam("getProfile"),
        callTeam("myTeams"),
      ]);
      const app = getApp();
      if (profile.user) {
        app.globalData.user = profile.user;
      }
      app.globalData.isAdmin = !!profile.isAdmin;
      app.globalData.isOrganizer = !!profile.isOrganizer;
      const hosted = splitTeams((teams.hosted || []).map(decorateTeam));
      const joined = splitTeams((teams.joined || []).map(decorateTeam));
      this.setData({
        user: profile.user || {},
        isAdmin: !!profile.isAdmin,
        isOrganizer: !!profile.isOrganizer,
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
  goPlaza() { wx.switchTab({ url: "/pages/index/index" }); },

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
    const id = e.detail && e.detail.id;
    const url = teamDetailPath(id, { gameName: e.detail && e.detail.gameName });
    if (!url) return;
    wx.navigateTo({ url });
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

  openBug() {
    const app = getApp();
    const errorMsg = encodeURIComponent((app.globalData && app.globalData.lastError) || "");
    wx.navigateTo({ url: `/pages/bug/bug?page=我的&errorMsg=${errorMsg}` });
  },

  openAdmin() {
    wx.navigateTo({ url: "/pages/admin/admin" });
  },

  openPublish() {
    wx.switchTab({ url: "/pages/publish/publish" });
  },

  onShareAppMessage() {
    const share = plazaShare();
    return { title: share.title, path: share.path };
  },

  onShareTimeline() {
    const share = plazaShare();
    return { title: share.title, query: share.query };
  },
});
