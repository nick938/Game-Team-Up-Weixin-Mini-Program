<script setup lang="ts">
import { ref, computed } from 'vue';
import { privacyConsent } from '../../utils/privacy';
import WelcomeLetter from '../welcome-letter/index.vue';
import UpdateNotice from '../update-notice/index.vue';
defineOptions({ name: 'EntryNotices' });
const welcomeReady = ref(false);
const privacyReady = computed(
  () => !privacyConsent.state.checking && !privacyConsent.state.visible && !privacyConsent.state.closing,
);
function onWelcomeReady() {
  welcomeReady.value = true;
}
</script>

<template>
  <welcome-letter :enabled="privacyReady" @ready="onWelcomeReady" />
  <update-notice :enabled="privacyReady && welcomeReady" />
</template>
