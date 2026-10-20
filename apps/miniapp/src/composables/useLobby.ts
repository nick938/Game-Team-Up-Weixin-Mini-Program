import { cardShareFromEvent } from '../utils/card-share';
import { ref, computed } from 'vue';
import {
  onShow,
  onHide,
  onUnload,
  onPullDownRefresh,
  onReachBottom,
  onShareAppMessage,
  onShareTimeline,
} from '@dcloudio/uni-app';
import { platform as hostPlatform } from '../platform/host';
import { isSinglePage } from '../utils/runtime';
import { plazaShare, bindCopyUrl, unbindCopyUrl, shareToFriend, shareToTimeline } from '../utils/share';
import { teamDetailPath } from '../utils/team-entry';
import { GAME_CATALOG, FEATURED_GAMES, findGame } from '../utils/games';
import { recentGames } from '../utils/recent-games';
import { callTeam } from '../api/team';
import { decorateTeam } from '../utils/format';
import { scheduledTeams } from '../utils/team-schedule';
import { useTeamSearch } from './useTeamSearch';
import type { Team } from '../types/domain';
import { useAppStore } from '../stores/app';
export function useLobby() {
  const search = useTeamSearch();
  const app = useAppStore();
  const singlePage = ref(false);
  const personalTeams = ref<Team[]>([]);
  const recruitingTeam = computed(() =>
    scheduledTeams(personalTeams.value).find(
      (team) =>
        team.mark === '我发起的' && team.memberCount < team.capacity && team._id !== nextTeam.value?._id,
    ),
  );
  const recent = ref<string[]>([]);
  const nextTeam = computed(() => scheduledTeams(personalTeams.value)[0]);
  const featured = FEATURED_GAMES;
  const gameOptions = computed(() =>
    [
      ...new Set([
        '全部',
        ...search.state.games,
        ...recent.value,
        ...GAME_CATALOG.map((game) => game.name),
        search.state.gameFilter,
      ]),
    ]
      .filter(Boolean)
      .map((name) => ({ label: name, value: name })),
  );
  const gameTabs = computed(() => {
    const quick = gameOptions.value
      .map((item) => item.value)
      .filter((name) => name !== '全部')
      .slice(0, 3);
    const selected = search.state.gameFilter;
    if (selected !== '全部' && !quick.includes(selected)) quick.splice(2, 1, selected);
    return ['全部', ...quick];
  });
  const HOME_SHARE_TITLE = '找一些朋友，玩一些游戏';
  function onOpen(input: { id?: string; gameName?: string }) {
    const url = teamDetailPath(input.id, { gameName: input.gameName });
    if (url) hostPlatform.navigateTo({ url });
  }
  function goPublish() {
    const name =
      search.state.gameFilter !== '全部'
        ? search.state.gameFilter
        : findGame(search.state.keyword)?.name || '';
    if (name) {
      const game = findGame(name);
      app.prefillGame = { name: game?.name || name, platform: game?.platform || 'Steam' };
    }
    hostPlatform.switchTab({ url: '/pages/publish/publish' });
  }
  function goGame(key: string) {
    hostPlatform.navigateTo({ url: `/pages/game/game?game=${encodeURIComponent(key)}` });
  }
  async function loadUpcoming() {
    if (isSinglePage()) return;
    try {
      const res = await callTeam('myTeams');
      personalTeams.value = [
        ...res.hosted.map((team) => ({ ...team, mark: '我发起的' })),
        ...res.joined.map((team) => ({ ...team, mark: '已加入' })),
      ].map(decorateTeam);
    } catch {
      personalTeams.value = [];
    }
  }
  onShow(() => {
    singlePage.value = isSinglePage();
    search.state.singlePage = singlePage.value;
    if (singlePage.value) return;
    recent.value = recentGames();
    bindCopyUrl(hostPlatform, () => plazaShare(HOME_SHARE_TITLE));
    void search.loadList(true, { keepVisible: true });
    void loadUpcoming();
  });
  onHide(() => {
    unbindCopyUrl(hostPlatform);
  });
  onUnload(() => {
    unbindCopyUrl(hostPlatform);
    search.cancelSearch();
  });
  onPullDownRefresh(() =>
    Promise.all([search.loadList(), loadUpcoming()]).finally(() => hostPlatform.stopPullDownRefresh()),
  );
  onReachBottom(() => {
    if (!isSinglePage()) void search.loadMore();
  });
  onShareAppMessage((event) => cardShareFromEvent(event) || shareToFriend(plazaShare(HOME_SHARE_TITLE)));
  onShareTimeline(() => shareToTimeline(plazaShare(HOME_SHARE_TITLE)));
  return {
    gameTabs,
    gameOptions,
    ...search,
    singlePage,
    featured,
    recent,
    nextTeam,
    recruitingTeam,
    loadUpcoming,
    HOME_SHARE_TITLE,
    onOpen,
    goPublish,
    goGame,
  };
}
