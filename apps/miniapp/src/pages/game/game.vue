<script>
import { eventWithDataset } from "../../utils/state";
import { platform } from "../../platform/host";
import { getApplication } from "../../stores/app";
import { updateState } from "../../utils/state";
import { isSinglePage } from "../../utils/runtime";
import { decorateTeam } from "../../utils/format";
import { callTeam, showError } from "../../utils/cloud";
import { bindCopyUrl, unbindCopyUrl, shareToFriend, shareToTimeline } from "../../utils/share";
import { teamDetailPath } from "../../utils/team-entry";
import { SORT_MODES, DEFAULT_SORT, sortTeams } from "../../utils/lobby";
import {
  FEATURED_GAMES,
  resolveGameQuery,
  filterTeamsByGame,
  gameShare,
  pageSeo,
} from "../../utils/games";

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

export default {
 data() { return { singlePage: false, ...{
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
  } }; },
onLoad(options) {
    this.applyGame(options);
  },
onShow() {
    const singlePage = isSinglePage();
    this.setData({ singlePage });
    if (singlePage) return;
    bindCopyUrl(platform, () => this.sharePayload || gameShare(this.game));
    this.loadList();
  },
onHide() {
    unbindCopyUrl(platform);
  },
onUnload() {
    unbindCopyUrl(platform);
  },
onPullDownRefresh() {
    this.loadList().finally(() => platform.stopPullDownRefresh());
  },
onReachBottom() {
    if (isSinglePage()) return;
    this.loadMore();
  },
onShareAppMessage() {
    const share = this.sharePayload || gameShare(this.game);
    return shareToFriend({
      title: this.seoTitle || share.title,
      path: share.path,
    });
  },
onShareTimeline() {
    const share = this.sharePayload || gameShare(this.game);
    return shareToTimeline({
      title: this.seoTitle || share.title,
      query: share.query,
    });
  },
methods: { eventWithDataset, setData: updateState,
applyGame(options) {
    const game = resolveGameQuery(options);
    const seo = pageSeo(game);
    const share = gameShare(game);
    this.game = game;
    this.teams = [];
    this.nextOffset = 0;
    platform.setNavigationBarTitle({ title: seo.title });
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
loadMore() {
    if (!this.hasMore || this.loading || this.loadingMore) return;
    this.loadList(false);
  },
async loadList(reset = true) {
    if (isSinglePage() || !this.game) return;
    if (this.loading || this.loadingMore) return;
    this.setData(
      reset
        ? { loading: true, listError: false }
        : { loadingMore: true, listError: false }
    );
    try {
      let hasMore = this.hasMore;
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
          filtered: this.buildView(teams, this.sortMode),
        });
      } while (
        reset &&
        this.filtered.length < 8 &&
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
    platform.navigateTo({ url });
  },
goPublish() {
    const app = getApplication();
    const game = this.game || this.game;
    if (game) {
      app.globalData.prefillGame = {
        name: game.name,
        platform: game.platform,
      };
    }
    platform.switchTab({ url: "/pages/publish/publish" });
  },
goPlaza() {
    platform.switchTab({ url: "/pages/index/index" });
  } }
};
</script>
<template>
<timeline-preview v-if="singlePage" />
<template v-else>
<view class="page">
  <view class="seo-header">
    <view class="seo-title">{{seoHeading}}</view>
    <view class="seo-desc">{{seoDescription}}</view>
    <button v-if="game" size="mini" class="hero-create" @tap="goPublish(eventWithDataset($event, {}))">发起{{game.entryLabel}} ＋</button>
    <button v-else size="mini" class="hero-create" @tap="goPlaza(eventWithDataset($event, {}))">回大厅看看</button>
  </view>

  <template v-if="game">
    <view class="section-head">
      <view class="zone">正在找队友的车<text class="section-count">{{filtered.length}}</text></view>
      <view class="sorts">
        <template v-for="(item, index) in sorts" :key="item.key"><view :class="'sort ' + (sortMode === item.key ? 'sort-on' : '')" :data-key="item.key" @tap="pickSort(eventWithDataset($event, {'key': item.key}))">{{item.label}}</view></template>
      </view>
    </view>

    <view v-if="loading && !filtered.length" class="empty">正在找队伍…</view>
    <view v-else-if="listError && !filtered.length" class="empty">
      <view>队伍列表暂时加载失败，过一会再试。</view>
      <button class="btn-ghost empty-btn" @tap="loadList(eventWithDataset($event, {}))">再试一次</button>
    </view>
    <view v-else-if="!filtered.length" class="empty">
      <view>暂时还没有队伍，发布一个组队邀请吧。</view>
      <button class="btn-primary empty-btn" @tap="goPublish(eventWithDataset($event, {}))">去发{{game.entryLabel}}</button>
    </view>

    <template v-for="(item, index) in filtered" :key="item._id"><team-card :team="item" :team-id="item.id || item._id" :mark="item.mark" @open="onOpen({ detail: $event })" /></template>
    <view v-if="filtered.length && loadingMore" class="load-more">正在加载更多…</view>
    <view v-else-if="filtered.length && !hasMore" class="load-more">没有更多了</view>
    <view v-else-if="filtered.length && hasMore" class="load-more">上拉加载更多</view>
  </template>

  <view class="seo-games">
    <view class="seo-kicker">{{game ? '其他游戏搭子' : '热门游戏搭子'}}</view>
    <view class="seo-game-list">
      <template v-for="(item, index) in others" :key="item.seoKey"><navigator class="seo-game" :url="'/pages/game/game?game=' + (item.seoKey)" hover-class="seo-game-hover">{{item.entryLabel}}</navigator></template>
    </view>
  </view>
</view>
</template>

</template>
<style scoped>
@import "../../styles/lobby.css";

.seo-header { margin: 8rpx 0 28rpx; }
.seo-title { font-size: 40rpx; font-weight: 700; letter-spacing: -1rpx; line-height: 1.4; }
.seo-desc { margin-top: 10rpx; color: #777e92; font-size: 24rpx; line-height: 1.6; }
.seo-games { margin-top: 36rpx; }
.seo-kicker { margin-bottom: 16rpx; font-size: 26rpx; font-weight: 600; }
.seo-game-list { display: flex; flex-wrap: wrap; gap: 12rpx; }
.seo-game { padding: 12rpx 22rpx; background: #fff; border: 1rpx solid #e8eaf2; border-radius: 30rpx; color: #4437b5; font-size: 24rpx; line-height: 1.3; }
.seo-game-hover { background: #eeecff; border-color: #c8c1fb; }

</style>
