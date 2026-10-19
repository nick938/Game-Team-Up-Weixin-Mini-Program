<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { useAppTheme } from '../../composables/useAppTheme';
import { UPDATES, LATEST_UPDATE, markUpdateRead } from '../../utils/updates';
import { isSinglePage } from '../../utils/runtime';
defineOptions({ name: 'UpdatesPage' });
useAppTheme();
onShow(() => {
  if (!isSinglePage()) markUpdateRead(LATEST_UPDATE.id);
});
</script>

<template>
  <timeline-preview v-if="isSinglePage()" />
  <app-shell v-else title="更新公告" subtitle="看看开黑星球最近有哪些变化。">
    <view v-for="update in UPDATES" :key="update.id" class="panel">
      <view class="hint mb-2">{{ update.date }}</view>
      <view class="section-title mb-5">{{ update.title }}</view>
      <view v-for="item in update.items" :key="item.title" class="mb-5 last:mb-0">
        <view class="text-base font-semibold mb-2">{{ item.title }}</view>
        <view class="text-sm text-secondary leading-7">{{ item.description }}</view>
      </view>
    </view>
  </app-shell>
</template>
