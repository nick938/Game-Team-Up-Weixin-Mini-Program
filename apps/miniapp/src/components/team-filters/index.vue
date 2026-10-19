<script setup lang="ts">
defineOptions({ name: 'TeamFilters' });
import { computed, reactive, ref, watch } from 'vue';
import type { TeamSearch } from '../../types/domain';
import { PLATFORMS, VOICES } from '../../utils/constants';
import { useTabBarOverlay } from '../../composables/useTabBarOverlay';
import { useAppTheme } from '../../composables/useAppTheme';
useAppTheme();
const props = defineProps<{ query: TeamSearch; sourceGroups: string[]; active?: boolean }>();
const emit = defineEmits<{ change: [patch: Partial<TeamSearch>] }>();
const expanded = ref(false);
watch(
  () => props.active,
  (value) => {
    if (value === false) expanded.value = false;
  },
);
const { afterLeave } = useTabBarOverlay(expanded, { waitForAfterLeave: true });
const draft = reactive<TeamSearch>({});
const sorts = [
  { value: 'latest', payload: { label: '最新发布' } },
  { value: 'start', payload: { label: '最早开局' } },
  { value: 'hot', payload: { label: '人数最多' } },
];
const times = [
  { label: '不限时间', value: '' },
  { label: '现在可玩', value: 'now' },
  { label: '一小时内', value: 'soon' },
  { label: '今天开局', value: 'today' },
];
const groupOptions = computed(() => [
  { label: '全部来源群', value: '' },
  { label: '未标注群', value: '__ungrouped__' },
  ...[
    ...new Set([
      ...props.sourceGroups,
      ...(draft.sourceGroup?.startsWith('group:') ? [draft.sourceGroup.slice(6)] : []),
    ]),
  ].map((name) => ({ label: name, value: 'group:' + name })),
]);
const count = computed(
  () =>
    [
      props.query.time,
      props.query.platform,
      props.query.server,
      props.query.voice,
      props.query.sourceGroup,
      !props.query.availableOnly,
    ].filter(Boolean).length,
);
function open() {
  Object.assign(draft, props.query);
  expanded.value = true;
}
function reset() {
  Object.assign(draft, {
    time: '',
    platform: '',
    server: '',
    voice: '',
    sourceGroup: '',
    availableOnly: true,
  });
}
function apply() {
  emit('change', {
    time: draft.time,
    platform: draft.platform,
    server: draft.server,
    voice: draft.voice,
    sourceGroup: draft.sourceGroup,
    availableOnly: draft.availableOnly,
  });
  expanded.value = false;
}
</script>
<template>
  <view class="filter-toolbar">
    <view class="filter-sort"
      ><wd-segmented
        :value="query.sortMode || 'latest'"
        :options="sorts"
        custom-class="glass-segment !flex !w-full"
        @change="emit('change', { sortMode: String($event.value) })"
        ><template #label="{ option }">{{ option.payload.label }}</template></wd-segmented
      ></view
    >
    <wd-button size="small" variant="text" custom-class="!px-1 !text-secondary" @click="open"
      ><wd-icon name="filter" size="17px" /> 筛选{{ count ? ' · ' + count : '' }}</wd-button
    >
  </view>
  <wd-popup
    v-model="expanded"
    root-portal
    position="bottom"
    :z-index="1100"
    closable
    @after-leave="afterLeave"
  >
    <view class="filter-sheet"
      ><view class="sheet-heading mb-5">找到合适的局</view>
      <wd-cell-group
        ><wd-cell title="只看可加入" label="关闭后也能查看满员队伍"
          ><wd-switch v-model="draft.availableOnly"
        /></wd-cell>
        <app-picker label="开局时间" v-model="draft.time" :columns="times" />
        <app-picker
          label="游戏平台"
          v-model="draft.platform"
          :columns="[
            { label: '全部平台', value: '' },
            ...PLATFORMS.map((value) => ({ label: value, value })),
          ]"
        />
        <app-input label="区服" v-model="draft.server" placeholder="不限区服" :maxlength="20" />
        <app-picker
          label="语音"
          v-model="draft.voice"
          :columns="[{ label: '全部语音', value: '' }, ...VOICES.map((value) => ({ label: value, value }))]"
        />
        <app-picker label="来源群" v-model="draft.sourceGroup" :columns="groupOptions" />
      </wd-cell-group>
      <view class="flex gap-3 mt-6"
        ><wd-button variant="text" @click="reset">重置</wd-button
        ><view class="flex-1"><wd-button block @click="apply">查看队伍</wd-button></view></view
      >
    </view>
  </wd-popup>
</template>
