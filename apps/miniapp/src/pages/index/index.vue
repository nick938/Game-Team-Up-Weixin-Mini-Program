<script setup lang="ts">
import { reactive, toRefs, nextTick } from 'vue';
import { onShow, onHide, onUnload, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import type { Team, PageEvent } from '../../types/domain';
import { eventWithDataset } from "../../utils/state";
import { platform as hostPlatform } from "../../platform/host";

import { isSinglePage } from "../../utils/runtime";
import { decorateTeam } from "../../utils/format";
import { callTeam, showError } from "../../utils/cloud";
import { plazaShare, bindCopyUrl, unbindCopyUrl, shareToFriend, shareToTimeline } from "../../utils/share";
import { teamDetailPath } from "../../utils/team-entry";
import { SORT_MODES, DEFAULT_SORT, buildLobbyView } from "../../utils/lobby";
import { FEATURED_GAMES } from "../../utils/games";
// 主页转发到群/朋友圈的卡片文案
const HOME_SHARE_TITLE = "找一些朋友，玩一些游戏";
const PAGE_SIZE = 20;
// 搜索框每敲一个字都会在已加载的数据上重跑筛选+排序，防抖后再算。
const SEARCH_DEBOUNCE_MS = 280;
function uniqueGames(list: Team[]) {
    const seen: Record<string, boolean> = {};
    const games = ["全部"];
    (list || []).forEach((t) => {
        const name = (t.gameName || "").trim();
        if (!name || seen[name])
            return;
        seen[name] = true;
        games.push(name);
    });
    return games;
}
// 分页累加时可能拿到重复的车（翻页期间有人新建），按队伍 id 去重。
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
const state = reactive({ teams: [] as Team[], nextOffset: 0, searchTimer: null as ReturnType<typeof setTimeout> | null, singlePage: false, ...{
        total: 0,
        listError: "",
        filtered: [] as Team[],
        games: ["全部"],
        gameFilter: "全部",
        keyword: "",
        featured: FEATURED_GAMES,
        sorts: SORT_MODES,
        sortMode: DEFAULT_SORT,
        hasMore: false,
        loading: false,
        loadingMore: false,
    } });
const { singlePage, total, listError, filtered, games, gameFilter, keyword, featured, sorts, sortMode, hasMore, loading, loadingMore } = toRefs(state);
function patchState(patch: Partial<typeof state>, done?: () => void) {
  Object.assign(state, patch);
  if (done) void nextTick(done);
}
function resetGameFilter() {
    if (state.gameFilter === "全部")
        return;
    patchState({
        gameFilter: "全部",
        filtered: buildView(state.teams, {
            gameFilter: "全部",
            keyword: state.keyword,
            sortMode: state.sortMode,
        }),
    });
}
function loadMore() {
    if (!state.hasMore || state.loading || state.loadingMore)
        return;
    loadList(false);
}
async function loadList(reset = true) {
    if (isSinglePage())
        return;
    const offset = reset ? 0 : state.nextOffset || 0;
    patchState(reset ? { loading: true } : { loadingMore: true });
    try {
        patchState({ listError: "" });
        const res = await callTeam("listTeams", { offset, limit: PAGE_SIZE });
        const page = (res.list || []).map(decorateTeam);
        const teams = reset ? mergeTeams([], page) : mergeTeams(state.teams, page);
        state.teams = teams;
        state.nextOffset =
            typeof res.nextOffset === "number" ? res.nextOffset : offset + page.length;
        const games = uniqueGames(teams);
        let gameFilter = state.gameFilter;
        if (games.indexOf(gameFilter) < 0)
            gameFilter = "全部";
        patchState({
            total: teams.length,
            games,
            gameFilter,
            hasMore: !!res.hasMore,
            filtered: buildView(teams, {
                gameFilter,
                keyword: state.keyword,
                sortMode: state.sortMode,
            }),
        });
    }
    catch (error) {
        const e: Error & { code?: string } = error instanceof Error ? error : new Error(String(error));
        patchState({ listError: e.message || "加载失败，请稍后重试" });
        showError(e);
    }
    finally {
        patchState({ loading: false, loadingMore: false });
    }
}
function buildView(teams: Team[], { gameFilter, keyword, sortMode }: { gameFilter: string; keyword: string; sortMode: string }) {
    return buildLobbyView(teams, { gameFilter, keyword, sortMode });
}
function pickGame(e: PageEvent) {
    const gameFilter = e.currentTarget.dataset.name;
    patchState({
        gameFilter,
        filtered: buildView(state.teams, {
            gameFilter,
            keyword: state.keyword,
            sortMode: state.sortMode,
        }),
    });
}
function pickSort(e: PageEvent) {
    const sortMode = e.currentTarget.dataset.key;
    if (!SORT_MODES.some((m) => m.key === sortMode))
        return;
    patchState({
        sortMode,
        filtered: buildView(state.teams, {
            gameFilter: state.gameFilter,
            keyword: state.keyword,
            sortMode,
        }),
    });
}
function cancelSearch() {
    if (state.searchTimer)
        clearTimeout(state.searchTimer);
    state.searchTimer = null;
}
function onSearch(e: PageEvent) {
    const keyword = (e.detail && e.detail.value) || "";
    patchState({ keyword });
    cancelSearch();
    state.searchTimer = setTimeout(() => {
        state.searchTimer = null;
        patchState({
            filtered: buildView(state.teams, {
                gameFilter: state.gameFilter,
                keyword: state.keyword,
                sortMode: state.sortMode,
            }),
        });
    }, SEARCH_DEBOUNCE_MS);
}
function clearSearch() {
    cancelSearch();
    patchState({
        keyword: "",
        filtered: buildView(state.teams, {
            gameFilter: state.gameFilter,
            keyword: "",
            sortMode: state.sortMode,
        }),
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
    hostPlatform.switchTab({ url: "/pages/publish/publish" });
}
onShow(() => {
    const singlePage = isSinglePage();
    patchState({ singlePage });
    if (singlePage)
        return;
    bindCopyUrl(hostPlatform, () => plazaShare(HOME_SHARE_TITLE));
    resetGameFilter();
    loadList();
});
onHide(() => {
    unbindCopyUrl(hostPlatform);
});
onUnload(() => {
    unbindCopyUrl(hostPlatform);
    cancelSearch();
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
    return shareToFriend(plazaShare(HOME_SHARE_TITLE));
});
onShareTimeline(() => {
    return shareToTimeline(plazaShare(HOME_SHARE_TITLE));
});
</script>
<template>
<timeline-preview v-if="singlePage" />
<template v-else>
<view class="page">
  <view class="hero">
    <view class="hero-copy">
      <view class="hero-title">找游戏搭子，一起开黑</view>
      <view class="hero-sub">王者开黑、三角洲搭子、瓦搭子、和平精英搭子，快速找到一起玩的队友。</view>
    </view>
    <image class="hero-art" src="/static/images/brand/lobby-v1.jpg" mode="aspectFit" aria-hidden="true" />
  </view>

  <view class="seo-games">
    <view class="seo-kicker">热门游戏搭子</view>
    <view class="seo-game-list">
      <template v-for="(item, index) in featured" :key="item.seoKey"><navigator class="seo-game" :url="'/pages/game/game?game=' + (item.seoKey)" hover-class="seo-game-hover">{{item.entryLabel}}</navigator></template>
    </view>
  </view>

  <view class="section-head">
    <view class="zone">现在的车<text class="section-count">{{filtered.length}}/{{total}}</text></view>
    <view class="sorts">
      <template v-for="(item, index) in sorts" :key="item.key"><view :class="'sort ' + (sortMode === item.key ? 'sort-on' : '')" :data-key="item.key" @tap="pickSort(eventWithDataset($event, {'key': item.key}))">{{item.label}}</view></template>
    </view>
  </view>

  <view class="toolbar">
    <view class="search">
      <input class="search-input" type="text" placeholder="搜索游戏 / 区服" :value="keyword" maxlength="20" confirm-type="search" @input="onSearch(eventWithDataset($event, {}))" />
      <text v-if="keyword" class="search-clear" @tap.stop.prevent="clearSearch()">✕</text>
    </view>
    <scroll-view v-if="games.length > 1" class="filters" scroll-x>
      <view class="filters-inner">
        <template v-for="(item, index) in games" :key="item"><view :class="'filter ' + (gameFilter === item ? 'filter-on' : '')" :data-name="item" @tap="pickGame(eventWithDataset($event, {'name': item}))">{{item}}</view></template>
      </view>
    </scroll-view>
  </view>

  <view v-if="loading && !total" class="empty">正在找车…</view>
  <view v-else-if="listError && !total" class="empty">
    <view>{{listError}}</view>
    <button class="btn-ghost" @tap="loadList(true)">重新加载</button>
  </view>
  <view v-else-if="!total" class="empty">
    <image class="empty-art" src="/static/images/brand/empty-v1.jpg" mode="aspectFit" lazy-load aria-hidden="true" />
    <view class="empty-title">没找到合适的队伍？</view>
    <view class="empty-sub">可以去发车，等队友来上车</view>
    <button class="list-end-btn" @tap="goPublish()">去发车</button>
  </view>
  <view v-else-if="!filtered.length && keyword" class="empty">
    <view>已加载的车里没搜到「{{keyword}}」。</view>
    <button v-if="hasMore" class="btn-ghost empty-btn" @tap="loadMore()">继续加载更多</button>
    <button v-else class="btn-ghost empty-btn" @tap="clearSearch()">清空搜索</button>
  </view>
  <view v-else-if="!filtered.length" class="empty">
    <image class="empty-art" src="/static/images/brand/empty-v1.jpg" mode="aspectFit" lazy-load aria-hidden="true" />
    <view class="empty-title">没找到合适的队伍？</view>
    <view class="empty-sub">可以去发车，等队友来上车</view>
    <button class="list-end-btn" @tap="goPublish()">去发车</button>
  </view>

  <template v-for="(item, index) in filtered" :key="item._id"><team-card :team="item" :team-id="item.id || item._id" :mark="item.mark" @open="onOpen({ detail: $event })" /></template>
  <view v-if="filtered.length && loadingMore" class="load-more">正在加载更多…</view>
  <view v-else-if="filtered.length && !hasMore" class="list-end">
    <view class="list-end-title">没找到合适的队伍？</view>
    <view class="list-end-sub">可以去发车，等队友来上车</view>
    <button class="list-end-btn" @tap="goPublish()">去发车</button>
  </view>
  <view v-else-if="filtered.length && hasMore" class="load-more">上拉加载更多</view>
  <welcome-letter />
</view>

</template>

</template>
<style scoped>
.hero { display: flex; align-items: center; justify-content: space-between; margin: 0 0 20rpx; gap: 12rpx; }
.hero-copy { flex: 1; min-width: 0; position: relative; z-index: 1; }
.hero-title { font-size: 40rpx; font-weight: 700; letter-spacing: -1rpx; line-height: 1.35; }
.hero-sub { margin-top: 6rpx; color: #777e92; font-size: 24rpx; line-height: 1.55; }
.hero-art { width: 232rpx; height: 190rpx; flex-shrink: 0; border-radius: 20rpx; }
button.hero-create { margin: 16rpx 0 0; padding: 10rpx 18rpx; width: auto; line-height: 36rpx; font-size: 24rpx; color: #6255e7; background: #eeecff; border-radius: 12rpx; }

.seo-games { margin: 0 0 28rpx; }
.seo-kicker { margin-bottom: 14rpx; font-size: 26rpx; font-weight: 600; }
.seo-game-list { display: flex; flex-wrap: wrap; gap: 14rpx; }
.seo-game { padding: 16rpx 26rpx; min-height: 64rpx; box-sizing: border-box; display: inline-flex; align-items: center; background: #fff; border: 1rpx solid #d4cff6; border-radius: 32rpx; color: #4437b5; font-size: 24rpx; line-height: 1.3; }
.seo-game-hover { background: #eeecff; border-color: #c8c1fb; }

.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20rpx; gap: 16rpx; }
.zone { font-size: 29rpx; font-weight: 600; flex-shrink: 0; }
.section-count { margin-left: 10rpx; font-size: 23rpx; font-weight: 400; color: #9aa0b4; }
.sorts { display: inline-flex; flex-shrink: 0; gap: 4rpx; padding: 5rpx; background: #eceef6; border-radius: 26rpx; }
.sort { padding: 8rpx 18rpx; border-radius: 21rpx; color: #737a90; font-size: 23rpx; line-height: 1.3; }
.sort-on { background: #fff; color: #6255e7; font-weight: 600; }

.toolbar { display: flex; flex-direction: column; align-items: stretch; gap: 14rpx; margin-bottom: 20rpx; }
.search { position: relative; display: flex; align-items: center; width: 100%; }
.search-input { width: 100%; height: 68rpx; padding: 0 56rpx 0 26rpx; box-sizing: border-box; background: #fff; border: 1rpx solid #e8eaf2; border-radius: 34rpx; font-size: 25rpx; color: #202438; }
.search-clear { position: absolute; right: 22rpx; width: 36rpx; height: 36rpx; line-height: 36rpx; text-align: center; color: #9aa0b4; font-size: 24rpx; }
.filters { width: 100%; white-space: nowrap; }
.filters-inner { display: inline-flex; gap: 12rpx; }
.filter { padding: 14rpx 22rpx; background: #fff; border: 1rpx solid #e8eaf2; border-radius: 30rpx; color: #737a90; font-size: 24rpx; line-height: 1.3; }
.filter-on { background: #6255e7; color: #fff; border-color: #6255e7; }

.load-more { padding: 28rpx 0 8rpx; text-align: center; color: #9aa0b4; font-size: 24rpx; }
.empty { padding-top: 24rpx; }
.empty-btn { width: 300rpx; margin: 28rpx auto 0; }
.empty-title { color: #535b72; font-size: 28rpx; }
.empty-sub { margin-top: 4rpx; color: #9aa0b4; font-size: 24rpx; }

.list-end { padding: 32rpx 0 12rpx; text-align: center; }
.list-end-title { color: #737a90; font-size: 25rpx; line-height: 1.5; }
.list-end-sub { margin-top: 4rpx; color: #9aa0b4; font-size: 23rpx; line-height: 1.5; }
button.list-end-btn { display: inline-block; margin: 18rpx auto 0; padding: 10rpx 28rpx; width: auto; min-width: 0; line-height: 36rpx; font-size: 24rpx; font-weight: 500; color: #6255e7; background: #eeecff; border-radius: 14rpx; }

</style>
