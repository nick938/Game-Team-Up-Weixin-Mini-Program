<script setup lang="ts">
import { reactive, toRefs, nextTick, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';


import { platform as hostPlatform } from "../../platform/host";
import { isSinglePage } from "../../utils/runtime";
const STORAGE_KEY = "welcomeLetterV2";
function hasReadLetter() {
    try {
        return !!hostPlatform.getStorageSync(STORAGE_KEY);
    }
    catch (error) {
        const e: Error & { code?: string } = error instanceof Error ? error : new Error(String(error));
        return false;
    }
}
function markLetterRead() {
    try {
        hostPlatform.setStorageSync(STORAGE_KEY, 1);
    }
    catch (error) {
        const e: Error & { code?: string } = error instanceof Error ? error : new Error(String(error));
        // 写不进去也先收起，避免挡住这次使用
    }
}
function setTabBarHidden(hidden: boolean) {
    if (hidden) {
        hostPlatform.hideTabBar({ animation: false, fail() { } });
    }
    else {
        hostPlatform.showTabBar({ animation: false, fail() { } });
    }
}
const state = reactive({
    show: false,
});
const { show } = toRefs(state);
function patchState(patch: Partial<typeof state>, done?: () => void) {
  Object.assign(state, patch);
  if (done) void nextTick(done);
}
function noop() { }
function syncVisibility() {
    if (isSinglePage()) {
        patchState({ show: false });
        return;
    }
    const show = !hasReadLetter();
    patchState({ show });
    setTabBarHidden(show);
}
function dismiss() {
    markLetterRead();
    patchState({ show: false });
    setTabBarHidden(false);
}
function openRules() {
    dismiss();
    hostPlatform.navigateTo({ url: "/pages/legal/legal?type=community" });
}
function openFeedback() {
    dismiss();
    hostPlatform.navigateTo({ url: "/pages/feedback/feedback" });
}
onMounted(() => {
    syncVisibility();
});
onShow(() => {
    syncVisibility();
});
</script>
<template>
<view v-if="show" class="mask" @touchmove.stop.prevent="noop()">
  <view class="letter" @tap.stop.prevent="noop()">
    <image class="stamp" src="/static/images/brand/avatar-v1.jpg" mode="aspectFill" aria-hidden="true" />
    <view class="kicker">开黑星球｜游戏搭子</view>
    <view class="title">一起玩，好好玩</view>
    <view class="body">嘿，欢迎上车。这里是给游戏好友发车组队用的。车上都是真人，请友好相处。</view>
    <view class="rules">
      <view>准时来；来不了就提前下车。</view>
      <view>说话友善，别阴阳、别骂人、别骚扰。</view>
      <view>不发外挂、代练、买卖账号，也不诱导加微信。</view>
      <view>房间号和密码只给这局里的人用。</view>
    </view>
    <view class="sign">点下面，即表示你愿意遵守社区公约。玩得开心。</view>
    <button class="agree" @tap="dismiss()">好的，开黑去</button>
    <view class="links">
      <button class="rules-link" @tap="openRules()">社区公约</button>
      <view class="links-dot">·</view>
      <button class="rules-link" @tap="openFeedback()">意见反馈</button>
    </view>
  </view>
</view>

</template>
<style scoped>
.mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 200;
  background: rgba(24, 26, 40, 0.48);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx 40rpx calc(48rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.letter {
  position: relative;
  width: 100%;
  max-width: 640rpx;
  padding: 48rpx 40rpx 32rpx;
  box-sizing: border-box;
  background: #fff;
  border-radius: 32rpx;
  box-shadow: 0 24rpx 80rpx rgba(48, 42, 96, 0.18);
}

.stamp {
  position: absolute;
  top: 36rpx;
  right: 36rpx;
  width: 88rpx;
  height: 88rpx;
  border-radius: 24rpx;
}

.kicker {
  font-size: 22rpx;
  color: #6255e7;
  letter-spacing: 1rpx;
}

.title {
  margin-top: 16rpx;
  padding-right: 108rpx;
  font-size: 40rpx;
  font-weight: 700;
  color: #202438;
  line-height: 1.35;
}

.body {
  margin-top: 24rpx;
  font-size: 27rpx;
  line-height: 1.7;
  color: #535b72;
}

.rules {
  margin-top: 20rpx;
  padding: 20rpx 24rpx;
  background: #f5f6fa;
  border-radius: 20rpx;
  font-size: 25rpx;
  line-height: 1.75;
  color: #3d4458;
}

.sign {
  margin-top: 20rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #858ba0;
}

.agree {
  width: 100% !important;
  margin-top: 32rpx;
  height: 88rpx;
  line-height: 88rpx;
  background: #6255e7;
  color: #fff;
  border-radius: 22rpx;
  font-size: 28rpx;
  font-weight: 600;
}

.links {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 8rpx;
}

.links-dot {
  padding: 0 8rpx;
  color: #c5c9d6;
  font-size: 24rpx;
  line-height: 72rpx;
}

.rules-link {
  width: auto !important;
  margin: 0;
  padding: 0 12rpx;
  height: 72rpx;
  line-height: 72rpx;
  background: transparent;
  color: #6255e7;
  font-size: 25rpx;
}

</style>
