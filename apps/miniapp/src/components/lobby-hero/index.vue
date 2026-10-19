<script setup lang="ts">
defineOptions({ name: 'LobbyHero' });
</script>
<template>
  <view class="lobby-hero">
    <view class="min-w-0"
      ><view class="text-xs text-muted mb-2">一起玩，好好玩</view
      ><view class="content-heading">下一局，和谁一起？</view></view
    >
    <image
      class="hero-mascot"
      src="/static/images/brand/avatar-v1.jpg"
      mode="aspectFill"
      aria-hidden="true"
    />
  </view>
</template>
