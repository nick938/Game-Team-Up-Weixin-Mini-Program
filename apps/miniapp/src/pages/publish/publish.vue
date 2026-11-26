<script setup lang="ts">
import { pageThemeBackground, pageThemeStyle, pageThemeForeground } from '../../utils/app-theme';
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { reactive } from 'vue';
import { usePublish } from '../../composables/usePublish';
import { useWechatTabBar } from '../../composables/useWechatTabBar';
import PublishScreen from '../../components/publish-screen/index.vue';
defineOptions({ name: 'PublishPublishPage' });
const page = reactive(usePublish());
useWechatTabBar('pages/publish/publish', () => page.singlePage);
// Keep native share hook registration in the page SFC for uni compilation.
onShareAppMessage(page.shareAppMessage);
onShareTimeline(page.shareTimeline);
</script>
<template>
  <page-meta :page-style="pageThemeStyle" :background-color="pageThemeBackground">
    <navigation-bar :front-color="pageThemeForeground" :background-color="pageThemeBackground" /> </page-meta
  ><publish-screen :page="page" />
</template>
