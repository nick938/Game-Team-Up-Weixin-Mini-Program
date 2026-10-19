<script setup lang="ts">
import { useAppTheme } from '../../composables/useAppTheme';
useAppTheme();
defineOptions({ name: 'FeedbackFeedbackPage' });
import { reactive } from 'vue';
import { useFeedback } from '../../composables/useFeedback';
const page = reactive(useFeedback());
</script>
<template>
  <app-shell title="写给我们" subtitle="按模板填写，我们会认真看。">
    <wd-cell-group
      ><app-picker
        label="反馈类型"
        :model-value="page.kind"
        :columns="page.kinds"
        @confirm="page.pickKind(String($event.value))" /><app-picker
        label="所在页面"
        :model-value="page.pageName"
        :columns="page.pages"
        @confirm="page.pickPage(String($event.value))" /><app-textarea
        label="反馈内容"
        :model-value="page.content"
        :maxlength="800"
        show-word-count
        auto-height
        @update:model-value="page.onContent(String($event))"
    /></wd-cell-group>
    <view class="my-5"
      ><wd-button block :loading="page.submitting" :disabled="page.submitting" @click="page.onSubmit"
        >发送到邮箱</wd-button
      ></view
    ><view class="hint text-center">当前版本 {{ page.versionText }}</view>
  </app-shell>
</template>
