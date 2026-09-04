const { decorateTeam } = require("../../utils/format");
const { callTeam, showError } = require("../../utils/cloud");
const { requestTeamNotify } = require("../../utils/subscribe");

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
    hostedOngoing: [],
    hostedPast: [],
    joinedOngoing: [],
    joinedPast: [],
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
      const hosted = splitTeams((teams.hosted || []).map(decorateTeam));
      const joined = splitTeams((teams.joined || []).map(decorateTeam));
      this.setData({
        user: profile.user || {},
        hostedOngoing: hosted.ongoing,
        hostedPast: hosted.past,
        joinedOngoing: joined.ongoing,
        joinedPast: joined.past,
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

  async onOpen(e) {
    const id = e.detail.id;
    const isHosted = (this.data.hostedOngoing || []).some((t) => t._id === id);
    if (isHosted) {
      await requestTeamNotify();
    }
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
});
