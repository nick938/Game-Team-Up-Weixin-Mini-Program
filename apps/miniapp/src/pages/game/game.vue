<script setup lang="ts">
import { reactive, toRefs, nextTick } from 'vue';
import { onLoad, onShow, onHide, onUnload, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import type { Team, Game, SharePayload, PageQuery, PageEvent } from '../../types/domain';
import { eventWithDataset } from "../../utils/state";
import { platform as hostPlatform } from "../../platform/host";
import { getApplication } from "../../stores/app";
import { isSinglePage } from "../../utils/runtime";
import { decorateTeam } from "../../utils/format";
import { callTeam, showError } from "../../utils/cloud";
import { bindCopyUrl, unbindCopyUrl, shareToFriend, shareToTimeline } from "../../utils/share";
import { teamDetailPath } from "../../utils/team-entry";
import { SORT_MODES, DEFAULT_SORT, sortTeams } from "../../utils/lobby";
import { FEATURED_GAMES, resolveGameQuery, filterTeamsByGame, gameShare, pageSeo } from "../../utils/games";
const PAGE_SIZE = 20;
// 游戏页只展示匹配到的车；大厅按时间分页，这里最多再往后扫几页，避免空页。
const SCAN_PAGES = 5;
function mergeTeams(current: Team[], incoming: Team[]) {
    const seen: Record<string, boolean> = {};
    const out: Team[] = [];
    (current || []).concat(incoming || []).forEach((t) => {
        const id = t.id || t._id;
        if (!id || seen[id])
            return;
        seen[id] = true;
        out.push(t);
    });
    return out;
}
function othersOf(game: Game | null) {
    if (!game)
        return FEATURED_GAMES;
    return FEATURED_GAMES.filter((item) => item.slug !== game.slug);
}
const state = reactive({ teams: [] as Team[], nextOffset: 0, sharePayload: null as SharePayload | null, singlePage: false, ...{
        featured: FEATURED_GAMES,
        others: FEATURED_GAMES,
        game: null as Game | null,
        gameKey: "",
        seoTitle: pageSeo(null).title,
        seoHeading: pageSeo(null).heading,
        seoDescription: pageSeo(null).description,
        tags: [] as string[],
        filtered: [] as Team[],
        sorts: SORT_MODES,
        sortMode: DEFAULT_SORT,
        hasMore: false,
        loading: false,
        loadingMore: false,
        listError: false,
    } });
const { singlePage, featured, others, game, gameKey, seoTitle, seoHeading, seoDescription, tags, filtered, sorts, sortMode, hasMore, loading, loadingMore, listError } = toRefs(state);
function patchState(patch: Partial<typeof state>, done?: () => void) {
  Object.assign(state, patch);
  if (done) void nextTick(done);
}
function applyGame(options: PageQuery = {}) {
    const game = resolveGameQuery(options);
    const seo = pageSeo(game);
    const share = gameShare(game);
    state.game = game;
    state.teams = [];
    state.nextOffset = 0;
    hostPlatform.setNavigationBarTitle({ title: seo.title });
    patchState({
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
    state.sharePayload = share;
}
function loadMore() {
    if (!state.hasMore || state.loading || state.loadingMore)
        return;
    loadList(false);
}
async function loadList(reset = true) {
    if (isSinglePage() || !state.game)
        return;
    if (state.loading || state.loadingMore)
        return;
    patchState(reset
        ? { loading: true, listError: false }
        : { loadingMore: true, listError: false });
    try {
        let hasMore = state.hasMore;
        let rounds = 0;
        const maxRounds = reset ? SCAN_PAGES : 1;
        do {
            const offset = reset && rounds === 0 ? 0 : state.nextOffset || 0;
            const res = await callTeam("listTeams", { offset, limit: PAGE_SIZE });
            const page = (res.list || []).map(decorateTeam);
            const teams = reset && rounds === 0
                ? mergeTeams([], page)
                : mergeTeams(state.teams, page);
            state.teams = teams;
            state.nextOffset =
                typeof res.nextOffset === "number" ? res.nextOffset : offset + page.length;
            hasMore = !!res.hasMore;
            rounds += 1;
            patchState({
                hasMore,
                listError: false,
                filtered: buildView(teams, state.sortMode),
            });
        } while (reset &&
            state.filtered.length < 8 &&
            hasMore &&
            rounds < maxRounds);
    }
    catch (error) {
        const e: Error & { code?: string } = error instanceof Error ? error : new Error(String(error));
        patchState({ listError: true });
        showError(e);
    }
    finally {
        patchState({ loading: false, loadingMore: false });
    }
}
function buildView(teams: Team[], sortMode: string) {
    return sortTeams(filterTeamsByGame(teams, state.game), sortMode);
}
function pickSort(e: PageEvent) {
    const sortMode = e.currentTarget.dataset.key;
    if (!SORT_MODES.some((m) => m.key === sortMode))
        return;
    patchState({
        sortMode,
        filtered: buildView(state.teams, sortMode),
    });
}
function onOpen(e: Pick<PageEvent, 'detail'>) {
    const id = e.detail && e.detail.id;
    const url = teamDetailPath(id, { gameName: e.detail && e.detail.gameName });
    if (!url)
        return;
    hostPlatform.navigateTo({ url });
}
function goPublish() {
    const app = getApplication();
    const game = state.game || state.game;
    if (game) {
        app.globalData.prefillGame = {
            name: game.name,
            platform: game.platform,
        };
    }
    hostPlatform.switchTab({ url: "/pages/publish/publish" });
}
function goPlaza() {
    hostPlatform.switchTab({ url: "/pages/index/index" });
}
onLoad((options = {}) => {
    applyGame(options);
});
onShow(() => {
    const singlePage = isSinglePage();
    patchState({ singlePage });
    if (singlePage)
        return;
    bindCopyUrl(hostPlatform, () => state.sharePayload || gameShare(state.game));
    loadList();
});
onHide(() => {
    unbindCopyUrl(hostPlatform);
});
onUnload(() => {
    unbindCopyUrl(hostPlatform);
});
onPullDownRefresh(() => {
    loadList().finally(() => hostPlatform.stopPullDownRefresh());
});
onReachBottom(() => {
    if (isSinglePage())
        return;
    loadMore();
});
onShareAppMessage(() => {
    const share = state.sharePayload || gameShare(state.game);
    return shareToFriend({
        title: state.seoTitle || share.title,
        path: share.path,
    });
});
onShareTimeline(() => {
    const share = state.sharePayload || gameShare(state.game);
    return shareToTimeline({
        title: state.seoTitle || share.title,
        query: share.query,
    });
});
</script>
<template>
<timeline-preview v-if="singlePage" />
<template v-else>
<view class="page">
  <view class="seo-header">
    <view class="seo-title">{{seoHeading}}</view>
    <view class="seo-desc">{{seoDescription}}</view>
    <button v-if="game" size="mini" class="hero-create" @tap="goPublish()">发起{{game.entryLabel}} ＋</button>
    <button v-else size="mini" class="hero-create" @tap="goPlaza()">回大厅看看</button>
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
      <button class="btn-ghost empty-btn" @tap="loadList()">再试一次</button>
    </view>
    <view v-else-if="!filtered.length" class="empty">
      <view>暂时还没有队伍，发布一个组队邀请吧。</view>
      <button class="btn-primary empty-btn" @tap="goPublish()">去发{{game.entryLabel}}</button>
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
