<script setup lang="ts">
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { reactive } from 'vue';
import { usePublish } from '../../composables/usePublish';
import PublishScreen from '../../components/publish-screen/index.vue';
defineOptions({ name: 'PublishPublishPage' });
const page = reactive(usePublish());
// Keep native share hook registration in the page SFC for uni compilation.
onShareAppMessage(page.shareAppMessage);
onShareTimeline(page.shareTimeline);
</script>
<template><publish-screen :page="page" /></template>
