import { reactive, toRefs, onUnmounted } from 'vue';
import { callTeam } from '../api/team';
import { decorateTeam } from '../utils/format';
import { isSinglePage } from '../utils/runtime';
import type { Team, TeamSearch } from '../types/domain';
import { usePageFeedback } from './usePageFeedback';

/** Shared server search for the lobby and game landing pages. */
export function useTeamSearch(baseQuery: () => TeamSearch = () => ({})) {
  const { showError } = usePageFeedback();
  const state = reactive({
    singlePage: false,
    teams: [] as Team[],
    filtered: [] as Team[],
    total: 0,
    nextOffset: 0,
    games: ['全部'],
    gameFilter: '全部',
    keyword: '',
    sortMode: 'latest',
    platform: '',
    server: '',
    voice: '',
    time: '',
    availableOnly: true,
    hasMore: false,
    loading: false,
    loadingMore: false,
    listError: '',
  });
  let requestId = 0;
  let loadedQuery = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  function query(): TeamSearch {
    return {
      keyword: state.keyword.trim(),
      gameName: state.gameFilter === '全部' ? '' : state.gameFilter,
      platform: state.platform,
      server: state.server,
      voice: state.voice,
      time: state.time,
      availableOnly: state.availableOnly,
      sortMode: state.sortMode,
      ...baseQuery(),
    };
  }
  async function loadList(reset = true, options: { keepVisible?: boolean; keepForSort?: boolean } = {}) {
    if (isSinglePage() || (!reset && (state.loading || state.loadingMore || !state.hasMore))) return;
    clearTimeout(timer);
    const id = ++requestId;
    const offset = reset ? 0 : state.nextOffset;
    const requestQuery = query();
    const queryKey = JSON.stringify(requestQuery);
    // A cached tab may refresh in the background, but changed filters must never retain old results.
    const sameFilters =
      !!loadedQuery &&
      JSON.stringify({ ...JSON.parse(loadedQuery), sortMode: requestQuery.sortMode }) === queryKey;
    const keepVisible =
      (options.keepVisible && loadedQuery === queryKey) || (options.keepForSort && sameFilters);
    if (reset && !keepVisible)
      Object.assign(state, { teams: [], filtered: [], total: 0, hasMore: false, loadingMore: false });
    state.loading = reset;
    state.loadingMore = !reset;
    state.listError = '';
    try {
      const res = await callTeam('listTeams', { ...requestQuery, offset, limit: 20 });
      if (id !== requestId) return;
      loadedQuery = queryKey;
      const incoming = (res.list || []).map(decorateTeam);
      const byId = new Map((reset ? [] : state.teams).concat(incoming).map((team) => [team._id, team]));
      state.teams = [...byId.values()];
      state.filtered = state.teams;
      state.total = res.total ?? state.teams.length;
      state.nextOffset = res.nextOffset ?? offset + incoming.length;
      state.hasMore = !!res.hasMore;
      state.games = [
        ...new Set([
          '全部',
          ...(res.games || []),
          ...(state.gameFilter === '全部' ? [] : [state.gameFilter]),
        ]),
      ];
    } catch (error) {
      if (id !== requestId) return;
      state.listError = error instanceof Error ? error.message : '加载失败，请重试';
      showError(error);
    } finally {
      if (id === requestId) {
        state.loading = false;
        state.loadingMore = false;
      }
    }
  }
  function cancelSearch() {
    clearTimeout(timer);
  }
  function onSearch(value: string) {
    state.keyword = value;
    // Invalidate in-flight results immediately, including the debounce interval.
    ++requestId;
    Object.assign(state, {
      teams: [],
      filtered: [],
      total: 0,
      hasMore: false,
      loading: true,
      loadingMore: false,
      listError: '',
    });
    clearTimeout(timer);
    timer = setTimeout(() => void loadList(), 280);
  }
  function setFilters(patch: Partial<TeamSearch>) {
    Object.assign(state, patch);
    void loadList();
  }
  function clearFilters() {
    Object.assign(state, {
      keyword: '',
      gameFilter: '全部',
      platform: '',
      server: '',
      voice: '',
      time: '',
      availableOnly: true,
    });
    void loadList();
  }
  function clearSearch() {
    state.keyword = '';
    void loadList();
  }
  function pickGame(value: string) {
    state.gameFilter = value;
    void loadList();
  }
  function pickSort(value: string) {
    if (state.sortMode === value) return;
    state.sortMode = value;
    void loadList(true, { keepForSort: true });
  }
  function loadMore() {
    return loadList(false);
  }
  onUnmounted(() => {
    ++requestId;
    clearTimeout(timer);
  });
  return {
    state,
    ...toRefs(state),
    query,
    loadList,
    loadMore,
    onSearch,
    cancelSearch,
    setFilters,
    clearFilters,
    clearSearch,
    pickGame,
    pickSort,
  };
}
