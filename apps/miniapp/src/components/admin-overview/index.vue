<script setup lang="ts">
defineOptions({ name: 'AdminOverview' });
import { computed } from 'vue';
import type { AdminStats } from '../../types/domain';
const props = defineProps<{ stats: AdminStats }>();
const counters = computed(() => [
  ['累计组队', props.stats.teams.total],
  ['进行中', props.stats.teams.active],
  ['缺人中', props.stats.teams.recruiting],
  ['满员中', props.stats.teams.full],
  ['用户数', props.stats.users.total],
  ['当前成员记录（含车头）', props.stats.members.total],
  ['待处理举报/报错', props.stats.reports.open],
  ['待处理反馈', props.stats.feedback.open],
]);
</script>
<template>
  <view class="grid grid-cols-2 gap-3 mb-5"
    ><view v-for="[label, value] in counters" :key="String(label)" class="panel !mb-0"
      ><view class="text-2xl font-bold text-brand">{{ value }}</view
      ><view class="hint mt-2">{{ label }}</view></view
    ></view
  >
  <wd-card v-if="stats.funnel" title="近 7 天组队效果" custom-class="!mx-0 !mb-4">
    <view class="grid grid-cols-2 gap-4 mb-4">
      <view
        v-for="[label, value] in [
          ['发布队伍', stats.funnel.published],
          ['目前有队员加入', stats.funnel.withMembers],
          ['目前已满员', stats.funnel.full],
          ['分享入口访客', stats.funnel.shareVisitors],
          ['分享访客中有加入记录', stats.funnel.shareJoined],
          ['复制加入方式', stats.funnel.roomCopies],
        ]"
        :key="String(label)"
        ><view class="text-xl font-semibold">{{ value }}</view
        ><view class="hint mt-1">{{ label }}</view></view
      >
    </view>
    <view class="hint leading-5"
      >队伍指标按近 7
      天发布队伍的当前人数统计，退出会改变结果。分享访客及其加入记录按用户与队伍去重，仅代表记录关联；复制按用户、队伍、日期去重，不能代表实际进入游戏。行为数据从本版本部署后开始积累。</view
    >
  </wd-card>
  <wd-card title="最活跃的游戏" custom-class="!mx-0 !mb-4"
    ><view class="hint mb-3">按进行中场次、总场次与当前成员记录综合排序</view
    ><wd-empty v-if="!stats.topGames.length" tip="还没有数据" /><view
      v-for="game in stats.topGames"
      :key="game.gameName"
      class="mb-4"
      ><view class="text-sm mb-2"
        >{{ game.gameName }} · {{ game.active }} 进行中 · 共 {{ game.teams }} 场</view
      ><wd-progress :percentage="game.pct || 0" /></view
  ></wd-card>
  <wd-card title="平台分布" custom-class="!mx-0 !mb-4"
    ><wd-empty v-if="!stats.platforms.length" tip="还没有数据" /><view
      v-for="platform in stats.platforms"
      :key="platform.platform"
      class="mb-4"
      ><view class="text-sm mb-2">{{ platform.platform }} · {{ platform.count }}</view
      ><wd-progress :percentage="platform.pct || 0" /></view
  ></wd-card>
  <wd-card title="近 7 天发车" custom-class="!mx-0 !mb-4"
    ><view v-for="day in stats.trend" :key="day.date" class="mb-4"
      ><view class="text-sm mb-2">{{ day.date }} · {{ day.count }} 趟</view
      ><wd-progress :percentage="day.pct || 0" /></view
  ></wd-card>
</template>
