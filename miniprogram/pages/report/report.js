const { REPORT_REASONS } = require("../../utils/constants");
const { getAppVersion } = require("../../utils/version");
const { callTeam, showError } = require("../../utils/cloud");

Page({
  data: {
    reasons: REPORT_REASONS,
    reason: "",
    content: "",
    teamId: "",
    targetName: "",
    submitting: false,
  },

  onLoad(options) {
    const targetName = options.name ? decodeURIComponent(options.name) : "";
    this.setData({
      teamId: options.teamId || "",
      targetName,
    });
    wx.setNavigationBarTitle({ title: targetName ? `举报：${targetName}` : "举报" });
  },

  pickReason(e) {
    this.setData({ reason: e.currentTarget.dataset.name });
  },

  onContent(e) {
    this.setData({ content: e.detail.value });
  },

  async onSubmit() {
    if (this.data.submitting) return;
    if (!this.data.reason) {
      wx.showToast({ title: "请选择举报理由", icon: "none" });
      return;
    }
    if (!this.data.teamId) {
      wx.showToast({ title: "举报对象已失效", icon: "none" });
      return;
    }
    this.setData({ submitting: true });
    try {
      const ver = getAppVersion();
      await callTeam("submitReport", {
        targetType: "team",
        targetId: this.data.teamId,
        reason: this.data.reason,
        content: (this.data.content || "").trim(),
        version: ver.version,
        envVersion: ver.envLabel,
      });
      wx.showToast({ title: "已收到举报", icon: "success" });
      setTimeout(() => wx.navigateBack(), 700);
    } catch (e) {
      showError(e);
    } finally {
      this.setData({ submitting: false });
    }
  },
});
