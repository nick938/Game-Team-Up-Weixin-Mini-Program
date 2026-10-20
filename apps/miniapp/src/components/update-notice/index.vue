<script setup lang="ts">
import { reactive, toRefs, watch, onMounted } from 'vue';
import { onShow, onHide } from '@dcloudio/uni-app';
import { component } from '../../design/tokens';
import { useAppTheme } from '../../composables/useAppTheme';
import { useTabBarOverlay } from '../../composables/useTabBarOverlay';
import { platform } from '../../platform/host';
import { isSinglePage } from '../../utils/runtime';
import { LATEST_RELEASE, hasReadUpdate, markUpdateRead } from '../../utils/update-notice';
defineOptions({ name: 'UpdateNotice' });
const props = defineProps<{ enabled: boolean }>();
useAppTheme();
const state = reactive({ show: false });
const { show } = toRefs(state);
const { afterLeave: releaseOverlay } = useTabBarOverlay(show, { waitForAfterLeave: true });
let pendingNavigation = '';
function syncVisibility() {
  state.show = props.enabled && !isSinglePage() && !hasReadUpdate(LATEST_RELEASE.version);
}
function dismiss() {
  markUpdateRead(LATEST_RELEASE.version);
  state.show = false;
}
function afterLeave() {
  releaseOverlay();
  if (pendingNavigation) {
    const url = pendingNavigation;
    pendingNavigation = '';
    platform.navigateTo({ url });
  }
}
function openChangelog() {
  pendingNavigation = '/pages/changelog/changelog';
  dismiss();
}
onMounted(syncVisibility);
onShow(syncVisibility);
onHide(() => {
  state.show = false;
});
watch(() => props.enabled, syncVisibility);
</script>

<template>
  <wd-popup
    :duration="component.sheet.duration"
    @after-leave="afterLeave"
    root-portal
    :z-index="1100"
    :model-value="show"
    :close-on-click-modal="false"
    custom-class="!w-11/12 !max-w-[360px] !rounded-3xl"
  >
    <scroll-view scroll-y style="max-height: 80vh">
      <view class="p-6 box-border bg-surface">
        <view class="brand-kicker mb-2">开黑星球｜游戏搭子</view>
        <view class="text-2xl font-bold mb-2">更新公告</view>
        <view class="hint mb-4">{{ LATEST_RELEASE.date }}</view>
        <view class="section-title mb-4">{{ LATEST_RELEASE.title }}</view>
        <view class="rounded-2xl bg-surface-muted p-4 mb-5 text-sm leading-6">
          <view v-for="item in LATEST_RELEASE.highlights" :key="item.title" class="mb-4 last:mb-0">
            <view class="font-semibold mb-1">{{ item.title }}</view>
            <view class="text-secondary">{{ item.description }}</view>
          </view>
        </view>
        <wd-button block @click="dismiss">知道了</wd-button>
        <view class="text-center mt-3"
          ><wd-button variant="text" size="small" @click="openChangelog">查看完整更新日志</wd-button></view
        >
      </view>
    </scroll-view>
  </wd-popup>
</template>
