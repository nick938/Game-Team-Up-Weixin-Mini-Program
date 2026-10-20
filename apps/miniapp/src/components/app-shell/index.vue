<script setup lang="ts">
import { useAppTheme } from '../../composables/useAppTheme';
import { wotThemeVars } from '../../design/wot-theme';
import { appThemeStyle, component } from '../../design/tokens';
import PrivacySheet from '../privacy-sheet/index.vue';
defineOptions({ name: 'AppShell' });
withDefaults(
  defineProps<{
    active?: boolean;
    title?: string;
    subtitle?: string;
    variant?: 'lobby' | 'form' | 'detail' | 'profile';
  }>(),
  { active: true },
);
useAppTheme();
</script>
<template>
  <wd-config-provider theme="light" :theme-vars="wotThemeVars" :button="{ round: false }">
    <view class="app-page" :class="variant ? 'page-' + variant : ''" :style="appThemeStyle">
      <view v-if="title" class="mb-6">
        <view class="page-heading">{{ title }}</view>
        <view v-if="subtitle" class="page-caption">{{ subtitle }}</view>
      </view>
      <slot />
      <wd-toast :z-index="component.layer.toast" />
      <wd-dialog :z-index="component.layer.dialog" />
      <privacy-sheet :active="active" />
    </view>
  </wd-config-provider>
</template>
