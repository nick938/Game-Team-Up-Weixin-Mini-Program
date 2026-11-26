<script setup lang="ts">
import { computed } from 'vue';
import { privacyConsent } from '../../utils/privacy';
import WelcomeLetter from '../welcome-letter/index.vue';
defineOptions({ name: 'EntryNotices' });
const privacyReady = computed(
  () => !privacyConsent.state.checking && !privacyConsent.state.visible && !privacyConsent.state.closing,
);
</script>

<template>
  <welcome-letter :enabled="privacyReady" />
</template>
