<script setup lang="ts">
defineOptions({ name: 'AppActionDock' });
defineProps<{ active?: boolean }>();
</script>
<template>
  <view v-if="active !== false" class="app-dock glass-surface"><slot /></view>
</template>
