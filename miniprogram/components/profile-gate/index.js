const { callTeam, showError } = require("../../utils/cloud");

// 头像上传到云存储，只存 fileID；展示时由云函数换成临时链接。
// 免费开发环境的存储权限锁定为「仅创建者可读写」，客户端直连读别人的图会 403，
// 所以不能把本地临时路径或 base64 存库，必须走云存储 + 云函数换链接。
function isLocalAvatar(path) {
  return !!path && !path.startsWith("cloud://") && !path.startsWith("https://");
}

function cloudPathFor(path) {
  const match = /\.([a-zA-Z0-9]+)$/.exec(path || "");
  const ext = match ? match[1] : "png";
  return `avatars/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

function uploadAvatar(path) {
  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath: cloudPathFor(path),
      filePath: path,
      success: (res) => resolve((res && res.fileID) || ""),
      fail: (err) => reject(new Error((err && err.errMsg) || "头像上传失败")),
    });
  });
}

// chooseAvatar 返回的图可能偏大；内容安全检测限 1MB、边长 750px，先压到 400px 宽再传。
function compressAvatar(path) {
  return new Promise((resolve) => {
    if (typeof wx.compressImage !== "function") {
      resolve(path);
      return;
    }
    wx.compressImage({
      src: path,
      quality: 60,
      compressedWidth: 400,
      success: (res) => resolve((res && res.tempFilePath) || path),
      fail: () => resolve(path),
    });
  });
}

Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
    },
  },
  data: {
    avatarUrl: "",
    avatarBase64: "",
    avatarFileID: "",
    nickName: "",
    currentName: "",
    bio: "",
    bioLength: 0,
    saving: false,
  },
  observers: {
    show(val) {
      if (val) {
        const app = getApp();
        const user = (app.globalData && app.globalData.user) || {};
        const bio = user.bio || "";
        this.setData({
          avatarUrl: user.avatarUrl || "",
          avatarBase64: user.avatarBase64 || "",
          avatarFileID: user.avatarFileID || "",
          nickName: user.nickName || "",
          currentName: user.nickName || "",
          bio,
          bioLength: bio.length,
        });
      }
    },
  },
  methods: {
    noop() {},
    close() {
      if (!this.data.saving) this.triggerEvent("close");
    },
    onBio(e) {
      const bio = (e.detail && e.detail.value) || "";
      this.setData({ bio, bioLength: bio.length });
    },
    onChooseAvatar(e) {
      this.setData({
        avatarUrl: (e.detail && e.detail.avatarUrl) || "",
        avatarBase64: "",
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
      const bio = (this.data.bio || "").trim();
      if (bio.length > 50) {
        wx.showToast({ title: "签名最多 50 字", icon: "none" });
        return;
      }
      this.setData({ saving: true });
      wx.showLoading({ title: "保存中", mask: true });
      try {
        // avatarUrl 可能是云函数换来的临时链接，不能回写数据库；优先用原始 fileID。
        let avatarUrl = this.data.avatarFileID || this.data.avatarUrl || "";
        if (isLocalAvatar(avatarUrl)) {
          try {
            avatarUrl = await uploadAvatar(await compressAvatar(avatarUrl));
          } catch (e) {
            // 上传失败（如历史遗留的失效本地路径）不应阻塞昵称/资料保存。
            avatarUrl = this.data.avatarFileID || "";
          }
        }
        const res = await callTeam("saveProfile", {
          nickName,
          avatarUrl,
          bio,
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
