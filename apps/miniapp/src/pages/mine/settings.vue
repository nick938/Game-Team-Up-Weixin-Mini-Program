<script setup lang="ts">
import { ref } from 'vue';
import { onHide } from '@dcloudio/uni-app';
import { useAppTheme } from '../../composables/useAppTheme';
import { usePageActive } from '../../composables/usePageActive';
import { platform } from '../../platform/host';
import { getAppVersion } from '../../utils/version';
defineOptions({ name: 'MineSettingsPage' });
useAppTheme();
const pageActive = usePageActive('pages/mine/settings');
const showProfile = ref(false);
const versionText = getAppVersion().text;
function openLegal(type: string) {
  platform.navigateTo({ url: `/pages/legal/legal?type=${type}` });
}
onHide(() => {
  showProfile.value = false;
});
</script>
<template>
  <app-shell :active="pageActive" variant="form">
    <view class="section-label !mt-0">个人资料</view>
    <wd-cell-group border>
      <wd-cell
        title="编辑资料"
        label="头像、签名、游戏偏好与联系方式"
        prefix-icon="user"
        is-link
        @click="showProfile = true"
      />
    </wd-cell-group>
    <view class="section-label">关于与协议</view>
    <wd-cell-group border>
      <wd-cell title="用户协议" prefix-icon="file" is-link @click="openLegal('agreement')" />
      <wd-cell title="隐私政策" prefix-icon="safe" is-link @click="openLegal('privacy')" />
      <wd-cell title="社区公约" prefix-icon="user-group" is-link @click="openLegal('community')" />
    </wd-cell-group>
    <view class="hint text-center py-5">{{ versionText }}</view>
    <profile-gate :show="showProfile" @done="showProfile = false" @close="showProfile = false" />
  </app-shell>
</template>
