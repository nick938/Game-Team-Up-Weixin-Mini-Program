const { isSinglePage } = require("../../utils/runtime");
const { decorateTeam } = require("../../utils/format");
const { callTeam, showError } = require("../../utils/cloud");
const { bindCopyUrl, unbindCopyUrl } = require("../../utils/share");
const { teamDetailPath } = require("../../utils/team-entry");
const { SORT_MODES, DEFAULT_SORT, sortTeams } = require("../../utils/lobby");
const {
  FEATURED_GAMES,
  resolveGameQuery,
  filterTeamsByGame,
  gameShare,
  pageSeo,
} = require("../../utils/games");

const PAGE_SIZE = 20;
// 游戏页只展示匹配到的车；大厅按时间分页，这里最多再往后扫几页，避免空页。
const SCAN_PAGES = 5;

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

function othersOf(game) {
  if (!game) return FEATURED_GAMES;
  return FEATURED_GAMES.filter((item) => item.slug !== game.slug);
}

Page({
  data: {
    featured: FEATURED_GAMES,
    others: FEATURED_GAMES,
    game: null,
    gameKey: "",
    seoTitle: pageSeo(null).title,
    seoHeading: pageSeo(null).heading,
    seoDescription: pageSeo(null).description,
    tags: [],
    filtered: [],
    sorts: SORT_MODES,
    sortMode: DEFAULT_SORT,
    hasMore: false,
    loading: false,
    loadingMore: false,
    listError: false,
  },

  onLoad(options) {
    this.applyGame(options);
  },

  applyGame(options) {
    const game = resolveGameQuery(options);
    const seo = pageSeo(game);
    const share = gameShare(game);
    this.game = game;
    this.teams = [];
    this.nextOffset = 0;
    wx.setNavigationBarTitle({ title: seo.title });
    this.setData({
      game,
      gameKey: seo.gameKey,
      seoTitle: seo.title,
      seoHeading: seo.heading,
      seoDescription: seo.description,
      tags: (game && game.tags) || [],
      others: othersOf(game),
      filtered: [],
      sortMode: DEFAULT_SORT,
      hasMore: false,
      listError: false,
    });
    this.sharePayload = share;
  },

  onShow() {
    const singlePage = isSinglePage();
    this.setData({ singlePage });
    if (singlePage) return;
    bindCopyUrl(wx, () => this.sharePayload || gameShare(this.game));
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

  onReachBottom() {
    if (isSinglePage()) return;
    this.loadMore();
  },

  loadMore() {
    if (!this.data.hasMore || this.data.loading || this.data.loadingMore) return;
    this.loadList(false);
  },

  async loadList(reset = true) {
    if (isSinglePage() || !this.game) return;
    if (this.data.loading || this.data.loadingMore) return;
    this.setData(
      reset
        ? { loading: true, listError: false }
        : { loadingMore: true, listError: false }
    );
    try {
      let hasMore = this.data.hasMore;
      let rounds = 0;
      const maxRounds = reset ? SCAN_PAGES : 1;
      do {
        const offset = reset && rounds === 0 ? 0 : this.nextOffset || 0;
        const res = await callTeam("listTeams", { offset, limit: PAGE_SIZE });
        const page = (res.list || []).map(decorateTeam);
        const teams =
          reset && rounds === 0
            ? mergeTeams([], page)
            : mergeTeams(this.teams, page);
        this.teams = teams;
        this.nextOffset =
          typeof res.nextOffset === "number" ? res.nextOffset : offset + page.length;
        hasMore = !!res.hasMore;
        rounds += 1;
        this.setData({
          hasMore,
          listError: false,
          filtered: this.buildView(teams, this.data.sortMode),
        });
      } while (
        reset &&
        this.data.filtered.length < 8 &&
        hasMore &&
        rounds < maxRounds
      );
    } catch (e) {
      this.setData({ listError: true });
      showError(e);
    } finally {
      this.setData({ loading: false, loadingMore: false });
    }
  },

  buildView(teams, sortMode) {
    return sortTeams(filterTeamsByGame(teams, this.game), sortMode);
  },

  pickSort(e) {
    const sortMode = e.currentTarget.dataset.key;
    if (!SORT_MODES.some((m) => m.key === sortMode)) return;
    this.setData({
      sortMode,
      filtered: this.buildView(this.teams, sortMode),
    });
  },

  onOpen(e) {
    const id = e.detail && e.detail.id;
    const url = teamDetailPath(id, { gameName: e.detail && e.detail.gameName });
    if (!url) return;
    wx.navigateTo({ url });
  },

  goPublish() {
    const app = getApp();
    const game = this.game || this.data.game;
    if (game) {
      app.globalData.prefillGame = {
        name: game.name,
        platform: game.platform,
      };
    }
    wx.switchTab({ url: "/pages/publish/publish" });
  },

  goPlaza() {
    wx.switchTab({ url: "/pages/index/index" });
  },

  onShareAppMessage() {
    const share = this.sharePayload || gameShare(this.game);
    return {
      title: this.data.seoTitle || share.title,
      path: share.path,
    };
  },

  onShareTimeline() {
    const share = this.sharePayload || gameShare(this.game);
    return {
      title: this.data.seoTitle || share.title,
      query: share.query,
    };
  },
});
