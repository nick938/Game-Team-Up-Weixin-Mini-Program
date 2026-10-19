<script setup lang="ts">
import { useAppTheme } from '../../composables/useAppTheme';
useAppTheme();
defineOptions({ name: 'ReportReportPage' });
import { reactive } from 'vue';
import { useReport } from '../../composables/useReport';
const page = reactive(useReport());
</script>
<template>
  <app-shell title="举报" subtitle="如果这趟车涉及广告、辱骂或违规内容，告诉我们，我们会尽快处理。">
    <wd-cell-group
      ><wd-cell title="举报对象" :value="page.targetName || '组队'" /><app-picker
        label="举报理由"
        :model-value="page.reason"
        :columns="page.reasons"
        placeholder="请选择举报理由"
        @confirm="page.pickReason(String($event.value))" /><app-textarea
        label="补充说明"
        :model-value="page.content"
        :maxlength="500"
        show-word-count
        auto-height
        placeholder="方便的话，说说具体是什么情况"
        @update:model-value="page.onContent(String($event))"
    /></wd-cell-group>
    <view class="my-5"
      ><wd-button
        block
        type="danger"
        :loading="page.submitting"
        :disabled="page.submitting"
        @click="page.onSubmit"
        >提交举报</wd-button
      ></view
    >
  </app-shell>
</template>
