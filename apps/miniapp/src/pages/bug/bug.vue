<script setup lang="ts">
defineOptions({ name: 'BugBugPage' });
import { reactive } from 'vue';
import { useBug } from '../../composables/useBug';
const page = reactive(useBug());
</script>
<template>
  <app-shell title="报个错" subtitle="告诉我们你做了什么、出现了什么。">
    <wd-cell-group
      ><app-picker
        label="所在页面"
        :model-value="page.pageName"
        :columns="page.pages"
        @confirm="page.pickPage(String($event.value))" /><app-textarea
        label="发生了什么"
        :model-value="page.content"
        :maxlength="800"
        show-word-count
        auto-height
        @update:model-value="page.onContent(String($event))" /><app-textarea
        label="错误信息"
        :model-value="page.errorMsg"
        :maxlength="500"
        show-word-count
        auto-height
        placeholder="如果看到错误提示，可以贴在这里"
        @update:model-value="page.onErrorMsg(String($event))"
    /></wd-cell-group>
    <view class="my-5"
      ><wd-button block :loading="page.submitting" :disabled="page.submitting" @click="page.onSubmit"
        >提交报错</wd-button
      ></view
    >
  </app-shell>
</template>
