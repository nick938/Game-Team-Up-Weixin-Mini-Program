<script setup lang="ts">
defineOptions({ name: 'TeamCard' });

import type { Team } from '../../types/domain';

import { usableTeamId } from '../../utils/team-entry';
const props = withDefaults(defineProps<{ team?: Partial<Team>; teamId?: string; mark?: string }>(), {
  team: () => ({}),
  teamId: '',
  mark: '',
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
  <view @tap="onTap"
    ><wd-card custom-class="!mx-0 !mb-4" :title="team.gameName || '组队'">
      <view class="flex flex-wrap gap-2 mb-3"
        ><wd-tag :type="team.displayStatus === 'full' ? 'success' : 'primary'">{{
          team.displayStatus === 'recruiting' && (team.needCount || 0) > 0
            ? '缺' + team.needCount + '人'
            : team.statusText
        }}</wd-tag
        ><wd-tag v-if="mark">{{ mark }}</wd-tag
        ><wd-tag v-if="team.started">进行中</wd-tag
        ><wd-tag v-else-if="team.soon" type="success">即将开始</wd-tag></view
      >
      <view class="text-sm text-muted mb-3">{{ team.timeText }}</view
      ><view class="flex flex-wrap gap-2 mb-4"
        ><wd-tag v-if="team.platform">{{ team.platform }}</wd-tag
        ><wd-tag v-if="team.voice && team.voice !== '不限'">{{ team.voice }}</wd-tag
        ><wd-tag v-if="team.server">{{ team.server }}</wd-tag
        ><wd-tag v-if="team.rankReq">{{ team.rankReq }}</wd-tag></view
      >
      <view class="flex justify-between items-center"
        ><view class="text-lg font-bold"
          >{{ team.memberCount }}<text class="hint"> / {{ team.capacity }} 人</text></view
        ><wd-button size="small" variant="soft">查看队伍</wd-button></view
      >
    </wd-card></view
  >
</template>
