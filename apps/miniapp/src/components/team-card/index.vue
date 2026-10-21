<script setup lang="ts">
defineOptions({ name: 'TeamCard' });
import { computed } from 'vue';
import { officialTeamLabel } from '../../utils/team-source';
import ReactionEffect from '../reaction-effect/index.vue';
import { prepareCardShare } from '../../utils/card-share';
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
const views = computed(() => {
  const count = Number(props.team.viewCount);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
});
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
            <text v-if="officialTeamLabel(team)" class="official-badge">{{ officialTeamLabel(team) }}</text>
            <text v-if="mark || team.mark" class="text-xs text-brand">{{ mark || team.mark }}</text>
          </view>
          <view class="shrink-0 text-right">
            <view
              class="room-occupancy"
              :aria-label="`${team.memberCount || 0}人，最多${team.capacity || 0}人`"
              >{{ team.memberCount || 0 }}<text class="text-muted">/{{ team.capacity || 0 }}</text></view
            >
            <text
              v-if="view.lifecycle === 'cancelled' || view.lifecycle === 'ended'"
              class="text-xs text-muted"
              >{{ view.statusLabel }}</text
            >
          </view>
        </view>
      </template>
      <view class="room-host-row">
        <view class="room-host">
          <wd-avatar
            v-if="team.hostNickName"
            size="small"
            shape="square"
            mode="aspectFill"
            :src="team.hostAvatarUrl || '/static/images/avatar.png'"
          />
          <text class="text-xs text-secondary truncate">{{
            team.pendingHost ? '等待首位玩家发车' : team.hostNickName || '玩家'
          }}</text>
        </view>
        <view class="room-meta">
          <wd-icon name="time-line" size="13px" />
          <text>{{ team.timeText || '时间待确认' }}</text>
        </view>
      </view>
      <view v-if="team.groupIds?.length" class="mb-2"
        ><profile-tags :user="{ groupIds: team.groupIds }" groups-only
      /></view>
      <view class="room-reactions" @tap.stop>
        <view v-for="item in reactions.REACTIONS" :key="item.id" class="reaction-slot">
          <wd-button
            size="mini"
            :custom-class="
              'room-reaction' +
              (reactions.state.summary.selected?.includes(item.id) ? ' room-reaction-active' : '')
            "
            variant="text"
            :aria-busy="reactions.state.pending"
            :aria-label="item.label + '，' + (reactions.state.summary.counts[item.id] || 0) + '人'"
            :aria-pressed="reactions.state.summary.selected?.includes(item.id)"
            @click="reactions.react(item.id)"
          >
            <view
              :key="reactions.state.effectId"
              class="reaction-symbol"
              :class="
                reactions.state.cancelPulse === item.id
                  ? 'reaction-cancel'
                  : reactions.state.pulse === item.id
                    ? 'reaction-pulse reaction-pulse-' + item.id
                    : ''
              "
            >
              <image
                v-if="item.id === 'next'"
                class="reaction-pigeon-icon"
                src="/static/images/reactions/pigeon.png"
                mode="aspectFit"
              />
              <wd-icon
                v-else
                :name="reactions.state.summary.selected?.includes(item.id) ? item.activeIcon : item.icon"
                size="16px"
              />
            </view>
            <text v-if="item.id === 'next'">{{ item.label }}</text>
            <text v-if="reactions.state.summary.counts[item.id]" class="reaction-count">{{
              (reactions.state.summary.counts[item.id] || 0) > 99
                ? '99+'
                : reactions.state.summary.counts[item.id]
            }}</text>
          </wd-button>
          <reaction-effect
            v-if="reactions.state.pulse === item.id"
            :key="reactions.state.effectId"
            :kind="item.id"
          />
        </view>
        <view class="room-visitors" :aria-label="views + '次浏览'">
          <wd-icon name="eye" size="14px" /> {{ views }}
        </view>
        <wd-button
          size="mini"
          variant="text"
          open-type="share"
          :button-id="'team-forward-' + (teamId || team.id || team._id)"
          custom-class="room-forward"
          @click="prepareCardShare(team, teamId)"
          ><wd-icon name="share-external" size="15px" /> 转发</wd-button
        >
      </view>
    </wd-card>
  </view>
</template>

<style scoped>
.official-badge {
  display: inline-block;
  margin-top: 5px;
  padding: 2px 6px;
  border-radius: 5px;
  color: #6255e7;
  background: #f0edff;
  font-size: 10px;
  font-weight: 600;
}
.room-occupancy {
  font-size: 18px;
  line-height: 24px;
  font-weight: 600;
  color: #6255e7;
  white-space: nowrap;
}
.room-host-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 6px 0 10px;
}
.room-host {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}
.room-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  flex-shrink: 0;
  font-size: 11px;
  color: #687085;
  white-space: nowrap;
}
.room-reactions :deep(.room-forward.wd-button) {
  min-width: 0;
  width: 100%;
  height: 44px;
  padding: 0;
  font-size: 11px;
  white-space: nowrap;
}
.room-visitors {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  height: 44px;
  line-height: 18px;
  font-size: 10px;
  color: #9295a5;
  white-space: nowrap;
}
.reaction-count {
  margin-left: 2px;
  font-size: 10px;
}
.reaction-slot {
  display: flex;
  align-items: center;
  position: relative;
  min-width: 0;
}
.room-reactions {
  grid-template-columns: repeat(3, minmax(0, 0.7fr)) minmax(0, 1.8fr) minmax(0, 0.75fr) minmax(0, 1.05fr);
  align-items: center;
}
.room-reactions :deep(.room-reaction.wd-button) {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0;
  line-height: 18px;
  font-size: 11px;
}
.room-reactions :deep(.wd-button__content),
.room-reactions :deep(.wd-button__text) {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  white-space: nowrap;
  line-height: 18px;
}
.reaction-pigeon-icon {
  width: 18px;
  height: 18px;
}
.reaction-symbol {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  line-height: 1;
}
.room-reactions :deep(.wd-icon) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  vertical-align: middle;
}
</style>
