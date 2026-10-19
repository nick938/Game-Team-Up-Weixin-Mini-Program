<script setup lang="ts">
import { useAppTheme } from '../../composables/useAppTheme';
useAppTheme();
defineOptions({ name: 'LegalLegalPage' });
import { reactive } from 'vue';
import { useLegal } from '../../composables/useLegal';
const page = reactive(useLegal());
</script>
<template>
  <app-shell :title="page.title" subtitle="开黑星球｜游戏搭子">
    <view class="flex flex-wrap gap-2 mb-5"
      ><wd-button
        v-for="doc in page.docs"
        :key="doc.key"
        size="small"
        :variant="page.activeType === doc.key ? 'base' : 'soft'"
        @click="page.pickDoc(doc.key)"
        >{{ doc.label }}</wd-button
      ></view
    >
    <view class="hint mb-4">更新日期：{{ page.updated }}</view
    ><wd-card
      v-for="section in page.sections"
      :key="section.heading"
      :title="section.heading"
      custom-class="!mx-0 !mb-4"
      ><view class="text-sm leading-7 whitespace-pre-wrap break-words">{{ section.body }}</view></wd-card
    >
  </app-shell>
</template>
