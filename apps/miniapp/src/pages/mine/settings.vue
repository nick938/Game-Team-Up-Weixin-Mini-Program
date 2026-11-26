<script setup lang="ts">
import { pageThemeBackground, pageThemeStyle, pageThemeForeground } from '../../utils/app-theme';
import { useAppTheme } from '../../composables/useAppTheme';
import { usePageActive } from '../../composables/usePageActive';
import { selectAppTheme, themePreference } from '../../utils/app-theme';
defineOptions({ name: 'MineSettingsPage' });
useAppTheme();
const pageActive = usePageActive('pages/mine/settings');
const themeOptions = [
  { value: 'system', payload: '跟随系统' },
  { value: 'light', payload: '浅色' },
  { value: 'dark', payload: '深色' },
];
</script>
<template>
  <page-meta :page-style="pageThemeStyle" :background-color="pageThemeBackground">
    <navigation-bar :front-color="pageThemeForeground" :background-color="pageThemeBackground" />
  </page-meta>
  <app-shell :active="pageActive" variant="form">
    <view class="section-label !mt-0">外观</view>
    <view class="panel">
      <wd-segmented
        :value="themePreference"
        :options="themeOptions"
        custom-class="!flex !w-full"
        @change="selectAppTheme($event.value)"
      >
        <template #label="{ option }">{{ option.payload }}</template>
      </wd-segmented>
    </view>
  </app-shell>
</template>
