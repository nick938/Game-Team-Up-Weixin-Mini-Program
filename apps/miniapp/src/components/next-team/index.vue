<script setup lang="ts">
defineOptions({ name: 'NextTeam' });
import type { Team } from '../../types/domain';
import { useTeamPresentation } from '../../composables/useTeamPresentation';
const props = defineProps<{ team: Team }>();
const emit = defineEmits<{ open: [detail: { id: string; gameName: string }]; refresh: [] }>();
const view = useTeamPresentation(
  () => props.team,
  null,
  () => emit('refresh'),
);
</script>
<template>
  <wd-card v-if="view.ongoing" custom-class="!mx-0 !mb-3 next-team-card">
    <view class="flex items-center justify-between gap-2">
      <view class="min-w-0 flex-1"
        ><view class="text-sm font-semibold text-ink truncate"
          >{{ view.lifecycle === 'active' ? '正在开局' : '下一局' }} · {{ team.gameName }}</view
        ><view class="hint mt-1 truncate"
          >{{ team.timeText }} · {{ team.memberCount }}/{{ team.capacity }} 人</view
        ></view
      >
      <wd-button
        variant="text"
        size="small"
        @click="emit('open', { id: team.id || team._id, gameName: team.gameName })"
        >回到队伍</wd-button
      >
    </view>
  </wd-card>
</template>
