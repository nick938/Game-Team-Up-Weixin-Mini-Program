import { usePageFeedback } from './usePageFeedback';
import { reactive, toRefs, nextTick } from 'vue';
import {
  onLoad,
  onShow,
  onHide,
  onUnload,
  onPullDownRefresh,
  onReachBottom,
  onShareAppMessage,
  onShareTimeline,
} from '@dcloudio/uni-app';
import type { Team, Game, SharePayload, PageQuery } from '../types/domain';
import { platform as hostPlatform } from '../platform/host';
import { useAppStore } from '../stores/app';
import { isSinglePage } from '../utils/runtime';
import { decorateTeam } from '../utils/format';
import { callTeam } from '../api/team';
import { bindCopyUrl, unbindCopyUrl, shareToFriend, shareToTimeline } from '../utils/share';
import { teamDetailPath } from '../utils/team-entry';
import { SORT_MODES, DEFAULT_SORT, sortTeams } from '../utils/lobby';
import { FEATURED_GAMES, resolveGameQuery, filterTeamsByGame, gameShare, pageSeo } from '../utils/games';
export function useGame() {
  const { showError } = usePageFeedback();
  const PAGE_SIZE = 20;
  const SCAN_PAGES = 5;
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
  function othersOf(game: Game | null) {
    if (!game) return FEATURED_GAMES;
    return FEATURED_GAMES.filter((item) => item.slug !== game.slug);
  }
  const state = reactive({
    teams: [] as Team[],
    nextOffset: 0,
    sharePayload: null as SharePayload | null,
    singlePage: false,
    ...{
      featured: FEATURED_GAMES,
      others: FEATURED_GAMES,
      game: null as Game | null,
      gameKey: '',
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
    },
  });
  const {
    singlePage,
    featured,
    others,
    game,
    gameKey,
    seoTitle,
    seoHeading,
    seoDescription,
    tags,
    filtered,
    sorts,
    sortMode,
    hasMore,
    loading,
    loadingMore,
    listError,
  } = toRefs(state);
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
    if (!state.hasMore || state.loading || state.loadingMore) return;
    loadList(false);
  }
  async function loadList(reset = true) {
    if (isSinglePage() || !state.game) return;
    if (state.loading || state.loadingMore) return;
    patchState(reset ? { loading: true, listError: false } : { loadingMore: true, listError: false });
    try {
      let hasMore = state.hasMore;
      let rounds = 0;
      const maxRounds = reset ? SCAN_PAGES : 1;
      do {
        const offset = reset && rounds === 0 ? 0 : state.nextOffset || 0;
        const res = await callTeam('listTeams', { offset, limit: PAGE_SIZE });
        const page = (res.list || []).map(decorateTeam);
        const teams = reset && rounds === 0 ? mergeTeams([], page) : mergeTeams(state.teams, page);
        state.teams = teams;
        state.nextOffset = typeof res.nextOffset === 'number' ? res.nextOffset : offset + page.length;
        hasMore = !!res.hasMore;
        rounds += 1;
        patchState({
          hasMore,
          listError: false,
          filtered: buildView(teams, state.sortMode),
        });
      } while (reset && state.filtered.length < 8 && hasMore && rounds < maxRounds);
    } catch (error) {
      const e: Error & { code?: string } = error instanceof Error ? error : new Error(String(error));
      patchState({ listError: true });
      showError(e);
    } finally {
      patchState({ loading: false, loadingMore: false });
    }
  }
  function buildView(teams: Team[], sortMode: string) {
    return sortTeams(filterTeamsByGame(teams, state.game), sortMode);
  }
  function pickSort(input: string) {
    const sortMode = input;
    if (!SORT_MODES.some((m) => m.key === sortMode)) return;
    patchState({
      sortMode,
      filtered: buildView(state.teams, sortMode),
    });
  }
  function onOpen(input: { id?: string; gameName?: string }) {
    const id = input.id;
    const url = teamDetailPath(id, { gameName: input.gameName });
    if (!url) return;
    hostPlatform.navigateTo({ url });
  }
  function goPublish() {
    const app = useAppStore();
    const game = state.game || state.game;
    if (game) {
      app.prefillGame = {
        name: game.name,
        platform: game.platform,
      };
    }
    hostPlatform.switchTab({ url: '/pages/publish/publish' });
  }
  function goPlaza() {
    hostPlatform.switchTab({ url: '/pages/index/index' });
  }
  onLoad((options = {}) => {
    applyGame(options);
  });
  onShow(() => {
    const singlePage = isSinglePage();
    patchState({ singlePage });
    if (singlePage) return;
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
    if (isSinglePage()) return;
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
  function goGame(key: string) {
    hostPlatform.navigateTo({ url: `/pages/game/game?game=${encodeURIComponent(key)}` });
  }
  return {
    goGame,
    PAGE_SIZE,
    SCAN_PAGES,
    mergeTeams,
    othersOf,
    state,
    singlePage,
    featured,
    others,
    game,
    gameKey,
    seoTitle,
    seoHeading,
    seoDescription,
    tags,
    filtered,
    sorts,
    sortMode,
    hasMore,
    loading,
    loadingMore,
    listError,
    patchState,
    applyGame,
    loadMore,
    loadList,
    buildView,
    pickSort,
    onOpen,
    goPublish,
    goPlaza,
  };
}
