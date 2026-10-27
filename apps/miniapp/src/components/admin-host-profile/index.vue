<script setup lang="ts">
import type { User } from '../../types/domain';
import MineAvatar from '../mine-avatar/index.vue';
import { groupLabels } from '../../utils/profile-options';
defineOptions({ name: 'AdminHostProfile' });
defineProps<{ user: User; openid: string }>();
</script>
<template>
  <view class="host-profile">
    <view class="host-profile-heading">
      <mine-avatar :src="user.avatarUrl" :identity="openid" :size="42" />
      <view class="host-profile-identity">
        <view class="host-profile-name">{{ user.nickName || '车头资料暂不可用' }}</view>
        <view class="host-profile-id">OpenID：{{ openid }}</view>
      </view>
    </view>
    <view v-if="user.bio" class="host-profile-bio">{{ user.bio }}</view>
    <view class="host-profile-field"
      ><text>Steam 好友码</text><text>{{ user.steamFriendCode || '未填写' }}</text></view
    >
    <view class="host-profile-field"
      ><text>微信 ID</text><text>{{ user.wechatId || '未填写' }}</text></view
    >
    <view class="host-profile-field"
      ><text>群组标识</text><text>{{ groupLabels(user.groupIds).join('、') || '未设置' }}</text></view
    >
  </view>
</template>
<style scoped>
.host-profile {
  padding: 14px;
  border-radius: 12px;
  background: var(--app-page);
}
.host-profile-heading {
  display: flex;
  align-items: center;
  gap: 10px;
}
.host-profile-identity {
  min-width: 0;
  flex: 1;
}
.host-profile-name {
  font-size: 15px;
  line-height: 22px;
  font-weight: 600;
  color: var(--app-ink);
}
.host-profile-id {
  margin-top: 2px;
  font-size: 11px;
  line-height: 17px;
  color: var(--app-muted);
  overflow-wrap: anywhere;
}
.host-profile-bio {
  margin-top: 10px;
  font-size: 12px;
  line-height: 19px;
  color: var(--app-secondary);
  overflow-wrap: anywhere;
}
.host-profile-field {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 12px;
  line-height: 19px;
}
.host-profile-field > text:first-child {
  flex-shrink: 0;
  color: var(--app-secondary);
}
.host-profile-field > text:last-child {
  text-align: right;
  overflow-wrap: anywhere;
  color: var(--app-ink);
}
</style>
