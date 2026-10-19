<script setup lang="ts">
defineOptions({ name: 'TeamCard' });
import { computed } from 'vue';
import type { Team } from '../../types/domain';
import { usableTeamId } from '../../utils/team-entry';
import { useTeamPresentation } from '../../composables/useTeamPresentation';
import { semantic } from '../../design/tokens';
const props = withDefaults(
  defineProps<{ team?: Partial<Team>; teamId?: string; mark?: string; sequence?: number }>(),
  { team: () => ({}), teamId: '', mark: '', sequence: 0 },
);
const view = useTeamPresentation(() => props.team);
const occupancy = computed(() =>
  props.team.capacity
    ? Math.min(100, Math.max(0, ((Number(props.team.memberCount) || 0) / props.team.capacity) * 100))
    : 0,
);
const tags = computed(() =>
  [props.team.platform, props.team.server, props.team.voice, props.team.rankReq].filter(
    (value) => value && value !== '不限',
  ),
);
const emit = defineEmits<{ open: [detail: { id: string; gameName: string }] }>();
function onTap() {
  const team = props.team || {};
  const id = usableTeamId(props.teamId || team.id || team._id);
  if (id) emit('open', { id, gameName: team.gameName || '' });
}
</script>
<template>
  <view
    class="tap-feedback"
    role="button"
    :aria-label="'查看队伍：' + (team.gameName || '组队')"
    @tap="onTap"
  >
    <wd-card
      :custom-class="'!mx-0 !mb-3 room-card ' + (view.recruitment === 'closed' ? 'room-inactive' : '')"
    >
      <template #title>
        <view class="flex items-start justify-between gap-3 w-full min-w-0">
          <view class="min-w-0 flex-1">
            <view class="text-lg font-semibold break-words line-clamp-2">{{ team.gameName || '组队' }}</view>
            <view v-if="mark || view.timeLabel" class="flex flex-wrap items-center gap-2 mt-1">
              <text v-if="mark" class="text-xs text-brand">{{ mark }}</text>
              <text v-if="view.timeLabel" class="hint">{{ view.timeLabel }}</text>
            </view>
          </view>
          <text
            class="room-status"
            :class="
              view.tone === 'open'
                ? 'bg-success-soft text-success'
                : view.tone === 'full'
                  ? 'bg-brand-light text-brand'
                  : 'bg-surface-muted text-secondary'
            "
            >{{ view.statusLabel }}</text
          >
        </view>
      </template>
      <view class="room-meta flex items-start gap-2 mb-3"
        ><wd-icon name="time-line" size="16px" /><text class="min-w-0 flex-1">{{
          team.timeText || '时间待确认'
        }}</text></view
      >
      <view v-if="tags.length" class="flex flex-wrap gap-2 mb-3 max-h-[60px] overflow-hidden">
        <text v-for="(tag, index) in tags" :key="index" class="room-tag break-words max-w-full">{{
          tag
        }}</text>
      </view>
      <view
        class="flex items-center justify-between gap-3 pt-3 border-t border-x-0 border-b-0 border-solid border-border"
      >
        <view class="flex-1 min-w-0 max-w-[150px]">
          <view class="mb-2"
            ><text class="text-lg font-semibold">{{ team.memberCount || 0 }}</text
            ><text class="text-xs text-secondary"> / {{ team.capacity || 0 }} 人已上车</text></view
          >
          <wd-progress
            custom-class="room-progress"
            :percentage="occupancy"
            :duration="0"
            :color="view.ongoing ? semantic.color.brand : semantic.color.muted"
            hide-text
          />
        </view>
        <view class="min-h-[44px] flex items-center text-sm font-medium text-brand"
          >查看队伍 <wd-icon name="arrow-right" size="14px" custom-class="!ml-1"
        /></view>
      </view>
    </wd-card>
  </view>
</template>
