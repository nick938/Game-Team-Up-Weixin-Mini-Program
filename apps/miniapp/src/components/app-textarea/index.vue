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
    :center="false"
    :custom-style="layout === 'horizontal' ? '--wot-cell-title-line-height:24px' : undefined"
    value-align="left"
    custom-class="app-field"
  >
    <wd-textarea
      v-bind="attrs"
      compact
      :custom-style="
        layout === 'horizontal'
          ? 'min-height:0;--wot-textarea-inner-min-height:24px;--wot-textarea-inner-line-height:24px'
          : undefined
      "
      :disable-default-padding="true"
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', String($event))"
    />
    <view v-if="error" class="field-error" role="alert">{{ error }}</view>
  </wd-form-item>
</template>
