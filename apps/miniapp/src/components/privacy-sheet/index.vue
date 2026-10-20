<script setup lang="ts">
import { computed, ref } from 'vue';
import { onShow, onHide, onUnload } from '@dcloudio/uni-app';
import { privacyConsent } from '../../utils/privacy';
import { useTabBarOverlay } from '../../composables/useTabBarOverlay';
import { useToast } from '@wot-ui/ui';
defineOptions({ name: 'PrivacySheet' });

const props = withDefaults(defineProps<{ active?: boolean }>(), { active: true });
const foreground = ref(true);
onShow(() => {
  foreground.value = true;
});
onHide(() => {
  foreground.value = false;
});
onUnload(() => {
  foreground.value = false;
});
const visible = computed(() => foreground.value && props.active !== false && privacyConsent.state.visible);
const { afterLeave: releaseOverlay } = useTabBarOverlay(visible, { waitForAfterLeave: true });
function afterLeave() {
  releaseOverlay();
  if (!privacyConsent.state.visible) privacyConsent.afterLeave();
}
const toast = useToast();
function openContract() {
  privacyConsent.openContract(() => toast.show('暂时无法打开隐私指引，请稍后重试'));
}
</script>
<template>
  <wd-popup
    :model-value="visible"
    position="bottom"
    root-portal
    safe-area-inset-bottom
    :close-on-click-modal="false"
    :z-index="1500"
    custom-style="border-radius:24px 24px 0 0;background:#fff;"
    @after-leave="afterLeave"
  >
    <view class="privacy-content">
      <view class="privacy-title">用户隐私保护提示</view>
      <view class="privacy-copy">
        在你使用开黑星球服务之前，请仔细阅读
        <text class="privacy-link" role="link" @click="openContract">{{
          privacyConsent.state.contractName
        }}</text
        >。 如你同意该指引，请点击“同意”继续使用。
      </view>
      <view class="privacy-actions">
        <wd-button block type="info" @click="privacyConsent.reject()">拒绝</wd-button>
        <wd-button
          block
          button-id="privacy-agree"
          open-type="agreePrivacyAuthorization"
          @agreeprivacyauthorization="privacyConsent.agree()"
          >同意</wd-button
        >
      </view>
    </view>
  </wd-popup>
</template>
<style scoped>
.privacy-content {
  max-width: 560px;
  margin: 0 auto;
  padding: 36px 24px 32px;
  box-sizing: border-box;
  color: #22232a;
}
.privacy-title {
  font-size: 21px;
  line-height: 30px;
  font-weight: 600;
}
.privacy-copy {
  margin-top: 24px;
  font-size: 15px;
  line-height: 27px;
  color: #596174;
}
.privacy-link {
  color: #6255e7;
}
.privacy-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 48px;
}
</style>
