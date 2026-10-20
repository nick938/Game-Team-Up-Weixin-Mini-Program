<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { useAppTheme } from '../../composables/useAppTheme';
import { CHANGELOG } from '../../utils/changelog';
import { LATEST_RELEASE, markUpdateRead } from '../../utils/update-notice';
import { isSinglePage } from '../../utils/runtime';
defineOptions({ name: 'ChangelogPage' });
useAppTheme();
onShow(() => {
  if (!isSinglePage()) markUpdateRead(LATEST_RELEASE.version);
});
</script>

<template>
  <timeline-preview v-if="isSinglePage()" />
  <app-shell v-else title="更新日志" subtitle="按版本记录每一次改进。">
    <view v-for="release in CHANGELOG" :key="release.version" class="panel">
      <view class="flex items-center justify-between gap-3 mb-3">
        <view class="section-title">v{{ release.version }}</view>
        <view class="hint">{{ release.date }}</view>
      </view>
      <view class="text-base font-semibold mb-5">{{ release.title }}</view>
      <view v-for="section in release.sections" :key="section.title" class="mb-5 last:mb-0">
        <view class="text-sm font-semibold text-brand mb-3">{{ section.title }}</view>
        <view v-for="item in section.items" :key="item" class="flex items-start gap-2 mb-2 last:mb-0">
          <text class="text-brand shrink-0 leading-7">·</text>
          <text class="text-sm text-secondary leading-7 break-words min-w-0">{{ item }}</text>
        </view>
      </view>
    </view>
  </app-shell>
</template>
