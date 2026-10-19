<script setup lang="ts">
import { useAppTheme } from '../../composables/useAppTheme';
useAppTheme();
import { useTabBarOverlay } from '../../composables/useTabBarOverlay';
import { computed, ref } from 'vue';
defineOptions({ name: 'AppPicker', inheritAttrs: false });
type Option = string | number | { label: string; value: string | number };
const props = defineProps<{
  label: string;
  modelValue?: string | number;
  columns: Option[];
  placeholder?: string;
}>();
const emit = defineEmits<{
  confirm: [event: { value: string | number }];
  'update:modelValue': [value: string | number];
}>();
const visible = ref(false);
useTabBarOverlay(visible);
const options = computed(() =>
  props.columns.map((item) => (typeof item === 'object' ? item : { label: String(item), value: item })),
);
const displayValue = computed(
  () => options.value.find((item) => item.value === props.modelValue)?.label || props.placeholder || '请选择',
);
function confirm(event: { value: (string | number)[] }) {
  const value = event.value[0];
  if (value === undefined) return;
  emit('update:modelValue', value);
  emit('confirm', { value });
}
</script>
<template>
  <view>
    <wd-cell :title="label" :value="displayValue" is-link @click="visible = true" />
    <wd-picker
      root-portal
      :z-index="1200"
      v-model:visible="visible"
      :title="label"
      :model-value="modelValue === undefined ? [] : [modelValue]"
      :columns="options"
      @confirm="confirm"
    />
  </view>
</template>
