<script setup lang="ts">
defineOptions({ name: 'AppShell' });
defineProps<{ title?: string; subtitle?: string }>();
</script>
<template>
  <wd-config-provider :button="{ round: true }">
    <view class="app-page">
      <view v-if="title" class="mb-6"
        ><view class="page-heading">{{ title }}</view
        ><view v-if="subtitle" class="page-caption">{{ subtitle }}</view></view
      >
      <slot /><wd-toast :z-index="1500" /><wd-dialog :z-index="1400" />
    </view>
  </wd-config-provider>
</template>
