<script setup lang="ts">
defineOptions({ name: 'TeamFilters' });
import { computed, reactive, ref, watch } from 'vue';
import type { TeamSearch } from '../../types/domain';
import { GROUP_OPTIONS } from '../../utils/profile-options';
import { PLATFORMS, VOICES } from '../../utils/constants';
import { useTabBarOverlay } from '../../composables/useTabBarOverlay';
import { useAppTheme } from '../../composables/useAppTheme';
useAppTheme();
const props = defineProps<{
  query: TeamSearch;
  active?: boolean;
  gameOptions?: { label: string; value: string }[];
}>();
const emit = defineEmits<{ change: [patch: Partial<TeamSearch>] }>();
const expanded = ref(false);
const showGame = ref(false);
useTabBarOverlay(showGame);
watch(
  () => props.active,
  (value) => {
    if (value === false) {
      expanded.value = false;
      showGame.value = false;
    }
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
const count = computed(
  () =>
    [
      ...(props.gameOptions ? [props.query.gameName] : []),
      props.query.time,
      props.query.platform,
      props.query.server,
      props.query.voice,
      props.query.availableOnly,
      !!props.query.groupIds?.length,
    ].filter(Boolean).length,
);
function open() {
  Object.assign(draft, props.query);
  expanded.value = true;
}
function reset() {
  Object.assign(draft, {
    ...(props.gameOptions ? { gameName: '' } : {}),
    groupIds: [],
    time: '',
    platform: '',
    server: '',
    voice: '',
    availableOnly: false,
  });
}
function apply() {
  emit('change', {
    ...(props.gameOptions ? { gameName: draft.gameName || '' } : {}),
    groupIds: [...(draft.groupIds || [])],
    time: draft.time,
    platform: draft.platform,
    server: draft.server,
    voice: draft.voice,
    availableOnly: draft.availableOnly,
  });
  expanded.value = false;
}
</script>
<template>
  <slot name="toolbar" :open="open" :count="count">
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
      <slot name="actions" />
    </view>
  </slot>
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
        <wd-cell
          v-if="gameOptions"
          title="游戏"
          :value="gameOptions.find((item) => item.value === (draft.gameName || ''))?.label || '全部游戏'"
          is-link
          @click="showGame = true"
        />
        <app-multi-select
          v-model="draft.groupIds"
          label="群组标识"
          :columns="GROUP_OPTIONS"
          :active="expanded && active !== false"
          placeholder="不限群组，可多选"
        />
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
      </wd-cell-group>
      <view class="flex gap-3 mt-6"
        ><wd-button variant="text" @click="reset">重置</wd-button
        ><view class="flex-1"><wd-button block @click="apply">查看队伍</wd-button></view></view
      >
    </view>
  </wd-popup>
  <wd-select-picker
    v-if="gameOptions"
    v-model:visible="showGame"
    :model-value="draft.gameName || ''"
    :columns="gameOptions"
    title="选择游戏"
    type="radio"
    :show-confirm="false"
    filterable
    filter-placeholder="搜索游戏"
    root-portal
    :z-index="1200"
    @confirm="draft.gameName = String($event.value)"
  />
</template>
