import { usePageFeedback } from './usePageFeedback';
import { reactive, toRefs, nextTick } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { platform as hostPlatform } from '../platform/host';
import { FEEDBACK_KINDS, FEEDBACK_PAGES, FEEDBACK_TEMPLATE } from '../utils/constants';
import { getAppVersion } from '../utils/version';
import { callTeam } from '../api/team';
export function useFeedback() {
  const { toast, dialog, showError } = usePageFeedback();
  const state = reactive({
    version: null as ReturnType<typeof getAppVersion> | null,
    singlePage: false,
    ...{
      kinds: FEEDBACK_KINDS,
      pages: FEEDBACK_PAGES,
      kind: '遇到问题',
      pageName: '大厅',
      content: FEEDBACK_TEMPLATE,
      submitting: false,
      versionText: '',
    },
  });
  const { singlePage, kinds, pages, kind, pageName, content, submitting, versionText } = toRefs(state);
  function patchState(patch: Partial<typeof state>, done?: () => void) {
    Object.assign(state, patch);
    if (done) void nextTick(done);
  }
  function pickKind(input: string) {
    patchState({ kind: input });
  }
  function pickPage(input: string) {
    patchState({ pageName: input });
  }
  function onContent(input: string) {
    patchState({ content: input });
  }
  async function onSubmit() {
    if (state.submitting) return;
    const content = (state.content || '').trim();
    const filled = content
      .replace(/【我遇到的情况】/g, '')
      .replace(/【我希望怎样】/g, '')
      .replace(/\s/g, '');
    if (filled.length < 4) {
      toast.show('请把情况写具体一点');
      return;
    }
    patchState({ submitting: true });
    try {
      const ver = state.version || getAppVersion();
      const res = await callTeam('submitFeedback', {
        kind: state.kind,
        page: state.pageName,
        content,
        version: ver.version,
        envVersion: ver.envLabel,
      });
      if (res.mailed) {
        toast.success('已发到邮箱');
        patchState({ content: FEEDBACK_TEMPLATE });
        setTimeout(() => hostPlatform.navigateBack(), 600);
        return;
      }
      void dialog
        .alert({
          title: '反馈已记下，邮件没发出去',
          msg:
            res.mailError ||
            '请重新上传云函数 team，并勾选云端安装依赖。也可在云开发控制台查看 feedback 集合。',
        })
        .catch(() => {});
    } catch (error) {
      const e: Error & { code?: string } = error instanceof Error ? error : new Error(String(error));
      showError(e);
    } finally {
      patchState({ submitting: false });
    }
  }
  onLoad(() => {
    const ver = getAppVersion();
    state.version = ver;
    patchState({ versionText: ver.text });
  });
  return {
    state,
    singlePage,
    kinds,
    pages,
    kind,
    pageName,
    content,
    submitting,
    versionText,
    patchState,
    pickKind,
    pickPage,
    onContent,
    onSubmit,
  };
}
