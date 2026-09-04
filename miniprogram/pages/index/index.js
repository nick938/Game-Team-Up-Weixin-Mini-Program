const { decorateTeam } = require("../../utils/format");
const { callTeam, showError } = require("../../utils/cloud");
const { requestTeamNotify } = require("../../utils/subscribe");

function uniqueGames(list) {
  const seen = {};
  const games = ["全部"];
  (list || []).forEach((t) => {
    const name = (t.gameName || "").trim();
    if (!name || seen[name]) return;
    seen[name] = true;
    games.push(name);
  });
  return games;
}

function applyFilter(list, gameFilter) {
  if (!gameFilter || gameFilter === "全部") return list || [];
  return (list || []).filter((t) => t.gameName === gameFilter);
}

Page({
  data: {
    list: [],
    filtered: [],
    games: ["全部"],
    gameFilter: "全部",
    loading: false,
  },

  onShow() {
    this.loadList();
  },

  onPullDownRefresh() {
    this.loadList().finally(() => wx.stopPullDownRefresh());
  },

  async loadList() {
    this.setData({ loading: true });
    try {
      const res = await callTeam("listTeams");
      const list = (res.list || []).map(decorateTeam);
      const games = uniqueGames(list);
      let gameFilter = this.data.gameFilter;
      if (games.indexOf(gameFilter) < 0) gameFilter = "全部";
      this.setData({
        list,
        games,
        gameFilter,
        filtered: applyFilter(list, gameFilter),
      });
    } catch (e) {
      showError(e);
    } finally {
      this.setData({ loading: false });
    }
  },

  pickGame(e) {
    const gameFilter = e.currentTarget.dataset.name;
    this.setData({
      gameFilter,
      filtered: applyFilter(this.data.list, gameFilter),
    });
  },

  async onOpen(e) {
    const id = e.detail.id;
    const team = (this.data.filtered || []).find((t) => t._id === id);
    if (team && team.mark === "我发的") {
      await requestTeamNotify();
    }
    wx.navigateTo({
      url: `/pages/team/detail?id=${id}`,
    });
  },

  goPublish() {
    wx.switchTab({ url: "/pages/publish/publish" });
  },
});
