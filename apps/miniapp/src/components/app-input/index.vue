<script setup lang="ts">
import { useAttrs } from 'vue';
defineOptions({ name: 'AppInput', inheritAttrs: false });
defineProps<{
  label?: string;
  modelValue?: string | number;
  required?: boolean;
  error?: string;
  help?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string]; blur: [] }>();
const attrs = useAttrs();
</script>
<template>
  <wd-cell
    :title="label"
    :required="required"
    layout="vertical"
    value-align="left"
    custom-class="app-field"
    :class="error ? 'app-field-error' : ''"
  >
    <wd-input
      v-bind="attrs"
      :model-value="modelValue"
      @blur="emit('blur')"
      @update:model-value="emit('update:modelValue', String($event))"
    />
    <view v-if="error" class="field-error" role="alert">{{ error }}</view>
    <view v-else-if="help" class="hint mt-2">{{ help }}</view>
  </wd-cell>
</template>
