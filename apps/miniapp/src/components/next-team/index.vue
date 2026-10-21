<script setup lang="ts">
defineOptions({ name: 'NextTeam' });
import type { Team } from '../../types/domain';
import { useTeamPresentation } from '../../composables/useTeamPresentation';
const props = defineProps<{ team: Team; highlighted?: boolean }>();
const emit = defineEmits<{ open: [detail: { id: string; gameName: string }]; refresh: [] }>();
const view = useTeamPresentation(
  () => props.team,
  null,
  () => emit('refresh'),
);
</script>
<template>
  <wd-card
    v-if="view.ongoing"
    :custom-class="'!mx-0 !mb-3 next-team-card' + (highlighted ? ' mine-next-team' : '')"
  >
    <view class="flex items-center justify-between gap-2">
      <view class="min-w-0 flex-1"
        ><view class="text-sm font-semibold text-ink truncate"
          >{{
            team.mark === '我发起的' && view.recruitment === 'open'
              ? '我正在招队友'
              : view.lifecycle === 'active'
                ? '正在开局'
                : '下一局'
          }}
          · {{ team.gameName }}</view
        ><view class="hint mt-1 truncate"
          >{{ team.timeText }} · {{ team.memberCount }}/{{ team.capacity }} 人</view
        ></view
      >
      <wd-button
        :variant="highlighted ? 'soft' : 'text'"
        size="small"
        @click="emit('open', { id: team.id || team._id, gameName: team.gameName })"
        >回到队伍</wd-button
      >
    </view>
  </wd-card>
</template>

<style scoped>
:deep(.mine-next-team.wd-card) {
  border-color: var(--app-brand-light);
  --wot-card-bg: #f5f3ff;
  box-shadow: none;
  --wot-card-content-padding: 14px;
}
</style>
