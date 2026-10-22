import { usePageFeedback } from './usePageFeedback';
import { reactive, toRefs, nextTick } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { platform as hostPlatform } from '../platform/host';
import { REPORT_REASONS } from '../utils/constants';
import { getAppVersion } from '../utils/version';
import { callTeam } from '../api/team';
export function useReport() {
  const { toast, showError } = usePageFeedback();
  const state = reactive({
    singlePage: false,
    ...{
      reasons: REPORT_REASONS,
      reason: '',
      content: '',
      teamId: '',
      targetName: '',
      submitting: false,
    },
  });
  const { singlePage, reasons, reason, content, teamId, targetName, submitting } = toRefs(state);
  function patchState(patch: Partial<typeof state>, done?: () => void) {
    Object.assign(state, patch);
    if (done) void nextTick(done);
  }
  function pickReason(input: string) {
    patchState({ reason: input });
  }
  function onContent(input: string) {
    patchState({ content: input });
  }
  async function onSubmit() {
    if (state.submitting) return;
    if (!state.reason) {
      toast.show('请选择举报理由');
      return;
    }
    if (!state.teamId) {
      toast.show('举报对象已失效');
      return;
    }
    patchState({ submitting: true });
    try {
      const ver = getAppVersion();
      await callTeam('submitReport', {
        targetType: 'team',
        targetId: state.teamId,
        reason: state.reason,
        content: (state.content || '').trim(),
        version: ver.version,
        envVersion: ver.envLabel,
      });
      toast.success('已收到举报');
      setTimeout(() => hostPlatform.navigateBack(), 700);
    } catch (error) {
      const e: Error & { code?: string } = error instanceof Error ? error : new Error(String(error));
      showError(e);
    } finally {
      patchState({ submitting: false });
    }
  }
  onLoad((options = {}) => {
    const targetName = options.name ? decodeURIComponent(options.name) : '';
    patchState({
      teamId: options.teamId || '',
      targetName,
    });
    hostPlatform.setNavigationBarTitle({ title: targetName ? `举报：${targetName}` : '举报' });
  });
  return {
    state,
    singlePage,
    reasons,
    reason,
    content,
    teamId,
    targetName,
    submitting,
    patchState,
    pickReason,
    onContent,
    onSubmit,
  };
}
