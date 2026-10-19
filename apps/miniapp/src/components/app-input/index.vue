<script setup lang="ts">
import { useAttrs } from 'vue';
defineOptions({ name: 'AppInput', inheritAttrs: false });
defineProps<{
  label?: string;
  prop?: string;
  layout?: 'horizontal' | 'vertical';
  modelValue?: string | number;
  required?: boolean;
  error?: string;
  help?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string]; blur: [] }>();
const attrs = useAttrs();
</script>
<template>
  <wd-form-item
    :title="label"
    :required="required"
    :prop="prop"
    :layout="layout || 'horizontal'"
    title-width="84px"
    center
    value-align="left"
    custom-class="app-field"
    :class="error ? 'app-field-error' : ''"
  >
    <wd-input
      v-bind="attrs"
      compact
      :model-value="modelValue"
      @blur="emit('blur')"
      @update:model-value="emit('update:modelValue', String($event))"
    />
    <view v-if="error" class="field-error" role="alert">{{ error }}</view>
    <view v-else-if="help" class="hint mt-2">{{ help }}</view>
  </wd-form-item>
</template>
