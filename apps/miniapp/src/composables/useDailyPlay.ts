import { reactive, ref } from 'vue';
import { onShow, onHide, onUnload, onPullDownRefresh } from '@dcloudio/uni-app';
import { callTeam } from '../api/team';
import { platform } from '../platform/host';
import { usePageFeedback } from './usePageFeedback';
import { isSinglePage } from '../utils/runtime';
import type { DailyBoard, DailyOption } from '../types/domain';

export function useDailyPlay() {
  const singlePage = ref(isSinglePage());
  const { toast, showError } = usePageFeedback();
  const state = reactive({ board: null as DailyBoard | null, loading: false, busy: false, error: '' });
  const initial = Math.floor(Date.now() / 60000) * 60000;
  const form = reactive({ gameName: '', platform: 'Steam', startAt: initial, endAt: initial + 7200000 });
  let active = true;
  let revision = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  const showProfile = ref(false);
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
      state.board = result.board;
      state.error = '';
    } catch (error) {
      if (active && id === revision) state.error = error instanceof Error ? error.message : '加载失败';
    } finally {
      if (id === revision) state.loading = false;
    }
  }
  function applyMutation(board: DailyBoard | null) {
    if (board) state.board = board;
    state.error = board ? '' : '操作已成功，列表更新失败，请刷新查看';
  }
  async function create() {
    if (state.busy) return;
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
      toast.success('已创建，继续添加其他想玩的游戏吧');
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
  async function vote(option: DailyOption) {
    if (state.busy) return;
    if (option.teamId && option.joined) {
      open(option.teamId);
      return;
    }
    state.busy = true;
    revision++;
    try {
      const { board } = await callTeam('votePlayOption', {
        optionId: option.id,
        want: option.teamId ? true : !option.mine,
      });
      applyMutation(board);
      toast.success(option.teamId ? '已加入想玩，也上车啦' : option.mine ? '已取消想玩' : '已加入想玩');
    } catch (error) {
      handleError(error, () => vote(option));
    } finally {
      state.busy = false;
      state.loading = false;
    }
  }
  async function launch(option: DailyOption) {
    if (state.busy) return;
    if (option.teamId) {
      open(option.teamId);
      return;
    }
    state.busy = true;
    revision++;
    try {
      const { board, teamId } = await callTeam('launchPlayOption', { optionId: option.id });
      applyMutation(board);
      toast.success('发车成功，想玩的搭子已自动上车');
      open(teamId);
    } catch (error) {
      handleError(error, () => launch(option));
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
    timer = setInterval(() => {
      void load();
    }, 30000);
  });
  onHide(stop);
  onUnload(stop);
  onPullDownRefresh(() => load().finally(() => platform.stopPullDownRefresh()));
  return { singlePage, state, form, showProfile, profileDone, load, create, vote, launch, open };
}
