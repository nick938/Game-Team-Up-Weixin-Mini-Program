const { callTeam, showError } = require("../../utils/cloud");

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function decorate(rows, kind) {
  return (rows || []).map((r) => ({
    ...r,
    timeText: formatTime(r.createdAt),
    handled: r.status === "handled",
    tag: kind === "report" ? r.reason : kind === "bug" ? r.page : r.kind,
  }));
}

const TEAM_STATUS_TEXT = {
  recruiting: "缺人",
  full: "满员",
};

function decorateTeams(rows) {
  return (rows || []).map((t) => ({
    ...t,
    statusText: TEAM_STATUS_TEXT[t.displayStatus] || t.displayStatus,
    timeText: formatTime(t.startAt),
  }));
}

function decorateStats(stats) {
  if (!stats) return stats;
  const games = stats.topGames || [];
  const maxScore = games.reduce((m, g) => Math.max(m, g.score || 0), 0) || 1;
  const trend = stats.trend || [];
  const maxTrend = trend.reduce((m, t) => Math.max(m, t.count || 0), 0) || 1;
  const platforms = stats.platforms || [];
  const maxPlatform = platforms.reduce((m, p) => Math.max(m, p.count || 0), 0) || 1;
  return {
    ...stats,
    topGames: games.map((g) => ({
      ...g,
      pct: Math.max(6, Math.round(((g.score || 0) / maxScore) * 100)),
    })),
    trend: trend.map((t) => ({
      ...t,
      pct: Math.max(4, Math.round(((t.count || 0) / maxTrend) * 100)),
    })),
    platforms: platforms.map((p) => ({
      ...p,
      pct: Math.max(6, Math.round(((p.count || 0) / maxPlatform) * 100)),
    })),
  };
}

Page({
  data: {
    tab: "overview",
    loading: true,
    denied: false,
    stats: null,
    list: [],
    onlyOpen: true,
    userKeyword: "",
    bannedOnly: false,
    userTotal: 0,
  },

  onLoad() {
    this.load();
  },

  onPullDownRefresh() {
    return this.load().finally(() => wx.stopPullDownRefresh());
  },

  async load() {
    this.setData({ loading: true });
    try {
      if (this.data.tab === "overview") {
        const res = await callTeam("adminOverview");
        this.setData({ stats: decorateStats(res.stats), denied: false, loading: false });
      } else if (this.data.tab === "teams") {
        const res = await callTeam("adminTeams", {});
        this.setData({ list: decorateTeams(res.list), denied: false, loading: false });
      } else if (this.data.tab === "users") {
        const res = await callTeam("adminUsers", {});
        this.setData({
          userTotal: res.total || 0,
          denied: false,
          loading: false,
        });
        this.applyUsersFilter(res.list || []);
      } else {
        const res = await this.loadList();
        this.setData({ list: res, denied: false, loading: false });
      }
    } catch (e) {
      this.setData({ loading: false });
      if ((e.message || "").indexOf("管理权限") >= 0) {
        this.setData({ denied: true });
      } else {
        showError(e);
      }
    }
  },

  applyUsersFilter(rows, keywordInput) {
    const source = rows || this.allUsers || [];
    this.allUsers = source;
    const keyword = String(
      keywordInput === undefined ? this.data.userKeyword || "" : keywordInput
    )
      .trim()
      .toLowerCase();
    const list = source.filter((u) => {
      if (this.data.bannedOnly && !u.banned) return false;
      if (!keyword) return true;
      return (
        (u.nickName || "").toLowerCase().includes(keyword) ||
        (u.openid || "").toLowerCase().includes(keyword)
      );
    });
    this.setData({ list });
  },

  onUserSearch(e) {
    const userKeyword = e.detail.value;
    this.setData({ userKeyword });
    this.applyUsersFilter(this.allUsers, userKeyword);
  },

  toggleBannedOnly() {
    this.setData({ bannedOnly: !this.data.bannedOnly });
    this.applyUsersFilter();
  },

  onBan(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || "该用户";
    wx.showModal({
      title: "封禁用户？",
      editable: true,
      placeholderText: "封禁原因（可选）",
      content: "",
      confirmColor: "#c1121f",
      success: async (res) => {
        if (!res.confirm) return;
        await this.setBan(id, true, (res.content || "").trim(), `${name} 已封禁`);
      },
    });
  },

  onUnban(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || "该用户";
    wx.showModal({
      title: "解封用户？",
      content: `将恢复「${name}」的发车、上车与提交权限。`,
      success: async (res) => {
        if (!res.confirm) return;
        await this.setBan(id, false, "", `${name} 已解封`);
      },
    });
  },

  async setBan(id, banned, reason, toast) {
    try {
      await callTeam("adminSetBan", { userId: id, banned, reason });
      wx.showToast({ title: toast, icon: "none" });
      this.allUsers = (this.allUsers || []).map((u) =>
        u._id === id ? { ...u, banned, banReason: reason } : u
      );
      this.applyUsersFilter();
    } catch (err) {
      showError(err);
    }
  },

  onCloseTeam(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || "这趟车";
    wx.showModal({
      title: "强制关闭？",
      content: `将关闭「${name}」并通知车上所有人。`,
      confirmColor: "#c1121f",
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await callTeam("adminCancelTeam", { teamId: id });
          wx.showToast({ title: "已关闭", icon: "success" });
          this.setData({ list: this.data.list.filter((t) => t._id !== id) });
        } catch (err) {
          showError(err);
        }
      },
    });
  },

  async loadList() {
    if (this.data.tab === "feedback") {
      const res = await callTeam("adminFeedback", {
        status: this.data.onlyOpen ? "open" : "",
      });
      return decorate(res.list, "feedback");
    }
    const kind = this.data.tab === "bug" ? "bug" : "report";
    const res = await callTeam("adminReports", {
      kind,
      status: this.data.onlyOpen ? "open" : "",
    });
    return decorate(res.list, kind);
  },

  async pickTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
    await this.load();
  },

  async toggleOpen() {
    this.setData({ onlyOpen: !this.data.onlyOpen });
    if (this.data.tab !== "overview") await this.load();
  },

  async onHandle(e) {
    const id = e.currentTarget.dataset.id;
    // WXML dataset 一律是字符串，"false" 也是真值，这里显式转换成布尔。
    const handled = String(e.currentTarget.dataset.handled) === "true";
    const next = handled ? "open" : "handled";
    try {
      if (this.data.tab === "feedback") {
        await callTeam("adminHandleFeedback", { feedbackId: id, status: next });
      } else {
        await callTeam("adminHandleReport", { reportId: id, status: next });
      }
      const list = this.data.list.map((r) =>
        r._id === id ? { ...r, handled: next === "handled" } : r
      );
      this.setData({ list });
      wx.showToast({ title: next === "handled" ? "已处理" : "已重开", icon: "none" });
    } catch (err) {
      showError(err);
    }
  },
});
