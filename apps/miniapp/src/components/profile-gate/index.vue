<script setup lang="ts">
import { ref, watch } from 'vue';
import { callTeam, uploadAvatar, showError } from '../../api/team';
import { chooseAvatar, capabilities } from '../../platform/host';
import { useAppStore, type User } from '../../stores/app';
const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{ close: []; done: [{ user: User }] }>();
const store = useAppStore();
const avatarUrl = ref(''), avatarFileID = ref(''), avatarBase64 = ref(''), nickName = ref(''), bio = ref('');
const saving = ref(false), selectedPath = ref('');
watch(() => props.show, visible => {
  if (!visible) return;
  const user = store.user || {};
  avatarUrl.value = user.avatarUrl || '';
  avatarFileID.value = user.avatarFileID || '';
  avatarBase64.value = user.avatarBase64 || '';
  nickName.value = user.nickName || '';
  bio.value = user.bio || '';
  selectedPath.value = '';
}, { immediate: true });
function selectPath(path: string) {
  if (!path || saving.value) return;
  selectedPath.value = path;
  avatarUrl.value = path;
  avatarBase64.value = '';
}
async function selectAvatar() {
  try { selectPath(await chooseAvatar()); } catch (error) { showError(error); }
}
function close() { if (!saving.value) emit('close'); }
async function save() {
  if (saving.value) return;
  if (!nickName.value.trim()) { showError(new Error('请填写昵称')); return; }
  if (bio.value.trim().length > 50) { showError(new Error('签名最多 50 字')); return; }
  saving.value = true;
  try {
    let fileID = avatarFileID.value;
    if (selectedPath.value) {
      const path = await new Promise<string>(resolve => uni.compressImage({
        src: selectedPath.value, quality: 60,
        success(result) { resolve(result.tempFilePath); }, fail() { resolve(selectedPath.value); },
      }));
      fileID = await uploadAvatar(path);
    }
    const result = await callTeam('saveProfile', { nickName: nickName.value.trim(), bio: bio.value.trim(), avatarUrl: fileID });
    if (!result.user || typeof result.user !== 'object') throw new Error('资料保存失败，请重试');
    const user = result.user as User;
    store.user = user;
    emit('done', { user });
  } catch (error) { showError(error); }
  finally { saving.value = false; }
}
</script>
<template>
  <view v-if="show" class="mask" @touchmove.stop.prevent>
    <view class="sheet">
      <view class="sheet-heading"><view class="title">个人资料</view><button size="mini" class="close" :disabled="saving" @tap="close">×</button></view>
      <scroll-view class="profile-scroll" scroll-y>
        <!-- #ifdef MP-WEIXIN -->
        <button class="avatar-btn" open-type="chooseAvatar" :disabled="saving" @chooseavatar="selectPath($event.detail.avatarUrl)">
          <image class="avatar" :src="avatarUrl || (avatarBase64 ? 'data:image/jpeg;base64,' + avatarBase64 : '/static/images/avatar.png')" mode="aspectFill" />
          <view class="avatar-tip">点击更换头像</view>
        </button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <button class="avatar-btn" :disabled="saving" @tap="selectAvatar">
          <image class="avatar" :src="avatarUrl || (avatarBase64 ? 'data:image/jpeg;base64,' + avatarBase64 : '/static/images/avatar.png')" mode="aspectFill" />
          <view class="avatar-tip">点击更换头像</view>
        </button>
        <!-- #endif -->
        <view class="field-label">昵称</view>
        <input v-model="nickName" class="nick" :type="capabilities.nicknameInput ? 'nickname' : 'text'" :maxlength="32" placeholder="填写昵称" :disabled="saving" />
        <view class="field-head"><text class="field-label">签名</text><text class="field-count">{{ bio.length }}/50</text></view>
        <textarea v-model="bio" class="bio" :maxlength="50" placeholder="一句话介绍自己，比如 Steam 好友码、常玩时间" :disabled="saving" />
        <view class="field-hint">房间里的访客可看到你的头像、昵称和签名。</view>
      </scroll-view>
      <view class="save-action"><wd-button block :loading="saving" :disabled="saving" @click="save">保存资料</wd-button></view>
    </view>
  </view>
</template>
<style scoped>
.mask { position: fixed; left: 0; right: 0; top: 0; bottom: 0; background: rgba(0,0,0,.4); z-index: 100; display: flex; align-items: flex-end; }
.sheet { width: 100%; padding: 28rpx 32rpx calc(24rpx + env(safe-area-inset-bottom)); box-sizing: border-box; background: #fff; border-radius: 28rpx 28rpx 0 0; }
.sheet-heading { display: flex; align-items: center; justify-content: space-between; }
.title { font-size: 34rpx; font-weight: 700; color: #202438; }
button::after { border: 0; }
button.close { margin: 0; padding: 0; width: 72rpx; line-height: 72rpx; background: transparent; font-size: 40rpx; color: #777e92; }
.profile-scroll { height: 58vh; }
.avatar-btn { margin: 16rpx auto; padding: 0; background: transparent; }
.avatar { width: 112rpx; height: 112rpx; border-radius: 36rpx; }
.avatar-tip { font-size: 23rpx; color: #777e92; line-height: 1.5; margin-top: 8rpx; }
.field-label { font-size: 25rpx; color: #535b72; margin-top: 24rpx; }
.field-head { display: flex; align-items: baseline; justify-content: space-between; }
.field-count { font-size: 22rpx; color: #a0a6b8; }
.nick { margin-top: 12rpx; height: 84rpx; padding: 0 20rpx; box-sizing: border-box; background: #f5f6fa; border-radius: 16rpx; font-size: 28rpx; }
.bio { width: 100%; height: 140rpx; margin-top: 12rpx; padding: 20rpx; background: #f5f6fa; border-radius: 16rpx; box-sizing: border-box; font-size: 26rpx; }
.field-hint { margin-top: 16rpx; font-size: 22rpx; line-height: 1.6; color: #9aa0b4; }
.submit { width: 100% !important; padding: 0; margin-top: 24rpx; height: 88rpx; line-height: 88rpx; font-size: 28rpx; font-weight: 600; background: #6255e7; color: #fff; border-radius: 20rpx; }
.submit[disabled] { opacity: .5; }
.save-action { margin-top: 24rpx; }
</style>
