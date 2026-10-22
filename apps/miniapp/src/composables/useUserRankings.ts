import { computed, reactive, ref } from 'vue';
import { onShow, onHide, onUnload, onPullDownRefresh } from '@dcloudio/uni-app';
import { callTeam } from '../api/team';
import { platform } from '../platform/host';
import { isSinglePage } from '../utils/runtime';
import type { RankingUser, User } from '../types/domain';
export function useUserRankings() {
  const singlePage = ref(isSinglePage());
  const mode = ref<'hosted' | 'joined'>('hosted');
  const state = reactive({
    hosted: [] as RankingUser[],
    joined: [] as RankingUser[],
    loading: false,
    loaded: false,
    error: '',
  });
  const profile = ref<User | null>(null);
  function openProfile(user?: RankingUser) {
    if (!user) return;
    profile.value = {
      nickName: user.nickName,
      avatarUrl: user.avatarUrl,
      bio: user.bio || '',
      steamFriendCode: user.steamFriendCode || '',
      wechatId: user.wechatId || '',
      groupIds: user.groupIds || [],
      favoriteGames: user.favoriteGames || [],
      playTimes: user.playTimes || [],
    };
  }
  const rows = computed(() => state[mode.value]);
  let active = true,
    revision = 0;
  async function load() {
    if (singlePage.value) return;
    const id = ++revision;
    state.loading = true;
    state.error = '';
    try {
      const result = await callTeam('getUserRankings');
      if (!active || id !== revision) return;
      state.hosted = result.hosted;
      state.joined = result.joined;
      state.loaded = true;
    } catch (error) {
      if (active && id === revision) state.error = error instanceof Error ? error.message : '排行加载失败';
    } finally {
      if (id === revision) state.loading = false;
    }
  }
  onShow(() => {
    singlePage.value = isSinglePage();
    active = true;
    void load();
  });
  function stop() {
    active = false;
    revision++;
    state.loading = false;
  }
  onHide(stop);
  onUnload(stop);
  onPullDownRefresh(() => load().finally(() => platform.stopPullDownRefresh()));
  return { singlePage, mode, state, rows, load, profile, openProfile };
}
