<script setup lang="ts">
import { useAttrs } from 'vue';
defineOptions({ name: 'AppTextarea', inheritAttrs: false });
defineProps<{
  label?: string;
  layout?: 'horizontal' | 'vertical';
  titleWidth?: string | number;
  modelValue?: string | number;
  required?: boolean;
  error?: string;
  prop?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const attrs = useAttrs();
</script>
<template>
  <wd-form-item
    :prop="prop"
    :title="label"
    :required="required"
    :layout="layout || 'vertical'"
    :title-width="titleWidth"
    :center="layout === 'horizontal'"
    value-align="left"
    custom-class="app-field"
  >
    <wd-textarea
      v-bind="attrs"
      compact
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', String($event))"
    />
    <view v-if="error" class="field-error" role="alert">{{ error }}</view>
  </wd-form-item>
</template>
