<script setup lang="ts">
import { useAttrs } from 'vue';
defineOptions({ name: 'AppTextarea', inheritAttrs: false });
defineProps<{ label?: string; modelValue?: string | number; required?: boolean; error?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const attrs = useAttrs();
</script>
<template>
  <wd-cell :title="label" :required="required" layout="vertical" value-align="left" custom-class="app-field">
    <wd-textarea
      v-bind="attrs"
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', String($event))"
    />
    <view v-if="error" class="field-error" role="alert">{{ error }}</view>
  </wd-cell>
</template>
