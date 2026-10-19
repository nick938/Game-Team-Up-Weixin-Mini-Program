<script setup lang="ts">
import { ref, watch } from 'vue';
defineOptions({ name: 'AppAvatar' });
const props = withDefaults(
  defineProps<{
    src?: string;
    fileId?: string;
    identity?: string;
    base64?: string;
    alt?: string;
    size?: 'compact' | 'small' | 'member' | 'profile';
  }>(),
  { size: 'member', alt: '玩家头像' },
);
// Two native image nodes keep the current bitmap visible while a replacement loads.
const layers = ref<{ token: number; src: string; fileId: string }[]>([]);
const activeToken = ref(0);
let nextToken = 0;
let owner = '';
let loadedFileId = '';
function update() {
  const target = props.src || (props.base64 ? 'data:image/jpeg;base64,' + props.base64 : '');
  const nextOwner = props.identity || props.fileId || target;
  if (nextOwner !== owner) {
    layers.value = [];
    activeToken.value = 0;
    loadedFileId = '';
    owner = nextOwner;
  }
  if (!target) {
    layers.value = [];
    activeToken.value = 0;
    loadedFileId = '';
    return;
  }
  if (activeToken.value && props.fileId && props.fileId === loadedFileId) return;
  if (layers.value.some((layer) => layer.src === target)) return;
  const current = layers.value.find((layer) => layer.token === activeToken.value);
  layers.value = [
    ...(current ? [current] : []),
    { token: ++nextToken, src: target, fileId: props.fileId || '' },
  ];
}
function loaded(token: number) {
  const latest = layers.value[layers.value.length - 1];
  if (!latest || latest.token !== token) return;
  activeToken.value = token;
  loadedFileId = latest.fileId;
}
function failed(token: number) {
  layers.value = layers.value.filter((layer) => layer.token !== token);
  if (activeToken.value === token) {
    activeToken.value = 0;
    loadedFileId = '';
  }
}
watch(() => [props.src, props.fileId, props.identity, props.base64], update, { immediate: true });
</script>
<template>
  <view
    class="relative overflow-hidden rounded-xl shrink-0 bg-surface-muted"
    :class="
      size === 'compact'
        ? 'w-6 h-6'
        : size === 'profile'
          ? 'w-14 h-14'
          : size === 'small'
            ? 'w-10 h-10'
            : 'w-12 h-12'
    "
    role="img"
    :aria-label="alt"
  >
    <image
      class="absolute inset-0 w-full h-full"
      src="/static/images/avatar.png"
      mode="aspectFill"
      aria-hidden="true"
    />
    <image
      v-for="layer in layers"
      :key="layer.token"
      class="absolute inset-0 w-full h-full pointer-events-none"
      :class="activeToken === layer.token ? 'opacity-100' : 'opacity-0'"
      :src="layer.src"
      mode="aspectFill"
      aria-hidden="true"
      @load="loaded(layer.token)"
      @error="failed(layer.token)"
    />
  </view>
</template>
