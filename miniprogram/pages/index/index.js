const { isSinglePage } = require("../../utils/runtime");
const { decorateTeam } = require("../../utils/format");
const { callTeam, showError } = require("../../utils/cloud");
const { plazaShare, bindCopyUrl, unbindCopyUrl } = require("../../utils/share");
const { teamDetailPath } = require("../../utils/team-entry");
const { SORT_MODES, DEFAULT_SORT, sortTeams } = require("../../utils/sort");

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

// 先按游戏名筛选，再按当前排序方式排列。
function applyView(list, gameFilter, sortMode) {
  return sortTeams(applyFilter(list, gameFilter), sortMode);
}

Page({
  data: {
    total: 0,
    filtered: [],
    games: ["全部"],
    gameFilter: "全部",
    sorts: SORT_MODES,
    sortMode: DEFAULT_SORT,
    loading: false,
  },

  onShow() {
    const singlePage = isSinglePage();
    this.setData({ singlePage });
    if (singlePage) return;
    bindCopyUrl(wx, () => plazaShare());
    this.loadList();
  },

  onHide() {
    unbindCopyUrl(wx);
  },

  onUnload() {
    unbindCopyUrl(wx);
  },

  onPullDownRefresh() {
    this.loadList().finally(() => wx.stopPullDownRefresh());
  },

  async loadList() {
    if (isSinglePage()) return;
    this.setData({ loading: true });
    try {
      const res = await callTeam("listTeams");
      const list = (res.list || []).map(decorateTeam);
      this.teams = list;
      const games = uniqueGames(list);
      let gameFilter = this.data.gameFilter;
      if (games.indexOf(gameFilter) < 0) gameFilter = "全部";
      this.setData({
        total: list.length,
        games,
        gameFilter,
        filtered: applyView(list, gameFilter, this.data.sortMode),
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
      filtered: applyView(this.teams, gameFilter, this.data.sortMode),
    });
  },

  pickSort(e) {
    const sortMode = e.currentTarget.dataset.key;
    if (!SORT_MODES.some((m) => m.key === sortMode)) return;
    this.setData({
      sortMode,
      filtered: applyView(this.teams, this.data.gameFilter, sortMode),
    });
  },

  onOpen(e) {
    const id = e.detail && e.detail.id;
    const url = teamDetailPath(id, { gameName: e.detail && e.detail.gameName });
    if (!url) return;
    wx.navigateTo({ url });
  },

  goPublish() {
    wx.switchTab({ url: "/pages/publish/publish" });
  },

  onShareAppMessage() {
    const share = plazaShare();
    return { title: share.title, path: share.path };
  },

  onShareTimeline() {
    const share = plazaShare();
    return { title: share.title, query: share.query };
  },
});
