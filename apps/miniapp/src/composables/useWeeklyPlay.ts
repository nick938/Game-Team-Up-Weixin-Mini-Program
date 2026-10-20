import { reactive, ref, computed } from 'vue';
import { onShow, onHide, onUnload, onPullDownRefresh } from '@dcloudio/uni-app';
import { callTeam } from '../api/team';
import { platform } from '../platform/host';
import { useAppStore } from '../stores/app';
import { usePageFeedback } from './usePageFeedback';
import { useTeamSearch } from './useTeamSearch';
import type { WeeklyActivity } from '../types/domain';
import { isSinglePage } from '../utils/runtime';

export function useWeeklyPlay(withTeams = false) {
  const singlePage = ref(isSinglePage());
  const { toast, showError } = usePageFeedback();
  const app = useAppStore();
  const state = reactive({
    activity: null as WeeklyActivity | null,
    loading: false,
    voting: false,
    error: '',
  });
  const now = ref(Date.now());
  let offset = 0;
  let requestId = 0;
  let active = true;
  let timer: ReturnType<typeof setInterval> | undefined;
  const teams = useTeamSearch(() => ({ weeklyId: state.activity?.weekId || '', availableOnly: true }));
  const closed = computed(
    () => !!state.activity && (state.activity.votingClosed || now.value >= state.activity.drawAt),
  );
  const canPublish = computed(
    () =>
      !!state.activity?.selectedGame && now.value < state.activity.endAt && !state.error && !state.loading,
  );
  function apply(activity: WeeklyActivity) {
    state.activity = activity;
    offset = activity.serverNow - Date.now();
    now.value = Date.now() + offset;
  }
  async function load() {
    if (singlePage.value || state.voting) return;
    const id = ++requestId;
    state.loading = true;
    state.error = '';
    try {
      const result = await callTeam('getWeeklyPlay');
      if (id !== requestId || !active) return;
      apply(result.activity);
      if (withTeams && result.activity.selectedGame) await teams.loadList();
    } catch (error) {
      if (id === requestId) state.error = error instanceof Error ? error.message : '加载失败，请重试';
    } finally {
      if (id === requestId) state.loading = false;
    }
  }
  async function vote(gameId: string) {
    if (!state.activity || closed.value || state.voting || state.loading || state.error) return;
    state.voting = true;
    const id = ++requestId;
    try {
      const { activity } = await callTeam('votePlay', {
        weekId: state.activity.weekId,
        gameId: state.activity.mine === gameId ? '' : gameId,
      });
      if (!active || id !== requestId) return;
      apply(activity);
      toast.success(activity.mine ? '已记录想玩的游戏' : '已取消本期意向');
    } catch (error) {
      showError(error);
    } finally {
      state.voting = false;
      if (active && id !== requestId) void load();
    }
  }
  function publish() {
    if (!canPublish.value || !state.activity?.selectedGame) return;
    const { selectedGame, startAt, weekId } = state.activity;
    app.editingTeamId = null;
    app.republishTeam = null;
    app.prefillGame = { name: selectedGame.name, platform: selectedGame.platform, startAt, weeklyId: weekId };
    platform.switchTab({ url: '/pages/publish/publish' });
  }
  function stop() {
    active = false;
    requestId++;
    state.loading = false;
    clearInterval(timer);
  }
  onShow(() => {
    singlePage.value = isSinglePage();
    if (singlePage.value) return;
    active = true;
    void load();
    clearInterval(timer);
    timer = setInterval(() => {
      now.value = Date.now() + offset;
      void load();
    }, 30000);
  });
  onHide(stop);
  onUnload(stop);
  onPullDownRefresh(() => load().finally(() => platform.stopPullDownRefresh()));
  return { singlePage, state, now, closed, canPublish, teams, load, vote, publish };
}
