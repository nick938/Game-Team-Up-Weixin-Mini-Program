import { ref } from 'vue';
import { onShow, onHide, onUnload } from '@dcloudio/uni-app';
/** Portals must follow the owning page, including cached tabs and HMR remounts. */
export function usePageActive(route: string) {
  function currentMatches() {
    if (typeof getCurrentPages !== 'function') return true;
    const pages = getCurrentPages();
    const current = pages[pages.length - 1];
    return !current?.route || current.route.replace(/^\//, '') === route;
  }
  const active = ref(currentMatches());
  onShow(() => {
    active.value = true;
  });
  onHide(() => {
    active.value = false;
  });
  onUnload(() => {
    active.value = false;
  });
  return active;
}
