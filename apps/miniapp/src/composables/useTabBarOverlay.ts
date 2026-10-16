import { onUnmounted, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { platform } from '../platform/host';

// Native tab bars can cover in-page popups regardless of their CSS z-index.
const activeOverlays = new Set<symbol>();
export function useTabBarOverlay(visible: MaybeRefOrGetter<boolean>) {
  const key = Symbol('overlay');
  function release() {
    if (!activeOverlays.delete(key)) return;
    if (!activeOverlays.size) platform.showTabBar({ animation: false, fail() {} });
  }
  watch(
    () => toValue(visible),
    (show) => {
      if (!show) return release();
      if (activeOverlays.has(key)) return;
      if (!activeOverlays.size) platform.hideTabBar({ animation: false, fail() {} });
      activeOverlays.add(key);
    },
    { immediate: true, flush: 'sync' },
  );
  onUnmounted(release);
}
