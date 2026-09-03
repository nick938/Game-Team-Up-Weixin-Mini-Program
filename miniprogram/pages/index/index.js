const { decorateTeam } = require("../../utils/format");
const { callTeam, showError } = require("../../utils/cloud");

Page({
  data: {
    list: [],
    loading: false,
  },

  onShow() {
    this.loadList();
  },

  onPullDownRefresh() {
    this.loadList().finally(() => wx.stopPullDownRefresh());
  },

  async loadList() {
    this.setData({ loading: true });
    try {
      const res = await callTeam("listTeams");
      this.setData({
        list: (res.list || []).map(decorateTeam),
      });
    } catch (e) {
      showError(e);
    } finally {
      this.setData({ loading: false });
    }
  },

  onOpen(e) {
    wx.navigateTo({
      url: `/pages/team/detail?id=${e.detail.id}`,
    });
  },

  goPublish() {
    wx.switchTab({ url: "/pages/publish/publish" });
  },
});
