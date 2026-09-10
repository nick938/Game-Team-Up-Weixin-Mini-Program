const { FEEDBACK_PAGES, BUG_TEMPLATE } = require("../../utils/constants");
const { getAppVersion } = require("../../utils/version");
const { callTeam, showError } = require("../../utils/cloud");

function systemSummary() {
  try {
    const info = wx.getSystemInfoSync() || {};
    return [
      info.platform,
      info.model,
      info.system,
      info.SDKVersion ? `SDK ${info.SDKVersion}` : "",
    ]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 200);
  } catch (e) {
    return "";
  }
}

Page({
  data: {
    pages: FEEDBACK_PAGES,
    pageName: "大厅",
    content: BUG_TEMPLATE,
    errorMsg: "",
    submitting: false,
  },

  onLoad(options) {
    const pageName = options.page && FEEDBACK_PAGES.includes(options.page)
      ? options.page
      : "大厅";
    const errorMsg = options.errorMsg ? decodeURIComponent(options.errorMsg) : "";
    this.setData({ pageName, errorMsg: errorMsg.slice(0, 500) });
  },

  pickPage(e) {
    this.setData({ pageName: e.currentTarget.dataset.name });
  },

  onContent(e) {
    this.setData({ content: e.detail.value });
  },

  onErrorMsg(e) {
    this.setData({ errorMsg: e.detail.value });
  },

  async onSubmit() {
    if (this.data.submitting) return;
    const content = (this.data.content || "").trim();
    const filled = content
      .replace(/【我做了什么】/g, "")
      .replace(/【出现了什么】/g, "")
      .replace(/\s/g, "");
    if (filled.length < 4) {
      wx.showToast({ title: "请简单说说发生了什么", icon: "none" });
      return;
    }
    this.setData({ submitting: true });
    try {
      const ver = getAppVersion();
      await callTeam("submitBug", {
        page: this.data.pageName,
        content,
        errorMsg: (this.data.errorMsg || "").trim(),
        systemInfo: systemSummary(),
        version: ver.version,
        envVersion: ver.envLabel,
      });
      wx.showToast({ title: "已收到，谢谢你", icon: "success" });
      this.setData({ content: BUG_TEMPLATE, errorMsg: "" });
      setTimeout(() => wx.navigateBack(), 700);
    } catch (e) {
      showError(e);
    } finally {
      this.setData({ submitting: false });
    }
  },
});
