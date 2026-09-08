const {
  FEEDBACK_KINDS,
  FEEDBACK_PAGES,
  FEEDBACK_TEMPLATE,
} = require("../../utils/constants");
const { getAppVersion } = require("../../utils/version");
const { callTeam, showError } = require("../../utils/cloud");

Page({
  data: {
    kinds: FEEDBACK_KINDS,
    pages: FEEDBACK_PAGES,
    kind: "遇到问题",
    pageName: "大厅",
    content: FEEDBACK_TEMPLATE,
    contact: "",
    submitting: false,
    versionText: "",
  },

  onLoad() {
    const ver = getAppVersion();
    this.version = ver;
    this.setData({ versionText: ver.text });
  },

  pickKind(e) {
    this.setData({ kind: e.currentTarget.dataset.name });
  },

  pickPage(e) {
    this.setData({ pageName: e.currentTarget.dataset.name });
  },

  onContent(e) {
    this.setData({ content: e.detail.value });
  },

  onContact(e) {
    this.setData({ contact: e.detail.value });
  },

  async onSubmit() {
    if (this.data.submitting) return;
    const content = (this.data.content || "").trim();
    const filled = content
      .replace(/【我遇到的情况】/g, "")
      .replace(/【我希望怎样】/g, "")
      .replace(/\s/g, "");
    if (filled.length < 4) {
      wx.showToast({ title: "请把情况写具体一点", icon: "none" });
      return;
    }
    this.setData({ submitting: true });
    try {
      const ver = this.version || getAppVersion();
      const res = await callTeam("submitFeedback", {
        kind: this.data.kind,
        page: this.data.pageName,
        content,
        contact: (this.data.contact || "").trim(),
        version: ver.version,
        envVersion: ver.envLabel,
      });
      if (res.mailed) {
        wx.showToast({ title: "已发到邮箱", icon: "success" });
        this.setData({ content: FEEDBACK_TEMPLATE, contact: "" });
        setTimeout(() => wx.navigateBack(), 600);
        return;
      }
      wx.showModal({
        title: "反馈已记下，邮件没发出去",
        content: res.mailError || "请重新上传云函数 team，并勾选云端安装依赖。也可在云开发控制台查看 feedback 集合。",
        showCancel: false,
      });
    } catch (e) {
      showError(e);
    } finally {
      this.setData({ submitting: false });
    }
  },
});
