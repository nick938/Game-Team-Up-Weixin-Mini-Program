import { onUnmounted, toValue, watch, ref, type MaybeRefOrGetter } from 'vue';
import { component } from '../design/tokens';
import { platform } from '../platform/host';

// Keep native tabs hidden for both visible and closing overlays.
const activeOverlays = new Set<symbol>();
export const tabBarObscured = ref(false);
export function useTabBarOverlay(
  visible: MaybeRefOrGetter<boolean>,
  options: { waitForAfterLeave?: boolean } = {},
) {
  const key = Symbol('overlay');
  let closingTimer: ReturnType<typeof setTimeout> | undefined;
  function cancelTimer() {
    clearTimeout(closingTimer);
    closingTimer = undefined;
  }
  function release() {
    if (!activeOverlays.delete(key)) return;
    if (!activeOverlays.size) {
      tabBarObscured.value = false;
      platform.showTabBar({ animation: false, fail() {} });
    }
  }
  function afterLeave() {
    if (toValue(visible)) return;
    cancelTimer();
    release();
  }
  watch(
    () => toValue(visible),
    (show) => {
      cancelTimer();
      if (show) {
        if (activeOverlays.has(key)) return;
        if (!activeOverlays.size) platform.hideTabBar({ animation: false, fail() {} });
        activeOverlays.add(key);
        tabBarObscured.value = true;
      } else if (activeOverlays.has(key) && !options.waitForAfterLeave) {
        // Wot 2.3.2 Picker/DatetimePicker don't forward Popup's after-leave event.
        closingTimer = setTimeout(
          afterLeave,
          component.overlay.pickerDuration + component.overlay.frameBuffer,
        );
      }
    },
    { immediate: true, flush: 'sync' },
  );
  onUnmounted(() => {
    cancelTimer();
    release();
  });
  return { afterLeave };
}
