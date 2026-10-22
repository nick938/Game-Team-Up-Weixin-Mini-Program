<script setup lang="ts">
defineOptions({ name: 'AppMultiSelect' });
import { computed, ref, watch } from 'vue';
import { useTabBarOverlay } from '../../composables/useTabBarOverlay';
const props = withDefaults(
  defineProps<{
    modelValue?: string[];
    label: string;
    columns: { label: string; value: string }[];
    placeholder?: string;
    max?: number;
    disabled?: boolean;
    active?: boolean;
    inlineTags?: boolean;
    titleWidth?: string | number;
  }>(),
  { modelValue: () => [], placeholder: '选填', max: 0, active: true },
);
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>();
const visible = ref(false);
useTabBarOverlay(visible);
watch(
  () => props.active,
  (active) => {
    if (!active) visible.value = false;
  },
);
const selected = computed(() => props.columns.filter((item) => props.modelValue.includes(item.value)));
function confirm({ value }: { value: unknown }) {
  if (!props.disabled && props.active && Array.isArray(value)) emit('update:modelValue', value.map(String));
}
function remove(value: string) {
  if (!props.disabled)
    emit(
      'update:modelValue',
      props.modelValue.filter((item) => item !== value),
    );
}
</script>
<template>
  <wd-cell
    :title="label"
    :value="selected.length ? `已选 ${selected.length} 项` : placeholder"
    :title-width="titleWidth"
    :value-align="inlineTags ? 'left' : 'right'"
    center
    is-link
    :clickable="!disabled"
    @click="!disabled && (visible = true)"
  >
    <view v-if="inlineTags && selected.length" class="inline-selection-tags">
      <wd-tag
        v-for="item in selected"
        :key="item.value"
        type="primary"
        variant="light"
        round
        :closable="!disabled"
        @close="remove(item.value)"
        >{{ item.label }}</wd-tag
      >
    </view>
    <text v-else>{{ selected.length ? `已选 ${selected.length} 项` : placeholder }}</text>
  </wd-cell>
  <view v-if="selected.length && !inlineTags" class="selection-tags">
    <wd-tag
      v-for="item in selected"
      :key="item.value"
      type="primary"
      variant="light"
      round
      :closable="!disabled"
      @close="remove(item.value)"
      >{{ item.label }}</wd-tag
    >
  </view>
  <wd-select-picker
    v-model:visible="visible"
    :model-value="modelValue"
    :columns="columns"
    :title="label"
    type="checkbox"
    :min="0"
    :max="max"
    filterable
    filter-placeholder="搜索选项"
    root-portal
    :z-index="1300"
    @confirm="confirm"
  />
</template>
<style scoped>
.selection-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 16px 12px;
}
.inline-selection-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
  padding: 4px 0;
}
.inline-selection-tags :deep(.wd-tag) {
  max-width: 100%;
}
.inline-selection-tags :deep(.wd-tag__text) {
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
