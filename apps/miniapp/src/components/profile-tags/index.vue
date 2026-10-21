<script setup lang="ts">
defineOptions({ name: 'ProfileTags' });
import { computed } from 'vue';
import type { User } from '../../types/domain';
import { groupLabels, playTimeLabels } from '../../utils/profile-options';
const props = defineProps<{ user: User; groupsOnly?: boolean }>();
const groups = computed(() => groupLabels(props.user.groupIds));
const times = computed(() => playTimeLabels(props.user.playTimes));
</script>
<template>
  <view v-if="groups.length" class="profile-tags" aria-label="群组标识">
    <wd-tag v-for="name in groups" :key="name" type="primary" variant="light" round>{{ name }}</wd-tag>
  </view>
  <template v-if="!groupsOnly">
    <view v-if="user.favoriteGames?.length" class="profile-preference">
      <view class="hint">常玩游戏</view
      ><view class="profile-tags"
        ><wd-tag v-for="name in user.favoriteGames" :key="name" variant="light" round>{{
          name
        }}</wd-tag></view
      >
    </view>
    <view v-if="times.length" class="profile-preference">
      <view class="hint">常玩时间</view
      ><view class="profile-tags"
        ><wd-tag v-for="name in times" :key="name" variant="light" round>{{ name }}</wd-tag></view
      >
    </view>
  </template>
</template>
<style scoped>
.profile-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.profile-preference {
  margin-top: 16px;
}
.profile-tags :deep(.wd-tag) {
  max-width: 100%;
}
.profile-tags :deep(.wd-tag__text) {
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
