<script setup lang="ts">
import { ref } from 'vue';
import { onShow, onResize, onPageScroll } from '@dcloudio/uni-app';
import { homeNavigationMetrics, type CapsuleRect } from '../../utils/home-navigation';
import { platform } from '../../platform/host';
defineOptions({ name: 'PageNavigation' });
defineProps<{ title: string }>();
const navigation = ref(homeNavigationMetrics());
const scrolled = ref(false);
function updateNavigation() {
  const info = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync();
  let capsule: CapsuleRect | undefined;
  // #ifdef MP-WEIXIN || MP-QQ
  if (uni.getMenuButtonBoundingClientRect) capsule = uni.getMenuButtonBoundingClientRect();
  // #endif
  navigation.value = homeNavigationMetrics(info.statusBarHeight, info.windowWidth, capsule);
}
function back() {
  platform.navigateBack({ delta: 1, fail: () => platform.switchTab({ url: '/pages/index/index' }) });
}
onShow(updateNavigation);
onResize(updateNavigation);
onPageScroll(({ scrollTop }) => {
  scrolled.value = scrollTop > 24;
});
</script>
<template>
  <view
    class="page-navigation"
    :class="{ 'is-scrolled': scrolled }"
    :style="{ paddingTop: navigation.status + 'px' }"
  >
    <view class="navigation-inner" :style="{ height: navigation.height + 'px' }">
      <view class="navigation-back" role="button" aria-label="返回" @click="back"
        ><text class="back-chevron"
      /></view>
      <view
        class="navigation-title"
        :style="{
          paddingLeft: Math.max(56, navigation.right) + 'px',
          paddingRight: Math.max(56, navigation.right) + 'px',
        }"
        >{{ title }}</view
      >
    </view>
  </view>
  <view :style="{ height: navigation.total + 'px' }" />
</template>
<style scoped>
.page-navigation {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 90;
  color: #22232a;
  background: rgba(244, 245, 248, 0.94);
}
.is-scrolled {
  background: rgba(247, 246, 253, 0.98);
  box-shadow: 0 1px 0 rgba(98, 85, 231, 0.06);
}
.navigation-inner {
  position: relative;
  max-width: 560px;
  margin: 0 auto;
}
.navigation-title {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  box-sizing: border-box;
  font-size: 17px;
  font-weight: 600;
  white-space: nowrap;
}
.navigation-back {
  position: absolute;
  top: 0;
  left: 8px;
  width: 44px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}
.back-chevron {
  width: 10px;
  height: 10px;
  border-left: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(45deg);
}
</style>
