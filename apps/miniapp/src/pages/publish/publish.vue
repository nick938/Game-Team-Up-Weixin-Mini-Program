<script setup lang="ts">
import { reactive } from 'vue';
import { usePublish } from '../../composables/usePublish';
import PublishScreen from '../../components/publish-screen/index.vue';
defineOptions({ name: 'PublishPublishPage' });
const page = reactive(usePublish());
</script>
<template><publish-screen :page="page" /></template>
