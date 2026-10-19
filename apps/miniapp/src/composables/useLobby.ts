import { usePageFeedback } from './usePageFeedback';
import { reactive, toRefs, nextTick } from 'vue';
import {
  onShow,
  onHide,
  onUnload,
  onPullDownRefresh,
  onReachBottom,
  onShareAppMessage,
  onShareTimeline,
} from '@dcloudio/uni-app';
import type { Team } from '../types/domain';
import { platform as hostPlatform } from '../platform/host';
import { isSinglePage } from '../utils/runtime';
import { decorateTeam } from '../utils/format';
import { callTeam } from '../api/team';
import { plazaShare, bindCopyUrl, unbindCopyUrl, shareToFriend, shareToTimeline } from '../utils/share';
import { teamDetailPath } from '../utils/team-entry';
import { SORT_MODES, DEFAULT_SORT, buildLobbyView } from '../utils/lobby';
import { FEATURED_GAMES } from '../utils/games';
export function useLobby() {
  const { showError } = usePageFeedback();
  const HOME_SHARE_TITLE = '找一些朋友，玩一些游戏';
  const PAGE_SIZE = 20;
  const SEARCH_DEBOUNCE_MS = 280;
  function uniqueGames(list: Team[]) {
    const seen: Record<string, boolean> = {};
    const games = ['全部'];
    (list || []).forEach((t) => {
      const name = (t.gameName || '').trim();
      if (!name || seen[name]) return;
      seen[name] = true;
      games.push(name);
    });
    return games;
  }
  function mergeTeams(current: Team[], incoming: Team[]) {
    const seen: Record<string, boolean> = {};
    const out: Team[] = [];
    (current || []).concat(incoming || []).forEach((t) => {
      const id = t.id || t._id;
      if (!id || seen[id]) return;
      seen[id] = true;
      out.push(t);
    });
    return out;
  }
  const state = reactive({
    teams: [] as Team[],
    nextOffset: 0,
    searchTimer: null as ReturnType<typeof setTimeout> | null,
    singlePage: false,
    ...{
      total: 0,
      listError: '',
      filtered: [] as Team[],
      games: ['全部'],
      gameFilter: '全部',
      keyword: '',
      featured: FEATURED_GAMES,
      sorts: SORT_MODES,
      sortMode: DEFAULT_SORT,
      hasMore: false,
      loading: false,
      loadingMore: false,
    },
  });
  const {
    singlePage,
    total,
    listError,
    filtered,
    games,
    gameFilter,
    keyword,
    featured,
    sorts,
    sortMode,
    hasMore,
    loading,
    loadingMore,
  } = toRefs(state);
  function patchState(patch: Partial<typeof state>, done?: () => void) {
    Object.assign(state, patch);
    if (done) void nextTick(done);
  }
  function resetGameFilter() {
    if (state.gameFilter === '全部') return;
    patchState({
      gameFilter: '全部',
      filtered: buildView(state.teams, {
        gameFilter: '全部',
        keyword: state.keyword,
        sortMode: state.sortMode,
      }),
    });
  }
  function loadMore() {
    if (!state.hasMore || state.loading || state.loadingMore) return;
    loadList(false);
  }
  async function loadList(reset = true) {
    if (isSinglePage() || state.loading || state.loadingMore) return;
    const offset = reset ? 0 : state.nextOffset || 0;
    patchState(reset ? { loading: true } : { loadingMore: true });
    try {
      patchState({ listError: '' });
      const res = await callTeam('listTeams', { offset, limit: PAGE_SIZE });
      const page = (res.list || []).map(decorateTeam);
      const teams = reset ? mergeTeams([], page) : mergeTeams(state.teams, page);
      state.teams = teams;
      state.nextOffset = typeof res.nextOffset === 'number' ? res.nextOffset : offset + page.length;
      const games = uniqueGames(teams);
      let gameFilter = state.gameFilter;
      if (games.indexOf(gameFilter) < 0) gameFilter = '全部';
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
    } catch (error) {
      const e: Error & { code?: string } = error instanceof Error ? error : new Error(String(error));
      patchState({ listError: e.message || '加载失败，请稍后重试' });
      showError(e);
    } finally {
      patchState({ loading: false, loadingMore: false });
    }
  }
  function buildView(
    teams: Team[],
    { gameFilter, keyword, sortMode }: { gameFilter: string; keyword: string; sortMode: string },
  ) {
    return buildLobbyView(teams, { gameFilter, keyword, sortMode });
  }
  function pickGame(input: string) {
    const gameFilter = input;
    patchState({
      gameFilter,
      filtered: buildView(state.teams, {
        gameFilter,
        keyword: state.keyword,
        sortMode: state.sortMode,
      }),
    });
  }
  function pickSort(input: string) {
    const sortMode = input;
    if (!SORT_MODES.some((m) => m.key === sortMode)) return;
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
    if (state.searchTimer) clearTimeout(state.searchTimer);
    state.searchTimer = null;
  }
  function onSearch(input: string) {
    const keyword = input || '';
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
      keyword: '',
      filtered: buildView(state.teams, {
        gameFilter: state.gameFilter,
        keyword: '',
        sortMode: state.sortMode,
      }),
    });
  }
  function onOpen(input: { id?: string; gameName?: string }) {
    const id = input.id;
    const url = teamDetailPath(id, { gameName: input.gameName });
    if (!url) return;
    hostPlatform.navigateTo({ url });
  }
  function goPublish() {
    hostPlatform.switchTab({ url: '/pages/publish/publish' });
  }
  onShow(() => {
    const singlePage = isSinglePage();
    patchState({ singlePage });
    if (singlePage) return;
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
    if (isSinglePage()) return;
    loadMore();
  });
  onShareAppMessage(() => {
    return shareToFriend(plazaShare(HOME_SHARE_TITLE));
  });
  onShareTimeline(() => {
    return shareToTimeline(plazaShare(HOME_SHARE_TITLE));
  });
  function goGame(key: string) {
    hostPlatform.navigateTo({ url: `/pages/game/game?game=${encodeURIComponent(key)}` });
  }
  return {
    goGame,
    HOME_SHARE_TITLE,
    PAGE_SIZE,
    SEARCH_DEBOUNCE_MS,
    uniqueGames,
    mergeTeams,
    state,
    singlePage,
    total,
    listError,
    filtered,
    games,
    gameFilter,
    keyword,
    featured,
    sorts,
    sortMode,
    hasMore,
    loading,
    loadingMore,
    patchState,
    resetGameFilter,
    loadMore,
    loadList,
    buildView,
    pickGame,
    pickSort,
    cancelSearch,
    onSearch,
    clearSearch,
    onOpen,
    goPublish,
  };
}
