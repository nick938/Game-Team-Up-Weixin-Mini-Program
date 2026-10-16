<script setup lang="ts">
defineOptions({ name: 'ProfileGate' });

import { usePageFeedback } from '../../composables/usePageFeedback';

import { useTabBarOverlay } from '../../composables/useTabBarOverlay';
import { ref, watch } from 'vue';
import { callTeam, uploadAvatar } from '../../api/team';
import { chooseAvatar, capabilities } from '../../platform/host';
import { useAppStore, type User } from '../../stores/app';
const { showError } = usePageFeedback();
const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{ close: []; done: [{ user: User }] }>();
useTabBarOverlay(() => props.show);
const store = useAppStore();
const avatarUrl = ref(''),
  avatarFileID = ref(''),
  avatarBase64 = ref(''),
  nickName = ref(''),
  bio = ref('');
const saving = ref(false),
  selectedPath = ref('');
watch(
  () => props.show,
  (visible) => {
    if (!visible) return;
    const user = store.user || {};
    avatarUrl.value = user.avatarUrl || '';
    avatarFileID.value = user.avatarFileID || '';
    avatarBase64.value = user.avatarBase64 || '';
    nickName.value = user.nickName || '';
    bio.value = user.bio || '';
    selectedPath.value = '';
  },
  { immediate: true },
);
function selectPath(path: string) {
  if (!path || saving.value) return;
  selectedPath.value = path;
  avatarUrl.value = path;
  avatarBase64.value = '';
}
async function selectAvatar() {
  try {
    selectPath(await chooseAvatar());
  } catch (error) {
    showError(error);
  }
}
function close() {
  if (!saving.value) emit('close');
}
async function save() {
  if (saving.value) return;
  if (!nickName.value.trim()) {
    showError(new Error('请填写昵称'));
    return;
  }
  if (bio.value.trim().length > 50) {
    showError(new Error('签名最多 50 字'));
    return;
  }
  saving.value = true;
  try {
    let fileID = avatarFileID.value;
    if (selectedPath.value) {
      const path = await new Promise<string>((resolve) =>
        uni.compressImage({
          src: selectedPath.value,
          quality: 60,
          success(result) {
            resolve(result.tempFilePath);
          },
          fail() {
            resolve(selectedPath.value);
          },
        }),
      );
      fileID = await uploadAvatar(path);
    }
    const result = await callTeam('saveProfile', {
      nickName: nickName.value.trim(),
      bio: bio.value.trim(),
      avatarUrl: fileID,
    });
    if (!result.user || typeof result.user !== 'object') throw new Error('资料保存失败，请重试');
    const user = result.user as User;
    store.user = user;
    emit('done', { user });
  } catch (error) {
    showError(error);
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <wd-popup
    :z-index="1100"
    :model-value="show"
    position="bottom"
    :closable="!saving"
    :close-on-click-modal="!saving"
    safe-area-inset-bottom
    @update:model-value="!$event && close()"
  >
    <view class="sheet-content"
      ><view class="section-title mb-4">个人资料</view
      ><scroll-view scroll-y class="h-[58vh]">
        <view class="text-center mb-4">
          <!-- #ifdef MP-WEIXIN -->
          <wd-button
            variant="text"
            open-type="chooseAvatar"
            :disabled="saving"
            custom-class="!h-auto !p-0"
            @chooseavatar="selectPath($event.detail.avatarUrl)"
            ><image
              class="w-20 h-20 rounded-3xl"
              :src="
                avatarUrl ||
                (avatarBase64 ? 'data:image/jpeg;base64,' + avatarBase64 : '/static/images/avatar.png')
              "
              mode="aspectFill"
          /></wd-button>
          <!-- #endif -->
          <!-- #ifndef MP-WEIXIN -->
          <wd-button variant="text" :disabled="saving" custom-class="!h-auto !p-0" @click="selectAvatar"
            ><image
              class="w-20 h-20 rounded-3xl"
              :src="
                avatarUrl ||
                (avatarBase64 ? 'data:image/jpeg;base64,' + avatarBase64 : '/static/images/avatar.png')
              "
              mode="aspectFill"
          /></wd-button>
          <!-- #endif -->
          <view class="hint mt-2">点击更换头像</view>
        </view>
        <app-input
          v-model="nickName"
          label="昵称"
          :type="capabilities.nicknameInput ? 'nickname' : 'text'"
          :maxlength="32"
          placeholder="填写昵称"
          :disabled="saving"
        /><app-textarea
          v-model="bio"
          label="签名"
          :maxlength="50"
          show-word-count
          auto-height
          placeholder="Steam 好友码、常玩时间，或一句话介绍自己"
          :disabled="saving"
        /><view class="hint my-4">房间里的访客可看到你的头像、昵称和签名。</view> </scroll-view
      ><wd-button block :loading="saving" :disabled="saving" @click="save">保存资料</wd-button></view
    >
  </wd-popup>
</template>
