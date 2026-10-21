<script setup lang="ts">
import { appThemeStyle, component } from '../../design/tokens';
import { useAppTheme } from '../../composables/useAppTheme';
useAppTheme();
defineOptions({ name: 'ProfileGate' });

import { usePageFeedback } from '../../composables/usePageFeedback';

import { useTabBarOverlay } from '../../composables/useTabBarOverlay';
import { ref, watch } from 'vue';
import { GROUP_OPTIONS, PLAY_TIME_OPTIONS } from '../../utils/profile-options';
const gameDraft = ref('');
const steamFriendCode = ref('');
const wechatId = ref('');
const groupIds = ref<string[]>([]);
const favoriteGames = ref<string[]>([]);
const playTimes = ref<string[]>([]);
import { callTeam, uploadAvatar } from '../../api/team';
import { chooseAvatar, capabilities } from '../../platform/host';
import { useAppStore, type User } from '../../stores/app';
const { showError, toast } = usePageFeedback();
const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{ close: []; done: [{ user: User }] }>();
const { afterLeave } = useTabBarOverlay(() => props.show, { waitForAfterLeave: true });
const store = useAppStore();
const avatarUrl = ref(''),
  avatarFileID = ref(''),
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
    nickName.value = user.nickName || '';
    bio.value = user.bio || '';
    gameDraft.value = '';
    steamFriendCode.value = user.steamFriendCode || '';
    wechatId.value = user.wechatId || '';
    groupIds.value = [...(user.groupIds || [])];
    favoriteGames.value = [...(user.favoriteGames || [])];
    playTimes.value = [...(user.playTimes || [])];
    selectedPath.value = '';
  },
  { immediate: true },
);
function selectPath(path: string) {
  if (!path || saving.value) return;
  selectedPath.value = path;
  avatarUrl.value = path;
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
function addFavoriteGame() {
  if (saving.value) return false;
  const name = gameDraft.value.trim();
  if (!name) return true;
  if (name.length > 40) {
    showError(new Error('游戏名称最多 40 字'));
    return false;
  }
  if (
    favoriteGames.value.some(
      (game) => game.normalize('NFKC').toLowerCase() === name.normalize('NFKC').toLowerCase(),
    )
  ) {
    gameDraft.value = '';
    toast.show('已添加这个游戏');
    return true;
  }
  if (favoriteGames.value.length >= 5) {
    showError(new Error('常玩游戏最多 5 个，请先移除一个'));
    return false;
  }
  favoriteGames.value = [...favoriteGames.value, name];
  gameDraft.value = '';
  return true;
}
function removeFavoriteGame(name: string) {
  if (!saving.value) favoriteGames.value = favoriteGames.value.filter((game) => game !== name);
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
  if (steamFriendCode.value.trim() && !/^\d{1,20}$/.test(steamFriendCode.value.trim())) {
    showError(new Error('Steam 好友码请填写数字，最多 20 位'));
    return;
  }
  if (wechatId.value.trim() && !/^[A-Za-z0-9_-]{1,32}$/.test(wechatId.value.trim())) {
    showError(new Error('微信 ID 仅支持字母、数字、下划线和短横线，最多 32 位'));
    return;
  }
  if (!addFavoriteGame()) return;
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
      steamFriendCode: steamFriendCode.value.trim(),
      wechatId: wechatId.value.trim(),
      groupIds: [...groupIds.value],
      favoriteGames: [...favoriteGames.value],
      playTimes: [...playTimes.value],
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
    :duration="component.sheet.duration"
    @after-leave="afterLeave"
    root-portal
    :z-index="1100"
    :model-value="show"
    position="bottom"
    round
    :closable="!saving"
    :close-on-click-modal="!saving"
    safe-area-inset-bottom
    @update:model-value="!$event && close()"
  >
    <view class="sheet-content" :style="appThemeStyle"
      ><view class="section-title mb-4">个人资料</view
      ><scroll-view scroll-y class="profile-form-scroll">
        <view class="text-center mb-4">
          <!-- #ifdef MP-WEIXIN -->
          <wd-button
            variant="text"
            open-type="chooseAvatar"
            :disabled="saving"
            custom-class="!h-auto !p-0"
            @chooseavatar="selectPath($event.detail.avatarUrl)"
            ><wd-avatar
              size="80px"
              shape="square"
              mode="aspectFill"
              :src="avatarUrl || '/static/images/avatar.png'"
              custom-style="--wot-avatar-border-radius:24px"
          /></wd-button>
          <!-- #endif -->
          <!-- #ifndef MP-WEIXIN -->
          <wd-button variant="text" :disabled="saving" custom-class="!h-auto !p-0" @click="selectAvatar"
            ><wd-avatar
              size="80px"
              shape="square"
              mode="aspectFill"
              :src="avatarUrl || '/static/images/avatar.png'"
              custom-style="--wot-avatar-border-radius:24px"
          /></wd-button>
          <!-- #endif -->
          <view class="hint mt-2">点击更换头像</view>
        </view>
        <app-input
          v-model="nickName"
          label="昵称"
          :title-width="96"
          :type="capabilities.nicknameInput ? 'nickname' : 'text'"
          :maxlength="32"
          placeholder="填写昵称"
          :disabled="saving"
        /><app-textarea
          v-model="bio"
          label="签名"
          layout="horizontal"
          :title-width="96"
          :maxlength="50"
          show-word-count
          auto-height
          placeholder="一句话介绍自己，聊聊你的开黑风格"
          :disabled="saving"
        />
        <view class="profile-preferences">
          <view class="text-sm font-semibold mb-2">认识一下 <text class="hint">以下均为选填</text></view>
          <wd-cell-group border>
            <app-multi-select
              v-model="groupIds"
              label="群组标识"
              inline-tags
              :title-width="96"
              :columns="GROUP_OPTIONS"
              :max="10"
              :disabled="saving"
              :active="show"
              placeholder="选择群组，可留空"
            />
            <wd-cell
              title="常玩游戏"
              :label="`${favoriteGames.length}/5`"
              :title-width="96"
              center
              value-align="left"
              custom-class="profile-game-field"
            >
              <view class="profile-game-input">
                <wd-input
                  v-model="gameDraft"
                  placeholder="输入游戏名称"
                  :maxlength="40"
                  :disabled="saving"
                  compact
                  clearable
                  confirm-type="done"
                  @confirm="addFavoriteGame"
                />
                <wd-button
                  size="small"
                  variant="text"
                  :disabled="saving || !gameDraft.trim()"
                  @click="addFavoriteGame"
                  >添加</wd-button
                >
              </view>
              <view v-if="favoriteGames.length" class="profile-game-tags">
                <wd-tag
                  v-for="name in favoriteGames"
                  :key="name"
                  type="primary"
                  variant="light"
                  round
                  :closable="!saving"
                  @close="removeFavoriteGame(name)"
                  >{{ name }}</wd-tag
                >
              </view>
            </wd-cell>
            <app-multi-select
              v-model="playTimes"
              label="常玩时间"
              inline-tags
              :title-width="96"
              :columns="PLAY_TIME_OPTIONS"
              :max="5"
              :disabled="saving"
              :active="show"
              placeholder="什么时候一起玩"
            />
          </wd-cell-group>
        </view>
        <view class="profile-preferences">
          <view class="text-sm font-semibold mb-2"
            >加个好友 <text class="hint">选填，填写后对其他玩家公开</text></view
          >
          <app-input
            v-model="steamFriendCode"
            label="Steam 好友码"
            :title-width="96"
            inputmode="numeric"
            :maxlength="20"
            placeholder="填写数字好友码"
            clearable
            :disabled="saving"
          />
          <app-input
            v-model="wechatId"
            label="微信 ID"
            :title-width="96"
            :maxlength="32"
            placeholder="填写微信号"
            clearable
            :disabled="saving"
          />
        </view>
        <view class="hint my-4"
          >头像、昵称、签名、标签和已填写的联系方式会展示在公开资料中，其他玩家可复制联系方式。群组标识不限制跨群上车。</view
        > </scroll-view
      ><wd-button block :loading="saving" :disabled="saving" @click="save">保存资料</wd-button></view
    >
  </wd-popup>
</template>
<style scoped>
.profile-form-scroll {
  height: 62vh;
  max-height: 620px;
}
.profile-preferences {
  margin-top: 20px;
}
.profile-game-input {
  display: flex;
  align-items: center;
  gap: 8px;
}
.profile-game-input :deep(.wd-input) {
  min-width: 0;
  flex: 1;
}
.profile-game-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}
.profile-game-tags :deep(.wd-tag) {
  max-width: 100%;
}
.profile-game-tags :deep(.wd-tag__text) {
  white-space: normal;
  overflow-wrap: anywhere;
}
.profile-form-scroll :deep(.app-field .wd-textarea) {
  min-height: 0;
}
.profile-form-scroll :deep(.wd-cell__left) {
  margin-right: 0;
}
.profile-form-scroll :deep(.wd-cell__body) {
  align-items: center;
}
.profile-form-scroll :deep(.wd-cell__arrow-right) {
  display: inline-flex;
  align-items: center;
  line-height: 1;
}
.profile-game-input :deep(.wd-button) {
  flex-shrink: 0;
  min-width: 36px;
  padding: 0 6px;
}
.profile-game-input :deep(.wd-button__text) {
  white-space: nowrap;
}
</style>
