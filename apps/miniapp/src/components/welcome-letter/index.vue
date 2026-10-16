<script setup lang="ts">
defineOptions({ name: 'WelcomeLetter' });
import { reactive, toRefs, nextTick, onMounted } from 'vue';
import { useTabBarOverlay } from '../../composables/useTabBarOverlay';
import { onShow } from '@dcloudio/uni-app';

import { platform as hostPlatform } from '../../platform/host';
import { isSinglePage } from '../../utils/runtime';
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
});
const { show } = toRefs(state);
useTabBarOverlay(show);
function patchState(patch: Partial<typeof state>, done?: () => void) {
  Object.assign(state, patch);
  if (done) void nextTick(done);
}
function syncVisibility() {
  if (isSinglePage()) {
    patchState({ show: false });
    return;
  }
  const show = !hasReadLetter();
  patchState({ show });
}
function dismiss() {
  markLetterRead();
  patchState({ show: false });
}
function openRules() {
  dismiss();
  hostPlatform.navigateTo({ url: '/pages/legal/legal?type=community' });
}
function openFeedback() {
  dismiss();
  hostPlatform.navigateTo({ url: '/pages/feedback/feedback' });
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
    :z-index="1100"
    :model-value="show"
    :close-on-click-modal="false"
    custom-class="!w-11/12 !max-w-[640rpx] !rounded-3xl"
  >
    <view class="p-6 box-border"
      ><view class="flex items-center justify-between gap-4 mb-5"
        ><view
          ><view class="hint text-brand">开黑星球｜游戏搭子</view
          ><view class="text-2xl font-bold mt-2">一起玩，好好玩</view></view
        ><image class="w-14 h-14 rounded-2xl" src="/static/images/brand/avatar-v1.jpg" mode="aspectFill"
      /></view>
      <view class="text-sm leading-7"
        >嘿，欢迎上车。这里是给游戏好友发车组队用的。车上都是真人，请友好相处。</view
      ><view class="rounded-2xl bg-brand-light p-4 my-4 text-sm leading-7"
        ><view>准时来；来不了就提前下车。</view><view>说话友善，别阴阳、别骂人、别骚扰。</view
        ><view>不发外挂、代练、买卖账号，也不诱导加微信。</view
        ><view>房间号和密码只给这局里的人用。</view></view
      ><view class="hint mb-5">点下面，即表示你愿意遵守社区公约。玩得开心。</view
      ><wd-button block @click="dismiss">好的，开黑去</wd-button
      ><view class="flex justify-center gap-4 mt-3"
        ><wd-button size="small" variant="text" @click="openRules">社区公约</wd-button
        ><wd-button size="small" variant="text" @click="openFeedback">意见反馈</wd-button></view
      >
    </view>
  </wd-popup>
</template>
