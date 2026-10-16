<script setup lang="ts">
import { useAttrs } from 'vue';
defineOptions({ name: 'AppInput', inheritAttrs: false });
defineProps<{ label?: string; modelValue?: string | number; required?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const attrs = useAttrs();
</script>
<template>
  <wd-cell :title="label" :required="required" layout="vertical" value-align="left">
    <wd-input
      v-bind="attrs"
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', String($event))"
    />
  </wd-cell>
</template>
