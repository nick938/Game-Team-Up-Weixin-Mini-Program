<script setup lang="ts">
import { useTabBarOverlay } from '../../composables/useTabBarOverlay';
import { computed, ref, useAttrs } from 'vue';
defineOptions({ name: 'AppDatetimePicker', inheritAttrs: false });
const props = defineProps<{ label: string; modelValue: number; type?: 'date' | 'datetime' }>();
const emit = defineEmits<{ confirm: [event: { value: number }]; 'update:modelValue': [value: number] }>();
const visible = ref(false);
useTabBarOverlay(visible);
const attrs = useAttrs();
const displayValue = computed(() => {
  const date = new Date(props.modelValue);
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return props.type === 'date' ? day : `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
});
function confirm(event: { value: number | string | (number | string)[] }) {
  const value = Number(event.value);
  if (!Number.isFinite(value)) return;
  emit('update:modelValue', value);
  emit('confirm', { value });
}
</script>
<template>
  <view>
    <wd-cell :title="label" :value="displayValue" is-link @click="visible = true" />
    <wd-datetime-picker
      :z-index="1200"
      v-bind="attrs"
      v-model:visible="visible"
      :title="label"
      :model-value="modelValue"
      :type="type || 'datetime'"
      @confirm="confirm"
    />
  </view>
</template>
