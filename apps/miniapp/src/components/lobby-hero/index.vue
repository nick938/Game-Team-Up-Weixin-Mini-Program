<script setup lang="ts">
defineOptions({ name: 'LobbyHero' });
const emit = defineEmits<{ publish: [] }>();
</script>
<template>
  <view class="lobby-hero motion-enter">
    <view class="relative z-1">
      <view class="flex items-center gap-2 mb-2 text-[22rpx] text-[#c5c0e6]">
        <view class="w-1 h-1 rounded-full bg-lime" />和同频的人一起玩
      </view>
      <view class="text-[54rpx] font-bold leading-[1.15] tracking-tight text-white">
        <view>下一局，</view><view>一起开黑<text class="text-lime">。</text></view>
      </view>
      <wd-button
        variant="text"
        size="small"
        custom-class="hero-launch !p-0 !mt-3 !text-white"
        @click="emit('publish')"
      >
        发起组队 <wd-icon name="arrow-right" size="12px" custom-class="!ml-2" />
      </wd-button>
    </view>
    <view class="hero-orbit" aria-hidden="true" />
    <image
      class="hero-mascot"
      src="/static/images/brand/avatar-v1.jpg"
      mode="aspectFill"
      aria-hidden="true"
    />
    <view class="absolute right-5 bottom-5 text-[20rpx] tracking-[3rpx] text-[#c5c0e6]">一起玩，好好玩</view>
  </view>
</template>
