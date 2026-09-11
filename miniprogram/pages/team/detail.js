const { isSinglePage } = require("../../utils/runtime");
const { decorateTeam, formatStartAt } = require("../../utils/format");
const { callTeam, showError } = require("../../utils/cloud");
const { requestTeamNotify } = require("../../utils/subscribe");
const { resolveTeamId, teamShareQuery, usableTeamId } = require("../../utils/team-entry");
const { bindCopyUrl, unbindCopyUrl } = require("../../utils/share");

function readLaunchExtras() {
  const extras = {};
  try {
    if (typeof wx.getEnterOptionsSync === "function") extras.enter = wx.getEnterOptionsSync();
  } catch (e) {
    // 旧基础库或未就绪时忽略
  }
  try {
    if (typeof wx.getLaunchOptionsSync === "function") extras.launch = wx.getLaunchOptionsSync();
  } catch (e) {
    // 旧基础库或未就绪时忽略
  }
  return extras;
}

Page({
  data: {
    teamId: "",
    team: null,
    members: [],
    seats: [],
    showManage: false,
    showMemberProfile: false,
    memberProfileLoading: false,
    memberProfile: null,
    memberProfileError: "",
    selectedMemberId: "",
    role: null,
    loading: true,
    showProfile: false,
    pendingAction: "",
    notifyHint: "",
    notifyAuthorized: false,
  },

  onLoad(options) {
    this.entryOptions = options || {};
    const teamId = this.syncTeamId(this.entryOptions);
    const rawName = options && (options.name || options.gameName);
    if (rawName) {
      let name = String(rawName);
      try {
        name = decodeURIComponent(name);
      } catch (e) {
        // 已经是明文
      }
      wx.setNavigationBarTitle({ title: name.slice(0, 40) });
    }
    if (!teamId) this.setData({ loading: false, team: null });
  },

  syncTeamId(options) {
    const teamId = resolveTeamId(options || this.options || {}, readLaunchExtras());
    if (teamId !== this.data.teamId) this.setData({ teamId });
    return teamId;
  },

  onPullDownRefresh() {
    return this.loadDetail().finally(() => wx.stopPullDownRefresh());
  },

  onShow() {
    const singlePage = isSinglePage();
    this.setData({ singlePage });
    if (singlePage) return;
    bindCopyUrl(wx, () => ({
      query: teamShareQuery(this.data.teamId),
      title: (this.data.team && this.data.team.gameName) || "来开黑",
    }));
    const teamId = this.syncTeamId(this.entryOptions || this.options);
    if (teamId) {
      this.loadDetail();
    } else {
      this.setData({ loading: false, team: null, teamId: "" });
    }
  },

  onHide() {
    unbindCopyUrl(wx);
  },

  onUnload() {
    unbindCopyUrl(wx);
  },

  buildShare() {
    const team = this.data.team;
    const query = teamShareQuery(this.data.teamId);
    const path = query ? `/pages/team/detail?${query}` : "/pages/index/index";
    if (!team) {
      return { title: "来开黑", path, query };
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
    return { title, path, query };
  },

  onShareAppMessage() {
    const share = this.buildShare();
    return { title: share.title, path: share.path };
  },

  onShareTimeline() {
    const share = this.buildShare();
    return { title: share.title, query: share.query };
  },

  async loadDetail() {
    if (isSinglePage()) return;
    const teamId = usableTeamId(this.data.teamId);
    if (!teamId) {
      this.setData({ loading: false, team: null, teamId: "" });
      return;
    }
    const requestId = (this.detailRequest || 0) + 1;
    this.detailRequest = requestId;
    this.setData({ loading: true });
    try {
      const res = await callTeam("getTeam", { teamId });
      if (requestId !== this.detailRequest) return;
      const role = res.role;
      this.setData({
        team: decorateTeam(res.team),
        members: res.members || [],
        seats: Array.from({ length: res.team.capacity }, (_, i) => ({
          key: i,
          member: (res.members || [])[i] || null,
        })),
        role,
        loading: false,
      });
      wx.setNavigationBarTitle({
        title: (res.team && res.team.gameName) || "组队详情",
      });
    } catch (e) {
      if (requestId !== this.detailRequest) return;
      this.setData({ team: null, loading: false });
      showError(e);
    }
  },

  onMemberProfile(e) {
    const memberId = e.currentTarget.dataset.memberid;
    if (!memberId) return;
    this.setData({ showMemberProfile: true, selectedMemberId: memberId, memberProfile: null });
    this.loadMemberProfile();
  },

  async loadMemberProfile() {
    const requestId = (this.memberProfileRequest || 0) + 1;
    this.memberProfileRequest = requestId;
    this.setData({ memberProfileLoading: true, memberProfileError: "" });
    try {
      const res = await callTeam("getPublicProfile", {
        teamId: this.data.teamId,
        memberId: this.data.selectedMemberId,
      });
      if (requestId !== this.memberProfileRequest) return;
      this.setData({ memberProfile: res.profile, memberProfileLoading: false });
    } catch (err) {
      if (requestId !== this.memberProfileRequest) return;
      this.setData({ memberProfileLoading: false, memberProfileError: err.message || "资料加载失败" });
    }
  },

  closeMemberProfile() {
    this.memberProfileRequest = (this.memberProfileRequest || 0) + 1;
    this.setData({ showMemberProfile: false, memberProfile: null, selectedMemberId: "" });
  },

  copyPublicField(e) {
    const field = e.currentTarget.dataset.field;
    if (!["steamFriendCode", "gameId", "kookId"].includes(field)) return;
    const value = this.data.memberProfile && this.data.memberProfile[field];
    if (value) wx.setClipboardData({ data: String(value) });
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
    if (this.requestingNotify || this.data.notifyAuthorized) return;
    this.requestingNotify = true;
    const ok = await requestTeamNotify();
    this.requestingNotify = false;
    this.setData({
      notifyAuthorized: ok,
      notifyHint: ok
        ? ""
        : "未获得通知授权，可再次点击重试或检查微信订阅设置",
    });
  },

  async onJoin() {
    if (this.joining) return;
    this.joining = true;
    try {
      await requestTeamNotify();
      wx.showLoading({ title: "上车中" });
      await callTeam("joinTeam", { teamId: this.data.teamId });
      wx.hideLoading();
      wx.showToast({ title: "已上车", icon: "success" });
      this.loadDetail();
    } catch (e) {
      wx.hideLoading();
      if (e.code === "NEED_PROFILE") {
        this.setData({ showProfile: true, pendingAction: "join" });
      } else {
        showError(e);
      }
    } finally {
      this.joining = false;
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

  onManage() {
    if (this.data.role !== "host") return;
    this.setData({ showManage: true });
  },

  closeManage() { this.setData({ showManage: false }); },
  stopManageTouch() {},

  onManageAction(e) {
    if (this.data.role !== "host") return;
    const actions = { edit: "onEdit", cancel: "onCancel" };
    const action = actions[e.currentTarget.dataset.action];
    this.closeManage();
    if (action) this[action]();
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

  onReport() {
    const team = this.data.team;
    if (!team) return;
    const name = encodeURIComponent(team.gameName || "");
    wx.navigateTo({
      url: `/pages/report/report?teamId=${this.data.teamId}&name=${name}`,
    });
  },

  onProfileClose() { this.setData({ showProfile: false, pendingAction: "" }); },

  onProfileDone() {
    this.setData({ showProfile: false });
    if (this.data.pendingAction === "join") {
      this.setData({ pendingAction: "" });
      this.onJoin();
    }
  },
});
