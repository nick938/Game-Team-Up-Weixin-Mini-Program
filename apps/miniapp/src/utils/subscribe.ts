import { capabilities } from '../platform/host';
import { SUBSCRIBE_TMPL_ID } from './constants';
export function requestTeamNotify(): Promise<boolean> {
  // QQ must not request a WeChat template or claim WeChat delivery permissions.
  if (!capabilities.wechatSubscription) return Promise.resolve(false);
  return new Promise(resolve => uni.requestSubscribeMessage({
    tmplIds: [SUBSCRIBE_TMPL_ID],
    success(result) { resolve((result as unknown as Record<string, string>)[SUBSCRIBE_TMPL_ID] === 'accept'); },
    fail() { resolve(false); },
  }));
}
