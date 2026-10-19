import { platform } from '../platform/host';
import { useAppStore } from '../stores/app';

const KEY = 'welcomeLetterV2';
const readInSession = new WeakSet<object>();
export function hasReadWelcome(): boolean {
  if (readInSession.has(useAppStore())) return true;
  try {
    return !!platform.getStorageSync(KEY);
  } catch {
    return false;
  }
}
export function markWelcomeRead() {
  readInSession.add(useAppStore());
  try {
    platform.setStorageSync(KEY, 1);
  } catch {
    // Keep the first-visit welcome acknowledged during this session.
  }
}
