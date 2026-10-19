<script setup lang="ts">
defineOptions({ name: 'LobbyHero' });
const emit = defineEmits<{ publish: [] }>();
</script>
<template>
  <view class="lobby-hero">
    <view class="relative z-1 pr-[90px]">
      <view class="text-xs text-white mb-1">开黑星球 · 游戏搭子</view>
      <view class="hero-heading">下一局，一起玩<text class="text-lime">。</text></view>
      <wd-button variant="text" size="small" custom-class="!p-0 !text-white" @click="emit('publish')">
        发起组队 <wd-icon name="arrow-right" size="14px" custom-class="!ml-2" />
      </wd-button>
    </view>
    <view class="hero-orbit" aria-hidden="true" />
    <image
      class="hero-mascot"
      src="/static/images/brand/avatar-v1.jpg"
      mode="aspectFill"
      aria-hidden="true"
    />
  </view>
</template>
