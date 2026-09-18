const { isSinglePage } = require("../../utils/runtime");
const { decorateTeam } = require("../../utils/format");
const { callTeam, showError } = require("../../utils/cloud");
const { plazaShare, bindCopyUrl, unbindCopyUrl } = require("../../utils/share");
const { teamDetailPath } = require("../../utils/team-entry");
const {
  SORT_MODES,
  DEFAULT_SORT,
  buildLobbyView,
} = require("../../utils/lobby");
const { FEATURED_GAMES } = require("../../utils/games");

const PAGE_SIZE = 20;
// 搜索框每敲一个字都会在已加载的数据上重跑筛选+排序，防抖后再算。
const SEARCH_DEBOUNCE_MS = 280;

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

// 分页累加时可能拿到重复的车（翻页期间有人新建），按队伍 id 去重。
function mergeTeams(current, incoming) {
  const seen = {};
  const out = [];
  (current || []).concat(incoming || []).forEach((t) => {
    const id = t.id || t._id;
    if (!id || seen[id]) return;
    seen[id] = true;
    out.push(t);
  });
  return out;
}

Page({
  data: {
    total: 0,
    filtered: [],
    games: ["全部"],
    gameFilter: "全部",
    keyword: "",
    featured: FEATURED_GAMES,
    sorts: SORT_MODES,
    sortMode: DEFAULT_SORT,
    hasMore: false,
    loading: false,
    loadingMore: false,
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
    this.cancelSearch();
  },

  onPullDownRefresh() {
    this.loadList().finally(() => wx.stopPullDownRefresh());
  },

  // 滚到底部自动加载下一页；单页模式（朋友圈预览）没有列表，直接跳过。
  onReachBottom() {
    if (isSinglePage()) return;
    this.loadMore();
  },

  // 搜索是客户端行为，只覆盖已加载的车；没搜到但还有下一页时，让用户手动继续。
  loadMore() {
    if (!this.data.hasMore || this.data.loading || this.data.loadingMore) return;
    this.loadList(false);
  },

  // reset 为 true 时从头拉第一页（首次进入、下拉刷新都走这里）。
  async loadList(reset = true) {
    if (isSinglePage()) return;
    const offset = reset ? 0 : this.nextOffset || 0;
    this.setData(reset ? { loading: true } : { loadingMore: true });
    try {
      const res = await callTeam("listTeams", { offset, limit: PAGE_SIZE });
      const page = (res.list || []).map(decorateTeam);
      const teams = reset ? mergeTeams([], page) : mergeTeams(this.teams, page);
      this.teams = teams;
      this.nextOffset =
        typeof res.nextOffset === "number" ? res.nextOffset : offset + page.length;
      const games = uniqueGames(teams);
      let gameFilter = this.data.gameFilter;
      if (games.indexOf(gameFilter) < 0) gameFilter = "全部";
      this.setData({
        total: teams.length,
        games,
        gameFilter,
        hasMore: !!res.hasMore,
        filtered: this.buildView(teams, {
          gameFilter,
          keyword: this.data.keyword,
          sortMode: this.data.sortMode,
        }),
      });
    } catch (e) {
      showError(e);
    } finally {
      this.setData({ loading: false, loadingMore: false });
    }
  },

  buildView(teams, { gameFilter, keyword, sortMode }) {
    return buildLobbyView(teams, { gameFilter, keyword, sortMode });
  },

  pickGame(e) {
    const gameFilter = e.currentTarget.dataset.name;
    this.setData({
      gameFilter,
      filtered: this.buildView(this.teams, {
        gameFilter,
        keyword: this.data.keyword,
        sortMode: this.data.sortMode,
      }),
    });
  },

  pickSort(e) {
    const sortMode = e.currentTarget.dataset.key;
    if (!SORT_MODES.some((m) => m.key === sortMode)) return;
    this.setData({
      sortMode,
      filtered: this.buildView(this.teams, {
        gameFilter: this.data.gameFilter,
        keyword: this.data.keyword,
        sortMode,
      }),
    });
  },

  cancelSearch() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = null;
  },

  // 输入框的值要立刻回显（含清空按钮），筛选结果防抖后再算。
  onSearch(e) {
    const keyword = (e.detail && e.detail.value) || "";
    this.setData({ keyword });
    this.cancelSearch();
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.setData({
        filtered: this.buildView(this.teams, {
          gameFilter: this.data.gameFilter,
          keyword: this.data.keyword,
          sortMode: this.data.sortMode,
        }),
      });
    }, SEARCH_DEBOUNCE_MS);
  },

  clearSearch() {
    this.cancelSearch();
    this.setData({
      keyword: "",
      filtered: this.buildView(this.teams, {
        gameFilter: this.data.gameFilter,
        keyword: "",
        sortMode: this.data.sortMode,
      }),
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
