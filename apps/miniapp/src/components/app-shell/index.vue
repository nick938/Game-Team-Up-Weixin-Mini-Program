<script setup lang="ts">
defineOptions({ name: 'AppShell' });
defineProps<{ title?: string; subtitle?: string; variant?: 'lobby' }>();
</script>
<template>
  <wd-config-provider :button="{ round: true }">
    <view class="app-page" :class="variant === 'lobby' ? 'lobby-page' : ''">
      <view v-if="title" class="mb-6 motion-enter"
        ><view class="brand-kicker flex items-center gap-2 mb-3"
          ><view class="w-1.5 h-1.5 rounded-full bg-brand" />开黑星球</view
        ><view class="page-heading">{{ title }}</view
        ><view v-if="subtitle" class="page-caption">{{ subtitle }}</view></view
      >
      <slot /><wd-toast :z-index="1500" /><wd-dialog :z-index="1400" />
    </view>
  </wd-config-provider>
</template>
