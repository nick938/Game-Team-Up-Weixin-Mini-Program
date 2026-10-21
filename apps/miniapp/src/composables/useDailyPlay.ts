import { computed, reactive, ref } from 'vue';
import { onShow, onHide, onUnload, onPullDownRefresh } from '@dcloudio/uni-app';
import { callTeam } from '../api/team';
import { useAppStore } from '../stores/app';
import { platform } from '../platform/host';
import { usePageFeedback } from './usePageFeedback';
import { isSinglePage } from '../utils/runtime';
import type { DailyBoard, DailyOption } from '../types/domain';

export function useDailyPlay() {
  const singlePage = ref(isSinglePage());
  const { toast, showError } = usePageFeedback();
  const state = reactive({ board: null as DailyBoard | null, loading: false, busy: false, error: '' });
  const form = reactive({ gameName: '', platform: 'Steam' });
  const now = ref(Date.now());
  let offset = 0;
  const closed = computed(
    () =>
      !!state.board &&
      (state.board.votingClosed ||
        new Date(now.value + 8 * 3600000).toISOString().slice(0, 10) !== state.board.dayId),
  );
  const officialReady = computed(
    () => !!state.board && (state.board.settledAt > 0 || now.value >= state.board.settleAt),
  );
  const options = computed(() =>
    [...(state.board?.options || [])].sort(
      (a, b) => b.votes - a.votes || a.createdAt - b.createdAt || a.id.localeCompare(b.id),
    ),
  );
  const winner = computed(() => options.value.find((option) => option.id === state.board?.winnerId) || null);
  function applyBoard(board: DailyBoard) {
    state.board = board;
    offset = board.serverNow - Date.now();
    now.value = Date.now() + offset;
  }
  let active = true;
  let revision = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  const showProfile = ref(false);
  const showEditor = ref(false);
  let pendingAction: (() => Promise<void>) | undefined;
  function handleError(error: unknown, retry: () => Promise<void>) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'NEED_PROFILE') {
      pendingAction = retry;
      showProfile.value = true;
    } else showError(error);
  }
  function profileDone() {
    showProfile.value = false;
    const action = pendingAction;
    pendingAction = undefined;
    void action?.();
  }
  let draftKey = '';
  let draftSignature = '';
  async function load() {
    if (singlePage.value || state.busy) return;
    const id = ++revision;
    state.loading = true;
    try {
      const result = await callTeam('getDailyPlay');
      if (!active || id !== revision) return;
      applyBoard(result.board);
      state.error = '';
    } catch (error) {
      if (active && id === revision) state.error = error instanceof Error ? error.message : '加载失败';
    } finally {
      if (id === revision) state.loading = false;
    }
  }
  function applyMutation(board: DailyBoard | null) {
    if (board) applyBoard(board);
    state.error = board ? '' : '操作已成功，列表更新失败，请刷新查看';
  }
  async function create() {
    if (state.busy) return;
    if (closed.value) {
      toast.show('投票日期已更新，正在刷新，请稍后重试');
      await load();
      return;
    }
    if (!form.gameName.trim()) {
      toast.show('先填一个想玩的游戏吧');
      return;
    }
    const signature = JSON.stringify(form);
    if (signature !== draftSignature) {
      draftKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      draftSignature = signature;
    }
    state.busy = true;
    revision++;
    try {
      const result = await callTeam('createPlayOption', {
        ...form,
        gameName: form.gameName.trim(),
        requestId: draftKey,
      });
      applyMutation(result.board);
      if (JSON.stringify(form) === signature) {
        form.gameName = '';
        draftSignature = '';
      }
      showEditor.value = false;
      toast.success('投票已发起，已为你投一票');
    } catch (error) {
      handleError(error, create);
    } finally {
      state.busy = false;
      state.loading = false;
    }
  }
  function open(teamId: string) {
    platform.navigateTo({ url: `/pages/team/detail?teamId=${encodeURIComponent(teamId)}` });
  }
  function depart() {
    const board = state.board;
    if (!board?.teamId || !board.team) return;
    if (!board.team.pendingHost) {
      open(board.teamId);
      return;
    }
    platform.navigateTo({ url: `/pages/publish/claim?teamId=${encodeURIComponent(board.teamId)}` });
  }
  function launch(option: DailyOption) {
    const app = useAppStore();
    app.editingTeamId = null;
    app.republishTeam = null;
    app.prefillGame = { name: option.gameName, platform: option.platform, fromPlayVote: true };
    platform.switchTab({ url: '/pages/publish/publish' });
  }
  async function vote(option: DailyOption) {
    if (state.busy) return;
    if (closed.value) {
      toast.show('投票日期已更新，正在刷新，请稍后重试');
      await load();
      return;
    }
    state.busy = true;
    revision++;
    try {
      const { board } = await callTeam('votePlayOption', { optionId: option.id, want: !option.mine });
      applyMutation(board);
      toast.success(option.mine ? '已取消想玩' : '已加入想玩');
    } catch (error) {
      handleError(error, () => vote(option));
    } finally {
      state.busy = false;
      state.loading = false;
    }
  }
  function stop() {
    active = false;
    revision++;
    clearInterval(timer);
    state.loading = false;
  }
  onShow(() => {
    singlePage.value = isSinglePage();
    if (singlePage.value) return;
    active = true;
    void load();
    clearInterval(timer);
    let ticks = 0;
    timer = setInterval(() => {
      const wasReady = officialReady.value;
      now.value = Date.now() + offset;
      ticks++;
      if (ticks % 30 === 0 || (!wasReady && officialReady.value)) void load();
    }, 1000);
  });
  onHide(stop);
  onUnload(stop);
  onPullDownRefresh(() => load().finally(() => platform.stopPullDownRefresh()));
  return {
    singlePage,
    state,
    form,
    now,
    closed,
    officialReady,
    options,
    winner,
    showEditor,
    showProfile,
    profileDone,
    load,
    create,
    vote,
    open,
    depart,
    launch,
  };
}
