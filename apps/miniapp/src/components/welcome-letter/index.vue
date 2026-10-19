<script setup lang="ts">
import { component } from '../../design/tokens';
import { useAppTheme } from '../../composables/useAppTheme';
useAppTheme();
defineOptions({ name: 'WelcomeLetter' });
import { reactive, toRefs, nextTick, onMounted } from 'vue';
import { useTabBarOverlay } from '../../composables/useTabBarOverlay';
import { onShow } from '@dcloudio/uni-app';

import { platform as hostPlatform } from '../../platform/host';
import { isSinglePage } from '../../utils/runtime';
import { LATEST_UPDATE, hasReadUpdate, markUpdateRead } from '../../utils/updates';
const STORAGE_KEY = 'welcomeLetterV2';
function hasReadLetter() {
  try {
    return !!hostPlatform.getStorageSync(STORAGE_KEY);
  } catch (error) {
    return false;
  }
}
function markLetterRead() {
  try {
    hostPlatform.setStorageSync(STORAGE_KEY, 1);
  } catch (error) {
    // 写不进去也先收起，避免挡住这次使用
  }
}
const state = reactive({
  show: false,
  mode: 'welcome' as 'welcome' | 'update',
});
const { show } = toRefs(state);
const { afterLeave: releaseOverlay } = useTabBarOverlay(show, { waitForAfterLeave: true });
let pendingNavigation = '';
function afterLeave() {
  releaseOverlay();
  if (pendingNavigation) {
    const url = pendingNavigation;
    pendingNavigation = '';
    hostPlatform.navigateTo({ url });
  }
}
function patchState(patch: Partial<typeof state>, done?: () => void) {
  Object.assign(state, patch);
  if (done) void nextTick(done);
}
function syncVisibility() {
  if (isSinglePage()) {
    patchState({ show: false });
    return;
  }
  const welcome = !hasReadLetter();
  patchState({ show: welcome || !hasReadUpdate(LATEST_UPDATE.id), mode: welcome ? 'welcome' : 'update' });
}
function dismiss() {
  if (state.mode === 'welcome') markLetterRead();
  markUpdateRead(LATEST_UPDATE.id);
  patchState({ show: false });
}
function closeAndNavigate(url: string) {
  if (state.show) {
    pendingNavigation = url;
    dismiss();
  } else hostPlatform.navigateTo({ url });
}
function openRules() {
  closeAndNavigate('/pages/legal/legal?type=community');
}
function openFeedback() {
  closeAndNavigate('/pages/feedback/feedback');
}
function openUpdates() {
  closeAndNavigate('/pages/updates/updates');
}
onMounted(() => {
  syncVisibility();
});
onShow(() => {
  syncVisibility();
});
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
      <view class="p-6 box-border bg-surface"
        ><view class="flex items-center justify-between gap-4 mb-5"
          ><view
            ><view class="brand-kicker">开黑星球｜游戏搭子</view
            ><view class="text-2xl font-bold mt-2">{{
              state.mode === 'welcome' ? '一起玩，好好玩' : '更新公告'
            }}</view></view
          ><image
            class="w-14 h-14 rounded-2xl surface-shadow"
            src="/static/images/brand/avatar-v1.jpg"
            mode="aspectFill"
        /></view>
        <view v-if="state.mode === 'welcome'" class="text-sm leading-7"
          >嘿，欢迎上车。这里是给游戏好友发车组队用的。车上都是真人，请友好相处。</view
        ><view v-if="state.mode === 'welcome'" class="rounded-2xl bg-brand-light p-4 my-4 text-sm leading-7"
          ><view>准时来；来不了就提前下车。</view><view>说话友善，别阴阳、别骂人、别骚扰。</view
          ><view>不发外挂、代练、买卖账号，也不诱导加微信。</view
          ><view>房间号和密码只给这局里的人用。</view></view
        ><view class="rounded-2xl bg-surface-muted p-4 my-4 text-sm leading-6">
          <view class="hint mb-3">{{ LATEST_UPDATE.date }} · 这次更新</view>
          <view v-for="item in LATEST_UPDATE.items" :key="item.title" class="mb-3 last:mb-0">
            <view class="font-semibold">{{ item.title }}</view>
            <view v-if="state.mode === 'update'" class="text-secondary mt-1">{{ item.description }}</view>
          </view> </view
        ><view v-if="state.mode === 'welcome'" class="hint mb-5"
          >点下面，即表示你愿意遵守社区公约。玩得开心。</view
        ><wd-button block @click="dismiss">{{
          state.mode === 'welcome' ? '好的，开黑去' : '知道了'
        }}</wd-button
        ><view class="flex justify-center gap-4 mt-3"
          ><wd-button size="small" variant="text" @click="openUpdates">查看更新</wd-button
          ><wd-button v-if="state.mode === 'welcome'" size="small" variant="text" @click="openRules"
            >社区公约</wd-button
          ><wd-button size="small" variant="text" @click="openFeedback">意见反馈</wd-button></view
        >
      </view>
    </scroll-view>
  </wd-popup>
</template>
