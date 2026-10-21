<script setup lang="ts">
import { ref, watch } from 'vue';
defineOptions({ name: 'MineAvatar' });
const props = withDefaults(defineProps<{ src?: string; size?: number; identity?: string }>(), {
  src: '',
  size: 24,
  identity: '',
});
const failed = ref(false);
watch(
  () => [props.src, props.identity],
  () => {
    failed.value = false;
  },
);
</script>
<template>
  <!-- Native image avoids wd-img's loading overlay on each mount. Keep the frame as Wot Avatar. -->
  <wd-avatar :size="size" shape="square">
    <image
      :key="identity + src"
      class="mine-avatar-image"
      :src="!failed && src ? src : '/static/images/avatar.png'"
      mode="aspectFill"
      @error="failed = true"
    />
  </wd-avatar>
</template>
<style scoped>
.mine-avatar-image {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
