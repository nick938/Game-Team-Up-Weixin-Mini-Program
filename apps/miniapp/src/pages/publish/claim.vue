<script setup lang="ts">
import { reactive } from 'vue';
import { usePublish } from '../../composables/usePublish';
import PublishScreen from '../../components/publish-screen/index.vue';
defineOptions({ name: 'OfficialClaimPage' });
const page = reactive(usePublish({ claimMode: true }));
</script>
<template><publish-screen :page="page" claim-mode /></template>
