import { getCurrentInstance, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { onReady, onShow } from '@dcloudio/uni-app';
import { tabBarItems } from '../design/tab-bar';
import { buildTarget } from '../platform/host';
import { appTheme } from '../utils/app-theme';
import { tabBarObscured } from './useTabBarOverlay';

type NativeTabPage = {
  getTabBar?: () => {
    setData: (data: {
      items: typeof tabBarItems;
      selectedRoute: string;
      hidden: boolean;
      dark: boolean;
    }) => void;
  } | null;
};

export function useWechatTabBar(route: string, preview: MaybeRefOrGetter<boolean>) {
  if (buildTarget !== 'mp-weixin') return;
  const instance = getCurrentInstance();
  function sync() {
    // Uni's page proxy exposes its own native page even while the route stack is switching tabs.
    const owner = (instance?.proxy as { $scope?: NativeTabPage } | null | undefined)?.$scope;
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    const current = pages[pages.length - 1];
    const nativePage = owner || (current?.route === route ? (current as NativeTabPage) : undefined);
    nativePage?.getTabBar?.()?.setData({
      items: tabBarItems,
      dark: appTheme.value === 'dark',
      selectedRoute: route,
      hidden: tabBarObscured.value || toValue(preview),
    });
  }
  onShow(sync);
  onReady(sync);
  watch([appTheme, tabBarObscured, () => toValue(preview)], sync, { flush: 'sync' });
}
