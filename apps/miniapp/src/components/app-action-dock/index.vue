<script setup lang="ts">
defineOptions({ name: 'AppActionDock' });
import { tabBarObscured } from '../../composables/useTabBarOverlay';
import { useKeyboardVisible } from '../../composables/useKeyboardVisible';
import { useAppTheme } from '../../composables/useAppTheme';
useAppTheme();
defineProps<{ tabbed?: boolean; active?: boolean }>();
const keyboardVisible = useKeyboardVisible();
</script>
<template>
  <wd-root-portal
    ><view
      v-if="active !== false && !tabBarObscured && !keyboardVisible"
      class="app-dock glass-surface"
      :class="{ 'app-dock--tabbed': tabbed }"
      ><slot /></view
  ></wd-root-portal>
</template>
