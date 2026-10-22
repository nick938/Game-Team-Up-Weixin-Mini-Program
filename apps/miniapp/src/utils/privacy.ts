import { reactive } from 'vue';

type PrivacyDecision = { event: 'agree'; buttonId: string } | { event: 'disagree' };
type PrivacyResolve = (decision: PrivacyDecision) => void;
export interface PrivacyHost {
  onNeedPrivacyAuthorization?: (callback: (resolve: PrivacyResolve) => void) => void;
  getPrivacySetting?: (options: {
    success: (result: { needAuthorization: boolean; privacyContractName: string }) => void;
    fail: (error?: { errMsg?: string }) => void;
  }) => void;
  openPrivacyContract?: (options: { fail: () => void }) => void;
}

export function createPrivacyConsent() {
  const state = reactive({
    visible: false,
    checking: false,
    closing: false,
    contractName: '《开黑星球小程序隐私保护指引》',
  });
  const pending = new Set<PrivacyResolve>();
  let host: PrivacyHost | undefined;
  let initialized = false;
  let checked = false;
  let revision = 0;

  function initialize(api?: PrivacyHost) {
    if (initialized || !api?.onNeedPrivacyAuthorization || !api.getPrivacySetting) return;
    initialized = true;
    state.checking = true;
    host = api;
    api.onNeedPrivacyAuthorization((resolve) => {
      revision++;
      state.closing = false;
      pending.add(resolve);
      state.visible = true;
    });
  }
  function check() {
    if (!host || checked) return;
    checked = true;
    const requestRevision = revision;
    host.getPrivacySetting?.({
      success(result) {
        state.checking = false;
        if (result.privacyContractName) state.contractName = result.privacyContractName;
        // A delayed query must not reopen an answered sheet or hide a newer request.
        if (requestRevision === revision) state.visible = result.needAuthorization;
      },
      fail(error) {
        state.checking = false;
        checked = false;
        console.warn('[privacy] 隐私授权状态查询失败', error?.errMsg || '未返回错误信息');
      },
    });
  }
  function settle(decision: PrivacyDecision) {
    revision++;
    state.closing = state.visible;
    state.visible = false;
    const resolvers = [...pending];
    pending.clear();
    resolvers.forEach((resolve) => resolve(decision));
  }
  return {
    state,
    initialize,
    check,
    // Call only from the native agreeprivacyauthorization event, never from click.
    agree: () => settle({ event: 'agree', buttonId: 'privacy-agree' }),
    reject: () => settle({ event: 'disagree' }),
    afterLeave() {
      state.closing = false;
    },
    openContract(fail: () => void) {
      if (host?.openPrivacyContract) host.openPrivacyContract({ fail });
      else fail();
    },
  };
}

export const privacyConsent = createPrivacyConsent();
declare const wx: PrivacyHost;
export function initializePrivacyConsent() {
  // #ifdef MP-WEIXIN
  if (typeof wx !== 'undefined') {
    if (!wx.onNeedPrivacyAuthorization || !wx.getPrivacySetting) {
      console.warn('[privacy] 当前基础库不支持隐私授权接口，请使用 2.32.3 或更新版本');
      return;
    }
    privacyConsent.initialize(wx);
  }
  // #endif
}
