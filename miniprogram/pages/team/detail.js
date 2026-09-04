const { decorateTeam, formatStartAt } = require("../../utils/format");
const { callTeam, showError } = require("../../utils/cloud");
const { requestTeamNotify } = require("../../utils/subscribe");

Page({
  data: {
    teamId: "",
    team: null,
    members: [],
    role: null,
    loading: true,
    showProfile: false,
    pendingAction: "",
  },

  onLoad(options) {
    this.setData({ teamId: options.id || "" });
  },

  onShow() {
    if (this.data.teamId) {
      this.loadDetail();
    } else {
      this.setData({ loading: false, team: null });
    }
  },

  onShareAppMessage() {
    const team = this.data.team;
    if (!team) {
      return { title: "来开黑", path: "/pages/index/index" };
    }
    const time = formatStartAt(team.startAt).replace(/今天 |今晚 |明天 /, "");
    let title = `来开黑｜${team.gameName}`;
    if (team.displayStatus === "recruiting") {
      title += ` 还差 ${team.needCount} 人 · ${time}`;
    } else if (team.displayStatus === "full") {
      title += " 已满员";
    } else if (team.displayStatus === "cancelled") {
      title += " 已散";
    } else {
      title += " 已结束";
    }
    return {
      title,
      path: `/pages/team/detail?id=${this.data.teamId}`,
    };
  },

  async loadDetail() {
    this.setData({ loading: true });
    try {
      const res = await callTeam("getTeam", { teamId: this.data.teamId });
      let role = res.role;
      if (!role) {
        try {
          const profile = await callTeam("getProfile");
          const nick = profile.user && profile.user.nickName;
          const host = (res.members || []).find((m) => m.role === "host");
          if (nick && host && host.nickName === nick) {
            role = "host";
          }
        } catch (err) {
          // ignore
        }
      }
      this.setData({
        team: decorateTeam(res.team),
        members: res.members || [],
        role,
        loading: false,
      });
      wx.setNavigationBarTitle({
        title: (res.team && res.team.gameName) || "组队详情",
      });
    } catch (e) {
      this.setData({ team: null, loading: false });
      showError(e);
    }
  },

  copyRoom() {
    const no = this.data.team && this.data.team.roomNo;
    if (!no) return;
    wx.setClipboardData({ data: String(no) });
  },

  copyPwd() {
    const pwd = this.data.team && this.data.team.roomPwd;
    if (!pwd) return;
    wx.setClipboardData({ data: String(pwd) });
  },

  async onEnableNotify() {
    const ok = await requestTeamNotify();
    wx.showToast({
      title: ok ? "开打前会提醒你" : "需要允许通知才能提醒",
      icon: "none",
    });
  },

  async onJoin() {
    wx.showLoading({ title: "上车中" });
    try {
      await callTeam("joinTeam", { teamId: this.data.teamId });
        wx.showToast({ title: "已上车", icon: "success" });
      this.loadDetail();
    } catch (e) {
      wx.hideLoading();
      if (e.code === "NEED_PROFILE") {
        this.setData({ showProfile: true, pendingAction: "join" });
      } else {
        showError(e);
      }
    }
  },

  onLeave() {
    wx.showModal({
      title: "下车？",
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: "下车中" });
        try {
          await callTeam("leaveTeam", { teamId: this.data.teamId });
          wx.showToast({ title: "已下车", icon: "success" });
          this.loadDetail();
        } catch (e) {
          wx.hideLoading();
          showError(e);
        }
      },
    });
  },

  onKick(e) {
    const openid = e.currentTarget.dataset.openid;
    wx.showModal({
      title: "踢了这人？",
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: "处理中" });
        try {
          await callTeam("kickMember", {
            teamId: this.data.teamId,
            openid,
          });
          wx.showToast({ title: "已踢出", icon: "success" });
          this.loadDetail();
        } catch (err) {
          wx.hideLoading();
          showError(err);
        }
      },
    });
  },

  onEdit() {
    const app = getApp();
    app.globalData.editingTeamId = this.data.teamId;
    wx.switchTab({ url: "/pages/publish/publish" });
  },

  onRepublish() {
    const team = this.data.team;
    if (!team) return;
    const app = getApp();
    app.globalData.republishTeam = {
      gameName: team.gameName,
      capacity: team.capacity,
      roomNo: team.roomNo,
      roomPwd: team.roomPwd,
      platform: team.platform,
      server: team.server,
      voice: team.voice,
      rankReq: team.rankReq,
      note: team.note,
    };
    wx.switchTab({ url: "/pages/publish/publish" });
  },

  onCancel() {
    wx.showModal({
      title: "散了这趟？",
      content: "散了之后不能再上车。",
      confirmColor: "#c1121f",
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: "处理中" });
        try {
          await callTeam("cancelTeam", { teamId: this.data.teamId });
          wx.showToast({ title: "已散", icon: "success" });
          this.loadDetail();
        } catch (e) {
          wx.hideLoading();
          showError(e);
        }
      },
    });
  },

  goPlaza() {
    wx.switchTab({ url: "/pages/index/index" });
  },

  onProfileDone() {
    this.setData({ showProfile: false });
    if (this.data.pendingAction === "join") {
      this.setData({ pendingAction: "" });
      this.onJoin();
    }
  },
});
