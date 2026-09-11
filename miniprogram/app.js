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
      this.globalData.isAdmin = !!res.isAdmin;
      this.globalData.isOrganizer = !!res.isOrganizer;
    }).catch((err) => console.warn("读取用户资料失败", err.message));
  },

  // 捕获未处理的前端异常，留给「报个错」页面预填，方便用户一键上报。
  onError(error) {
    try {
      this.globalData.lastError = String(error || "").slice(0, 500);
    } catch (e) {
      // 忽略
    }
  },
});
