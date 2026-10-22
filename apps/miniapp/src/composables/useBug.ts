import { usePageFeedback } from './usePageFeedback';
import { reactive, toRefs, nextTick } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { platform as hostPlatform } from '../platform/host';
import { FEEDBACK_PAGES, BUG_TEMPLATE } from '../utils/constants';
import { getAppVersion } from '../utils/version';
import { callTeam } from '../api/team';
export function useBug() {
  const { toast, showError } = usePageFeedback();
  function systemSummary() {
    try {
      const info = hostPlatform.getSystemInfoSync() || {};
      return [info.platform, info.model, info.system, info.SDKVersion ? `SDK ${info.SDKVersion}` : '']
        .filter(Boolean)
        .join(' · ')
        .slice(0, 200);
    } catch (error) {
      return '';
    }
  }
  const state = reactive({
    singlePage: false,
    ...{
      pages: FEEDBACK_PAGES,
      pageName: '大厅',
      content: BUG_TEMPLATE,
      errorMsg: '',
      submitting: false,
    },
  });
  const { singlePage, pages, pageName, content, errorMsg, submitting } = toRefs(state);
  function patchState(patch: Partial<typeof state>, done?: () => void) {
    Object.assign(state, patch);
    if (done) void nextTick(done);
  }
  function pickPage(input: string) {
    patchState({ pageName: input });
  }
  function onContent(input: string) {
    patchState({ content: input });
  }
  function onErrorMsg(input: string) {
    patchState({ errorMsg: input });
  }
  async function onSubmit() {
    if (state.submitting) return;
    const content = (state.content || '').trim();
    const filled = content
      .replace(/【我做了什么】/g, '')
      .replace(/【出现了什么】/g, '')
      .replace(/\s/g, '');
    if (filled.length < 4) {
      toast.show('请简单说说发生了什么');
      return;
    }
    patchState({ submitting: true });
    try {
      const ver = getAppVersion();
      await callTeam('submitBug', {
        page: state.pageName,
        content,
        errorMsg: (state.errorMsg || '').trim(),
        systemInfo: systemSummary(),
        version: ver.version,
        envVersion: ver.envLabel,
      });
      toast.success('已收到，谢谢你');
      patchState({ content: BUG_TEMPLATE, errorMsg: '' });
      setTimeout(() => hostPlatform.navigateBack(), 700);
    } catch (error) {
      const e: Error & { code?: string } = error instanceof Error ? error : new Error(String(error));
      showError(e);
    } finally {
      patchState({ submitting: false });
    }
  }
  onLoad((options = {}) => {
    const pageName = options.page && FEEDBACK_PAGES.includes(options.page) ? options.page : '大厅';
    const errorMsg = options.errorMsg ? decodeURIComponent(options.errorMsg) : '';
    patchState({ pageName, errorMsg: errorMsg.slice(0, 500) });
  });
  return {
    systemSummary,
    state,
    singlePage,
    pages,
    pageName,
    content,
    errorMsg,
    submitting,
    patchState,
    pickPage,
    onContent,
    onErrorMsg,
    onSubmit,
  };
}
