<script setup lang="ts">
import type { Team } from '../../types/domain';
import { useTeamPresentation } from '../../composables/useTeamPresentation';
import { usableTeamId } from '../../utils/team-entry';
import MineAvatar from '../mine-avatar/index.vue';
defineOptions({ name: 'MineTeamCard' });
const props = defineProps<{ team: Team; hosted: boolean }>();
const view = useTeamPresentation(() => props.team);
const emit = defineEmits<{ open: [detail: { id: string; gameName: string }] }>();
function open() {
  const id = usableTeamId(props.team.id || props.team._id);
  if (id) emit('open', { id, gameName: props.team.gameName });
}
</script>
<template>
  <view class="mine-record tap-feedback" role="button" :aria-label="'查看队伍：' + team.gameName" @tap="open">
    <view class="record-heading">
      <text class="record-title">{{ team.gameName || '组队' }}</text>
      <text class="record-status" :class="{ 'record-status-active': view.ongoing }">{{
        view.lifecycle === 'cancelled' ? '已解散' : view.timeLabel || view.statusLabel
      }}</text>
    </view>
    <view class="record-time"
      ><wd-icon name="time-line" size="14px" /><text>{{ team.timeText || '时间待确认' }}</text></view
    >
    <view v-if="!hosted" class="record-host">
      <mine-avatar :src="team.hostAvatarUrl" :identity="team.hostNickName" />
      <text class="truncate">车头 · {{ team.hostNickName || '玩家' }}</text>
    </view>
    <view class="record-footer">
      <text>{{ hosted ? '我发起的' : '我加入的' }} · {{ team.memberCount }}/{{ team.capacity }} 人</text>
      <view class="record-entry" :class="{ 'record-entry-active': view.ongoing }"
        >{{ view.ongoing ? '回到队伍' : '查看详情' }}<wd-icon name="arrow-right" size="14px"
      /></view>
    </view>
  </view>
</template>
<style scoped>
.mine-record {
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid var(--app-border);
  border-radius: 16px;
  background: var(--app-surface);
}
.record-heading,
.record-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.record-heading {
  align-items: flex-start;
}
.record-title {
  min-width: 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.record-status {
  flex-shrink: 0;
  max-width: 108px;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--app-surface-muted);
  color: var(--app-muted);
  font-size: 11px;
  line-height: 18px;
}
.record-status-active {
  color: var(--app-brand);
  background: var(--app-brand-light);
}
.record-time,
.record-host {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  color: var(--app-secondary);
  font-size: 12px;
  line-height: 20px;
}
.record-host {
  gap: 8px;
  margin-top: 12px;
}
.record-footer {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--app-border);
  color: var(--app-muted);
  font-size: 12px;
  line-height: 22px;
}
.record-entry {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  color: var(--app-secondary);
}
.record-entry-active {
  color: var(--app-brand);
}
</style>
