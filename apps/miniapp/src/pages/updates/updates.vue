<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { useAppTheme } from '../../composables/useAppTheme';
import { UPDATES, LATEST_UPDATE, markUpdateRead } from '../../utils/updates';
import { isSinglePage } from '../../utils/runtime';
import { platform } from '../../platform/host';
defineOptions({ name: 'UpdatesPage' });
useAppTheme();
function openChangelog() {
  platform.navigateTo({ url: '/pages/changelog/changelog' });
}
onShow(() => {
  if (!isSinglePage()) markUpdateRead(LATEST_UPDATE.id);
});
</script>

<template>
  <timeline-preview v-if="isSinglePage()" />
  <app-shell v-else title="更新公告" subtitle="看看开黑星球最近有哪些变化。">
    <wd-cell-group custom-class="!mb-4">
      <wd-cell title="查看完整更新日志" label="查看各版本的详细变化" is-link @click="openChangelog" />
    </wd-cell-group>
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
