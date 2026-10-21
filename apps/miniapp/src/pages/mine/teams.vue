<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useMine } from '../../composables/useMine';
import { usePageActive } from '../../composables/usePageActive';
import { useAppTheme } from '../../composables/useAppTheme';
import { uniqueMyTeams } from '../../utils/my-teams';
import MineTeamCard from '../../components/mine-team-card/index.vue';
defineOptions({ name: 'MineTeamsPage' });
useAppTheme();
const pageActive = usePageActive('pages/mine/teams');
const page = reactive(useMine());
const tab = ref('hosted');
onLoad((options = {}) => {
  tab.value = ['hosted', 'joined', 'all'].includes(String(options.tab)) ? String(options.tab) : 'hosted';
  page.pickPhase(options.phase === 'Past' ? 'Past' : 'Ongoing');
});
const lists = computed(() => [
  { key: 'hosted-Ongoing', teams: page.hostedOngoing },
  { key: 'hosted-Past', teams: page.hostedPast },
  { key: 'joined-Ongoing', teams: page.joinedOngoing },
  { key: 'joined-Past', teams: page.joinedPast },
  {
    key: 'all-Ongoing',
    teams: uniqueMyTeams(page.hostedOngoing, page.joinedOngoing).sort((a, b) => a.startAt - b.startAt),
  },
  {
    key: 'all-Past',
    teams: uniqueMyTeams(page.hostedPast, page.joinedPast).sort((a, b) => b.startAt - a.startAt),
  },
]);
const activeList = computed(() => `${tab.value}-${page.phase}`);
const visibleTeams = computed(() => lists.value.find((list) => list.key === activeList.value)?.teams || []);
const hostedIds = computed(
  () => new Set([...page.hostedOngoing, ...page.hostedPast].map((team) => team.id || team._id)),
);
const visitedLists = reactive<Record<string, boolean>>({});
watch(
  activeList,
  (key) => {
    visitedLists[key] = true;
  },
  { immediate: true },
);
</script>
<template>
  <timeline-preview v-if="page.singlePage" />
  <app-shell v-else :active="pageActive" variant="profile">
    <view class="record-tabs">
      <wd-tabs :model-value="tab" line-theme="text" @change="tab = String($event.name)">
        <wd-tab name="all" title="全部" />
        <wd-tab name="hosted" :title="'我发起的 ' + page.hostedCount" />
        <wd-tab name="joined" :title="'我加入的 ' + page.joinedCount" />
      </wd-tabs>
    </view>
    <wd-segmented
      :value="page.phase"
      :options="[
        { value: 'Ongoing', payload: { label: '未结束' } },
        { value: 'Past', payload: { label: '历史记录' } },
      ]"
      custom-class="record-phase !flex !w-full !mb-4"
      @change="page.pickPhase(String($event.value))"
    >
      <template #label="{ option }">{{ option.payload.label }}</template>
    </wd-segmented>
    <view v-if="page.state.listError" class="panel">
      <view class="hint mb-2">{{ page.state.listError }}</view>
      <wd-button variant="soft" :loading="page.state.loading" @click="page.load()">重新加载</wd-button>
    </view>
    <view v-if="page.state.loading && !visibleTeams.length" class="panel" aria-label="正在加载队伍">
      <wd-skeleton
        animation="gradient"
        :row-col="[
          { width: '160px', height: '24px' },
          { width: '100%', height: '16px' },
        ]"
      />
    </view>
    <template v-for="list in lists" :key="list.key">
      <view v-if="visitedLists[list.key]" v-show="activeList === list.key">
        <mine-team-card
          v-for="team in list.teams"
          :key="team.id || team._id"
          :team="team"
          :hosted="hostedIds.has(team.id || team._id)"
          @open="page.onOpen"
        />
      </view>
    </template>
    <view v-if="!visibleTeams.length && !page.state.loading && !page.state.listError" class="empty-state">
      <wd-empty
        icon="empty"
        :icon-size="58"
        :tip="page.phase === 'Past' ? '还没有历史记录' : '还没有未结束的队伍'"
      />
      <view class="hint mb-2">{{
        page.phase === 'Past' ? '结束的队伍会保存在这里' : '约好时间，和队友一起出发'
      }}</view>
      <wd-button v-if="page.phase === 'Ongoing'" variant="text" @click="page.goPlaza"
        >去大厅看看 <wd-icon name="arrow-right" size="14px"
      /></wd-button>
    </view>
  </app-shell>
</template>
<style scoped>
.record-tabs {
  margin-bottom: 12px;
  --wot-tabs-nav-item-font-size: 13px;
  --wot-tabs-nav-item-padding: 10px 6px;
}
:deep(.record-phase) {
  --wot-segmented-padding: 3px;
  --wot-segmented-item-padding: 5px 12px;
  --wot-segmented-item-font-size: 13px;
}
</style>
