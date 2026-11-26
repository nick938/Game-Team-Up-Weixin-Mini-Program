<script setup lang="ts">
defineOptions({ name: 'TeamCard' });
import { computed, onScopeDispose, ref } from 'vue';
import { officialTeamLabel } from '../../utils/team-source';
import ReactionEffect from '../reaction-effect/index.vue';
import { registerCardShare } from '../../utils/card-share';
import type { Team } from '../../types/domain';
import { usableTeamId } from '../../utils/team-entry';
import { useTeamPresentation } from '../../composables/useTeamPresentation';
import { useCardReactions } from '../../composables/useCardReactions';
import { usePageFeedback } from '../../composables/usePageFeedback';
import type { ReactionId } from '../../utils/reactions';
import { groupLabels } from '../../utils/profile-options';
const props = withDefaults(
  defineProps<{
    team?: Partial<Team>;
    teamId?: string;
    mark?: string;
    sequence?: number;
    compact?: boolean;
  }>(),
  { team: () => ({}), teamId: '', mark: '', sequence: -1, compact: false },
);
const teamId = computed(() => usableTeamId(props.teamId || props.team.id || props.team._id));
const groups = computed(() => groupLabels(props.team.groupIds));
const latestShare = ref({ id: '', count: 0 });
const cardShare = registerCardShare(
  () => props.team,
  () => props.teamId,
  (id, count) => {
    if (teamId.value === id && (latestShare.value.id !== id || latestShare.value.count < count))
      latestShare.value = { id, count };
  },
);
onScopeDispose(cardShare.dispose);
const view = useTeamPresentation(() => props.team);
const reactions = useCardReactions(() => props.team);
const { toast } = usePageFeedback();
let nextHintAt = 0;
function showReactionHint(id: ReactionId) {
  if (id !== 'next') return;
  nextHintAt = Date.now();
  toast.show('下次一定 · 这次来不了，下次一起玩');
}
function react(id: ReactionId) {
  if (id === 'next' && Date.now() - nextHintAt < 500) return;
  const before = reactions.state.summary.mine;
  reactions.react(id);
  const after = reactions.state.summary.mine;
  if (id === 'next' && before !== after)
    toast.show(after === 'next' ? '已标记「下次一定」' : '已取消「下次一定」');
}
const views = computed(() => {
  const count = Number(props.team.viewCount);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
});
const forwards = computed(() => {
  const stored = Number(props.team.shareCount);
  const count = Number.isSafeInteger(stored) && stored >= 0 ? stored : 0;
  return latestShare.value.id === teamId.value ? Math.max(count, latestShare.value.count) : count;
});
const emit = defineEmits<{ open: [detail: { id: string; gameName: string }] }>();
function onTap() {
  const team = props.team || {};
  const id = teamId.value;
  if (id) emit('open', { id, gameName: team.gameName || '' });
}
</script>
<template>
  <view
    class="tap-feedback"
    :class="{ 'room-enter': sequence >= 0 && sequence < 4, 'room-compact': compact }"
    :style="sequence >= 0 && sequence < 4 ? { animationDelay: sequence * 30 + 'ms' } : undefined"
    role="button"
    :aria-label="
      '查看队伍：' +
      (team.gameName || '组队') +
      (!compact && groups.length ? '，群组：' + groups.join('、') : '')
    "
    @tap="onTap"
  >
    <wd-card
      :custom-class="'!mx-0 !mb-3 room-card ' + (view.recruitment === 'closed' ? 'room-inactive' : '')"
    >
      <template #title>
        <view class="flex items-start justify-between gap-2 w-full min-w-0">
          <view class="min-w-0 flex-1">
            <view class="room-card-heading">
              <view class="room-card-title text-base font-semibold leading-6 break-words line-clamp-2">
                {{ team.gameName || '组队' }}
              </view>
              <view v-if="!compact && groups.length" class="room-group-mark" aria-hidden="true">
                <text class="room-group-name">{{ groups[0] }}</text>
                <text v-if="groups.length > 1" class="room-group-extra">+{{ groups.length - 1 }}</text>
              </view>
            </view>
            <text v-if="officialTeamLabel(team)" class="official-badge">{{ officialTeamLabel(team) }}</text>
            <text v-if="mark || team.mark" class="text-xs text-brand">{{ mark || team.mark }}</text>
          </view>
          <view class="shrink-0 text-right">
            <view
              class="room-occupancy"
              :aria-label="`${team.memberCount || 0}人，最多${team.capacity || 0}人`"
            >
              {{ team.memberCount || 0 }}<text class="text-muted">/{{ team.capacity || 0 }}</text>
            </view>
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
      <view class="room-reactions" @tap.stop>
        <view
          v-for="item in reactions.REACTIONS"
          :key="item.id"
          class="reaction-slot"
          @longpress.stop="showReactionHint(item.id)"
        >
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
            @click="react(item.id)"
          >
            <view class="reaction-button-content">
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
                  :src="
                    reactions.state.summary.selected?.includes(item.id)
                      ? '/static/images/reactions/pigeon.png'
                      : '/static/images/reactions/pigeon-outline.png'
                  "
                  mode="aspectFit"
                />
                <wd-icon
                  v-else
                  :name="reactions.state.summary.selected?.includes(item.id) ? item.activeIcon : item.icon"
                  size="16px"
                />
              </view>
              <text v-if="reactions.state.summary.counts[item.id]" class="reaction-count">{{
                (reactions.state.summary.counts[item.id] || 0) > 99
                  ? '99+'
                  : reactions.state.summary.counts[item.id]
              }}</text>
            </view>
          </wd-button>
          <reaction-effect
            v-if="reactions.state.pulse === item.id"
            :key="reactions.state.effectId"
            :kind="item.id"
          />
        </view>
        <view class="room-visitors" :aria-label="views + '次浏览'">
          <wd-icon name="eye" size="14px" /> {{ compact && views > 999 ? '999+' : views }}
        </view>
        <!-- Native share data must reach onShareAppMessage across component boundaries. -->
        <button
          open-type="share"
          :id="cardShare.buttonId"
          :data-card-share-id="cardShare.buttonId"
          :aria-label="'发起转发 ' + forwards + ' 次，转发队伍'"
          class="room-forward"
          @tap.stop
        >
          <view class="reaction-button-content">
            <wd-icon name="share-external" size="15px" /><text v-if="!compact">转发</text>
            <text class="reaction-count">{{ forwards > 999 ? '999+' : forwards }}</text>
          </view>
        </button>
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
  color: var(--app-brand);
  background: var(--app-brand-light);
  font-size: 10px;
  font-weight: 600;
}
.room-occupancy {
  font-size: 18px;
  line-height: 24px;
  font-weight: 600;
  color: var(--app-brand);
  white-space: nowrap;
}
.room-card-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}
.room-card-title {
  min-width: 0;
  max-width: 100%;
}
.room-group-mark {
  display: flex;
  gap: 3px;
  min-width: 0;
  max-width: 100%;
  height: 20px;
  margin-left: auto;
  padding: 0 5px;
  box-sizing: border-box;
  align-items: center;
  border-radius: 6px;
  background: var(--app-brand-light);
  color: var(--app-brand-pressed);
  font-size: 10px;
  line-height: 16px;
}
.room-group-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.room-group-extra {
  flex-shrink: 0;
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
  color: var(--app-secondary);
  white-space: nowrap;
}
.room-forward {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--app-brand);
  font-weight: 400;
  line-height: 18px;
  min-width: 0;
  width: 100%;
  height: 44px;
  padding: 0;
  font-size: 11px;
  white-space: nowrap;
}
.room-forward::after {
  border: 0;
}
.room-visitors {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  height: 44px;
  line-height: 18px;
  font-size: 10px;
  color: var(--app-muted);
  white-space: nowrap;
}
.reaction-count {
  flex-shrink: 0;
  font-size: 10px;
}
.reaction-slot {
  display: flex;
  align-items: center;
  position: relative;
  min-width: 0;
}
.room-reactions {
  grid-template-columns: repeat(4, minmax(0, 1fr)) minmax(0, 1.15fr) minmax(0, 1.82fr);
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
.reaction-button-content {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 3px;
  height: 44px;
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
  margin-right: 0;
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
.room-compact :deep(.room-card.wd-card) {
  --wot-card-title-padding: 9px 8px 5px;
  --wot-card-content-padding: 0 8px 7px;
}
.room-compact .room-host-row {
  align-items: flex-start;
  flex-direction: column;
  gap: 4px;
  margin: 4px 0 7px;
}
.room-compact .room-host {
  max-width: 100%;
}
.room-compact .room-meta {
  justify-content: flex-start;
  white-space: normal;
}
.room-compact .room-reactions {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding-top: 3px;
}
.room-compact .room-card-title {
  font-size: 14px;
  line-height: 20px;
}
.room-compact .room-occupancy {
  font-size: 15px;
  line-height: 20px;
}
</style>
