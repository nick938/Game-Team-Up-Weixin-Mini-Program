const { callTeam } = require("./utils/cloud");

App({
  onLaunch: function () {
    this.globalData = {
      env: "cloud1-d9gniyjzh4e2ffb1c",
      user: null,
      editingTeamId: null,
      republishTeam: null,
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
      return;
    }
    wx.cloud.init({
      env: this.globalData.env,
      traceUser: true,
    });
    this.profileReady = callTeam("getProfile").then((res) => {
      this.globalData.user = res.user;
    }).catch((err) => console.warn("读取用户资料失败", err.message));
  },
});
