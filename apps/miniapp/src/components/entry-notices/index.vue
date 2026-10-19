<script setup lang="ts">
import { ref } from 'vue';
import WelcomeLetter from '../welcome-letter/index.vue';
import UpdateNotice from '../update-notice/index.vue';
defineOptions({ name: 'EntryNotices' });
const welcomeReady = ref(false);
function onWelcomeReady() {
  welcomeReady.value = true;
}
</script>

<template>
  <welcome-letter @ready="onWelcomeReady" />
  <update-notice :enabled="welcomeReady" />
</template>
