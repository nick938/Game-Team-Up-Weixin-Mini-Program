import { platform } from '../platform/host';
import { useAppStore } from '../stores/app';
import { CHANGELOG } from './changelog';

// 更新公告直接取最新版本记录，不再单独维护公告数据。
export const LATEST_RELEASE = CHANGELOG[0];
const readInSession = new WeakMap<object, Set<string>>();
function noticeKey(version: string) {
  return 'update-notice:' + version;
}
export function hasReadUpdate(version: string = LATEST_RELEASE.version): boolean {
  const key = noticeKey(version);
  if (readInSession.get(useAppStore())?.has(key)) return true;
  try {
    return !!platform.getStorageSync(key);
  } catch {
    return false;
  }
}
export function markUpdateRead(version: string = LATEST_RELEASE.version) {
  const key = noticeKey(version);
  const store = useAppStore();
  const ids = readInSession.get(store) || new Set<string>();
  ids.add(key);
  readInSession.set(store, ids);
  try {
    platform.setStorageSync(key, 1);
  } catch {
    // An unavailable cache must not show the same announcement again this session.
  }
}
