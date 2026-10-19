<script setup lang="ts">
defineOptions({ name: 'TeamCard' });

import { computed } from 'vue';
import type { Team } from '../../types/domain';

import { usableTeamId } from '../../utils/team-entry';
const props = withDefaults(
  defineProps<{ team?: Partial<Team>; teamId?: string; mark?: string; sequence?: number }>(),
  {
    team: () => ({}),
    teamId: '',
    mark: '',
    sequence: 0,
  },
);
const inactive = computed(() =>
  ['ended', 'cancelled', 'expired'].includes(props.team.displayStatus || props.team.status || ''),
);
const occupancy = computed(() => {
  const capacity = Number(props.team.capacity) || 0;
  const count = Number(props.team.memberCount) || 0;
  return capacity > 0 ? Math.min(100, Math.max(0, Math.round((count / capacity) * 100))) : 0;
});
const emit = defineEmits<{ open: [detail: { id: string; gameName: string }] }>();
function onTap() {
  const team = props.team || {};
  const id = usableTeamId(props.teamId || team.id || team._id);
  if (!id) return;
  emit('open', { id, gameName: team.gameName || '' });
}
</script>
<template>
  <view :class="sequence < 6 ? ['motion-card', sequence ? 'motion-step-' + sequence : ''] : ''" @tap="onTap">
    <wd-card :custom-class="'!mx-0 !mb-3 room-card tap-feedback ' + (inactive ? 'room-inactive' : '')">
      <template #title>
        <view class="flex items-start justify-between gap-3 w-full min-w-0">
          <view class="min-w-0 flex-1">
            <view
              class="text-[36rpx] font-bold leading-6 break-words"
              :class="inactive ? 'text-muted' : 'text-night'"
              >{{ team.gameName || '组队' }}</view
            >
            <view v-if="mark || team.started || team.soon" class="flex flex-wrap items-center gap-1.5 mt-1">
              <text v-if="mark" class="text-[20rpx] text-electric font-medium">{{ mark }}</text>
              <text v-if="team.started" class="text-[20rpx] text-muted">进行中</text>
              <text v-else-if="team.soon" class="text-[20rpx] text-muted">即将开始</text>
            </view>
          </view>
          <text
            class="room-status"
            :class="
              inactive
                ? 'bg-[#eaeaf1] text-[#77798d]'
                : team.displayStatus === 'recruiting'
                  ? 'bg-lime text-[#34501e]'
                  : 'bg-[#eee9ff] text-electric'
            "
            >{{
              team.displayStatus === 'recruiting' && (team.needCount || 0) > 0
                ? '缺 ' + team.needCount + ' 人'
                : team.statusText
            }}</text
          >
        </view>
      </template>
      <view class="room-meta flex items-start gap-1.5 mb-2"
        ><wd-icon name="time-line" size="14px" /><text class="min-w-0 flex-1">{{ team.timeText }}</text></view
      >
      <view
        v-if="team.platform || team.server || team.rankReq || (team.voice && team.voice !== '不限')"
        class="flex flex-wrap gap-1.5 mb-3"
      >
        <text v-if="team.platform" class="room-tag">{{ team.platform }}</text>
        <text v-if="team.server" class="room-tag">{{ team.server }}</text>
        <text v-if="team.voice && team.voice !== '不限'" class="room-tag">{{ team.voice }}</text>
        <text v-if="team.rankReq" class="room-tag">{{ team.rankReq }}</text>
      </view>
      <view
        class="flex items-center justify-between gap-4 pt-3 border-t border-x-0 border-b-0 border-solid border-[#f0f0f6]"
      >
        <view class="flex-1 min-w-0 max-w-[200rpx]">
          <view class="flex items-baseline gap-1 mb-1.5"
            ><text class="text-[36rpx] font-bold text-night">{{ team.memberCount || 0 }}</text
            ><text class="text-[22rpx] text-muted">/ {{ team.capacity || 0 }} 人已上车</text></view
          >
          <wd-progress
            custom-class="room-progress"
            :percentage="occupancy"
            :duration="0"
            :color="inactive ? '#b7b8c8' : '#7659ff'"
            hide-text
          />
        </view>
        <wd-button
          size="small"
          :variant="inactive ? 'soft' : 'base'"
          custom-class="!px-4 !text-[24rpx] !shrink-0"
          >查看队伍 <wd-icon name="arrow-right" size="12px" custom-class="!ml-1"
        /></wd-button>
      </view>
    </wd-card>
  </view>
</template>
