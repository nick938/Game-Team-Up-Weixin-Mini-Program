<script setup lang="ts">
defineOptions({ name: 'TeamCard' });
import { computed } from 'vue';
import type { Team } from '../../types/domain';
import { usableTeamId } from '../../utils/team-entry';
import { useTeamPresentation } from '../../composables/useTeamPresentation';
import { useCardReactions } from '../../composables/useCardReactions';
const props = withDefaults(
  defineProps<{ team?: Partial<Team>; teamId?: string; mark?: string; sequence?: number }>(),
  { team: () => ({}), teamId: '', mark: '', sequence: -1 },
);
const view = useTeamPresentation(() => props.team);
const reactions = useCardReactions(() => props.team);
const conditions = computed(() =>
  [
    ...new Set(
      [props.team.server, props.team.rankReq, props.team.voice].filter((value) => value && value !== '不限'),
    ),
  ].join(' · '),
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
    :class="sequence >= 0 && sequence < 4 ? 'room-enter' : ''"
    :style="sequence >= 0 && sequence < 4 ? { animationDelay: sequence * 30 + 'ms' } : undefined"
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
            <view class="text-base font-semibold leading-6 break-words line-clamp-2">{{
              team.gameName || '组队'
            }}</view>
            <text v-if="mark || team.mark" class="text-xs text-brand">{{ mark || team.mark }}</text>
          </view>
          <view class="shrink-0 text-right">
            <view class="text-base font-semibold leading-6"
              >{{ team.memberCount || 0
              }}<text class="text-xs text-secondary font-normal"> / {{ team.capacity || 0 }} 人</text></view
            >
            <text
              class="room-status room-status-compact"
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
        </view>
      </template>
      <view class="room-meta flex items-start gap-2 mb-2">
        <wd-icon name="time-line" size="14px" />
        <text class="min-w-0 flex-1 text-xs leading-5"
          >{{ view.timeLabel ? view.timeLabel + ' · ' : '' }}{{ team.timeText || '时间待确认' }}</text
        >
        <text v-if="team.platform" class="room-tag shrink-0">{{ team.platform }}</text>
      </view>
      <view v-if="team.hostNickName || conditions" class="flex items-center gap-2 mb-2 min-w-0">
        <app-avatar
          v-if="team.hostNickName"
          size="compact"
          :src="team.hostAvatarUrl"
          :identity="'host:' + (team.id || team._id)"
        />
        <text
          v-if="team.hostNickName"
          class="text-xs text-secondary truncate max-w-[35%]"
          :aria-label="team.hostNickName + ' 发起'"
          >{{ team.hostNickName }}</text
        >
        <text
          v-if="conditions"
          class="text-xs text-secondary truncate min-w-0 flex-1 text-right"
          :aria-label="conditions"
          >{{ conditions }}</text
        >
      </view>
      <view class="room-reactions" @tap.stop>
        <wd-button
          v-for="item in reactions.REACTIONS"
          :key="item.id"
          size="mini"
          :custom-class="
            'room-reaction' + (reactions.state.summary.mine === item.id ? ' room-reaction-active' : '')
          "
          variant="text"
          :disabled="reactions.state.pending"
          :aria-label="item.label + '，' + reactions.state.summary.counts[item.id] + '人'"
          :aria-pressed="reactions.state.summary.mine === item.id"
          @click="reactions.react(item.id)"
        >
          <view class="reaction-symbol" :class="reactions.state.pulse === item.id ? 'reaction-pulse' : ''">
            <wd-icon
              :name="reactions.state.summary.mine === item.id ? item.activeIcon : item.icon"
              size="19px"
            />
          </view>
          <text>{{
            reactions.state.summary.counts[item.id] > 99 ? '99+' : reactions.state.summary.counts[item.id]
          }}</text>
        </wd-button>
      </view>
    </wd-card>
  </view>
</template>
