const { callTeam, showError } = require("../../utils/cloud");

Component({
  properties: {
    expanded: { type: Boolean, value: false },
    show: {
      type: Boolean,
      value: false,
    },
  },
  data: {
    avatarUrl: "",
    nickName: "",
    currentName: "",
    steamFriendCode: "",
    gameId: "",
    kookId: "",
    bio: "",
    showGameFields: false,
    saving: false,
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
          steamFriendCode: user.steamFriendCode || "",
          gameId: user.gameId || "",
          kookId: user.kookId || "",
          bio: user.bio || "",
          showGameFields: this.properties.expanded,

        });
      }
    },
  },
  methods: {
    noop() {},
    close() {
      if (!this.data.saving) this.triggerEvent("close");
    },
    toggleGameFields() { this.setData({ showGameFields: !this.data.showGameFields }); },
    onPublicField(e) {
      const field = e.currentTarget.dataset.field;
      if (["steamFriendCode", "gameId", "kookId", "bio"].includes(field)) {
        this.setData({ [field]: e.detail.value });
      }
    },
    onChooseAvatar(e) {
      this.setData({
        avatarUrl: (e.detail && e.detail.avatarUrl) || "",
      });
    },
    onNickname(e) {
      const value = ((e.detail && e.detail.value) || "").trim();
      this.setData({ nickName: value, currentName: value });
    },
    async onSave() {
      if (this.data.saving) return;
      const nickName = (this.data.nickName || this.data.currentName || "").trim();
      if (!nickName) {
        wx.showToast({ title: "请点输入框选择微信昵称", icon: "none" });
        return;
      }
      const steamFriendCode = this.data.steamFriendCode.trim();
      if (steamFriendCode && !/^\d+$/.test(steamFriendCode)) {
        wx.showToast({ title: "Steam 好友代码请填写数字", icon: "none" });
        return;
      }
      this.setData({ saving: true });
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
          steamFriendCode,
          gameId: this.data.gameId.trim(),
          kookId: this.data.kookId.trim(),
          bio: this.data.bio.trim(),
        });
        const app = getApp();
        app.globalData.user = res.user;
        this.triggerEvent("done", { user: res.user });
      } catch (err) {
        showError(err);
      } finally {
        this.setData({ saving: false });
        wx.hideLoading();
      }
    },
  },
});
