<script setup lang="ts">
defineOptions({ name: 'LobbyHero' });
</script>
<template>
  <view class="lobby-hero">
    <view class="text-sm text-secondary">找一些朋友，玩一些游戏。</view>
    <wd-img
      custom-class="hero-mascot"
      src="/static/images/brand/avatar-v1.jpg"
      mode="aspectFill"
      :radius="20"
      :show-loading="false"
      :show-error="false"
      aria-hidden="true"
    />
  </view>
</template>
<style scoped>
.lobby-hero {
  min-height: 48px;
  padding: 0 0 16px;
}
.lobby-hero :deep(.hero-mascot) {
  width: 36px;
  height: 36px;
  border-radius: 12px;
}
</style>
