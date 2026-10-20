import { cardShareFromEvent } from '../utils/card-share';
import { ref } from 'vue';
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
import type { Game, PageQuery } from '../types/domain';
import { platform as hostPlatform } from '../platform/host';
import { useAppStore } from '../stores/app';
import { isSinglePage } from '../utils/runtime';
import { bindCopyUrl, unbindCopyUrl, shareToFriend, shareToTimeline } from '../utils/share';
import { teamDetailPath } from '../utils/team-entry';
import { FEATURED_GAMES, resolveGameQuery, gameShare, pageSeo } from '../utils/games';
import { rememberGame } from '../utils/recent-games';
import { useTeamSearch } from './useTeamSearch';
export function useGame() {
  const singlePage = ref(false);
  const game = ref<Game | null>(null);
  const search = useTeamSearch(() =>
    game.value
      ? { gameName: '', gameNames: [game.value.name, ...(game.value.aliases || []), game.value.slug] }
      : {},
  );
  function applyGame(options: PageQuery = {}) {
    const name = String(options.game || options.name || '')
      .trim()
      .slice(0, 40);
    game.value =
      resolveGameQuery(options) ||
      (name
        ? {
            name,
            slug: name,
            platform: 'Steam',
            tags: [],
            navTitle: name + '组队',
            headline: name + '找队友',
            blurb: '约好时间，找到一起开黑的人。',
          }
        : null);
    if (game.value && !isSinglePage()) {
      try {
        rememberGame(game.value.name);
      } catch {
        // Local history must not prevent the game page from opening.
      }
    }
    hostPlatform.setNavigationBarTitle({ title: pageSeo(game.value).title });
  }
  function onOpen(input: { id?: string; gameName?: string }) {
    const url = teamDetailPath(input.id, { gameName: input.gameName });
    if (url) hostPlatform.navigateTo({ url });
  }
  function goPublish() {
    if (game.value) useAppStore().prefillGame = { name: game.value.name, platform: game.value.platform };
    hostPlatform.switchTab({ url: '/pages/publish/publish' });
  }
  function goPlaza() {
    hostPlatform.switchTab({ url: '/pages/index/index' });
  }
  function goGame(key: string) {
    hostPlatform.navigateTo({ url: `/pages/game/game?game=${encodeURIComponent(key)}` });
  }
  onLoad((options = {}) => applyGame(options));
  onShow(() => {
    singlePage.value = isSinglePage();
    search.state.singlePage = singlePage.value;
    if (singlePage.value) return;
    bindCopyUrl(hostPlatform, () => gameShare(game.value));
    void search.loadList();
  });
  onHide(() => unbindCopyUrl(hostPlatform));
  onUnload(() => {
    unbindCopyUrl(hostPlatform);
    search.cancelSearch();
  });
  onPullDownRefresh(() => search.loadList().finally(() => hostPlatform.stopPullDownRefresh()));
  onReachBottom(() => {
    if (!isSinglePage()) void search.loadMore();
  });
  onShareAppMessage((event) => cardShareFromEvent(event) || shareToFriend(gameShare(game.value)));
  onShareTimeline(() => shareToTimeline(gameShare(game.value)));
  Object.defineProperties(search.state, {
    game: { get: () => game.value },
    seoTitle: { get: () => pageSeo(game.value).title },
  });
  return {
    ...search,
    singlePage,
    game,
    featured: FEATURED_GAMES,
    others: FEATURED_GAMES,
    applyGame,
    onOpen,
    goPublish,
    goPlaza,
    goGame,
  };
}
