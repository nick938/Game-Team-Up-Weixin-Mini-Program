const { decorateTeam } = require("../../utils/format");
const { callTeam, showError } = require("../../utils/cloud");

Page({
  data: {
    user: {},
    hosted: [],
    joined: [],
    showProfile: false,
  },

  onShow() {
    this.load();
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
      this.setData({
        user: profile.user || {},
        hosted: (teams.hosted || []).map(decorateTeam),
        joined: (teams.joined || []).map(decorateTeam),
      });
    } catch (e) {
      showError(e);
    }
  },

  editProfile() {
    this.setData({ showProfile: true });
  },

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
    wx.navigateTo({
      url: `/pages/team/detail?id=${e.detail.id}`,
    });
  },
});
