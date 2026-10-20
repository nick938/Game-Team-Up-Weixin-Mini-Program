<script setup lang="ts">
defineOptions({ name: 'TeamResults' });
import type { Team } from '../../types/domain';
import { ref, watch, onUnmounted } from 'vue';
const props = defineProps<{
  teams: Team[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string;
}>();
const introIds = ref<string[]>([]);
let introPlayed = false;
let introTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => props.teams,
  (teams) => {
    if (introPlayed || !teams.length) return;
    introPlayed = true;
    introIds.value = teams.slice(0, 4).map((team) => team._id);
    introTimer = setTimeout(() => {
      introIds.value = [];
    }, 360);
  },
  { immediate: true },
);
onUnmounted(() => clearTimeout(introTimer));
const emit = defineEmits<{
  open: [detail: { id?: string; gameName?: string }];
  retry: [];
  more: [];
  clear: [];
  publish: [];
}>();
</script>
<template>
  <view class="flex justify-between items-center mt-5 mb-3"
    ><view class="text-base font-semibold">正在组队</view
    ><text class="hint">{{ loading && teams.length ? '更新中 · ' : '' }}{{ total }} 个队伍</text></view
  >
  <view v-if="error && teams.length" class="form-note"
    ><text>{{ error }}，当前显示上次加载的队伍。</text
    ><wd-button size="small" variant="text" @click="emit('retry')">重试</wd-button></view
  >
  <view v-if="loading && !teams.length" class="panel" aria-label="正在加载队伍"
    ><wd-skeleton
      animation="gradient"
      :row-col="[
        { width: '160px', height: '24px' },
        { width: '100%', height: '16px' },
      ]"
  /></view>
  <view v-else-if="error && !teams.length" class="panel"
    ><view class="text-sm mb-3">{{ error }}</view
    ><wd-button variant="soft" @click="emit('retry')">重新加载</wd-button></view
  >
  <template v-else>
    <team-card
      v-for="team in teams"
      :key="team._id"
      :team="team"
      :team-id="team.id || team._id"
      :sequence="introIds.indexOf(team._id)"
      @open="emit('open', $event)"
    />
    <view v-if="!teams.length" class="empty-state"
      ><wd-empty icon="search" :icon-size="58" tip="暂时没有符合条件的队伍" /><view
        class="flex flex-wrap justify-center gap-2"
        ><wd-button variant="text" @click="emit('clear')">清空筛选</wd-button
        ><wd-button variant="text" @click="emit('publish')">发布一局</wd-button></view
      ></view
    >
  </template>
  <view v-if="!loading && teams.length" class="text-center py-4"
    ><wd-button v-if="hasMore" variant="text" :loading="loadingMore" @click="emit('more')">加载更多</wd-button
    ><text v-else class="hint">已展示全部匹配队伍</text></view
  >
</template>
