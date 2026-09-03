const { callTeam, showError } = require("../../utils/cloud");

Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
    },
  },
  data: {
    avatarUrl: "",
    nickName: "",
    currentName: "",
  },
  observers: {
    show(val) {
      if (val) {
        const app = getApp();
        const user = (app.globalData && app.globalData.user) || {};
        this.setData({
          avatarUrl: user.avatarUrl || "",
          nickName: user.nickName || "",
          currentName: user.nickName || "",
        });
      }
    },
  },
  methods: {
    noop() {},
    onChooseAvatar(e) {
      this.setData({
        avatarUrl: (e.detail && e.detail.avatarUrl) || "",
      });
    },
    onNickname(e) {
      const value = ((e.detail && e.detail.value) || "").trim();
      if (value) {
        this.setData({ nickName: value, currentName: value });
      }
    },
    async onSave() {
      const nickName = (this.data.nickName || this.data.currentName || "").trim();
      if (!nickName) {
        wx.showToast({ title: "请点输入框选择微信昵称", icon: "none" });
        return;
      }
      wx.showLoading({ title: "保存中", mask: true });
      try {
        let avatarUrl = this.data.avatarUrl || "";
        if (avatarUrl && !avatarUrl.startsWith("cloud://")) {
          const up = await wx.cloud.uploadFile({
            cloudPath: `avatars/${Date.now()}-${Math.floor(Math.random() * 10000)}.jpg`,
            filePath: avatarUrl,
          });
          avatarUrl = up.fileID;
        }
        const res = await callTeam("saveProfile", {
          nickName,
          avatarUrl,
        });
        const app = getApp();
        app.globalData.user = res.user;
        this.triggerEvent("done", { user: res.user });
      } catch (err) {
        showError(err);
      } finally {
        wx.hideLoading();
      }
    },
  },
});
