<script setup lang="ts">
import { useAppTheme } from '../../composables/useAppTheme';
import { reactive, ref, computed } from 'vue';
import { useGame } from '../../composables/useGame';
import { buildLobbyView } from '../../utils/lobby';
defineOptions({ name: 'GameGamePage' });
useAppTheme();
const page = reactive(useGame());
const keyword = ref('');
const visibleTeams = computed(() =>
  buildLobbyView(page.filtered, { gameFilter: '全部', keyword: keyword.value, sortMode: page.sortMode }),
);
</script>
<template>
  <timeline-preview v-if="page.singlePage" />
  <app-shell v-else :title="page.game?.name || page.seoHeading" subtitle="约好时间，找到一起开黑的人。">
    <view class="flex flex-wrap gap-2 mb-4"
      ><text v-for="tag in page.tags" :key="tag" class="room-tag">{{ tag }}</text></view
    >
    <wd-search v-model="keyword" hide-cancel placeholder="搜索已加载队伍的区服、要求" />
    <view class="hint mt-2">仅搜索本页已加载队伍</view>
    <view class="flex flex-wrap justify-between items-center gap-3 mt-6 mb-3"
      ><view class="section-title">正在组队</view
      ><view class="sort-segment"
        ><wd-button
          v-for="sort in page.sorts"
          :key="sort.key"
          size="small"
          variant="text"
          :custom-class="page.sortMode === sort.key ? 'sort-active' : '!text-muted'"
          @click="page.pickSort(sort.key)"
          >{{ sort.label }}</wd-button
        ></view
      ></view
    >
    <view v-if="page.listError" class="panel"
      ><view class="text-sm text-secondary mb-3"
        >暂时无法加载队伍{{ page.filtered.length ? '，仍显示上次结果' : '' }}</view
      ><wd-button variant="soft" :loading="page.loading" @click="page.loadList()">重新加载</wd-button></view
    >
    <view v-if="page.loading && !page.filtered.length" class="panel"
      ><view class="skeleton-shape h-6 w-40 mb-4" /><view class="skeleton-shape h-4 w-full"
    /></view>
    <team-card
      v-for="team in visibleTeams"
      :key="team._id"
      :team="team"
      :team-id="team.id || team._id"
      @open="page.onOpen"
    />
    <view v-if="!visibleTeams.length && !page.loading && !page.listError" class="panel text-center"
      ><wd-empty
        icon="/static/images/brand/empty-v1.jpg"
        :tip="
          keyword
            ? '已加载队伍中没有匹配结果'
            : page.hasMore
              ? '暂未找到匹配队伍，试试继续加载'
              : '这款游戏还没有队伍，来发起第一局吧'
        "
      /><wd-button v-if="keyword" variant="soft" @click="keyword = ''">清空搜索</wd-button></view
    >
    <wd-button v-if="page.hasMore" block variant="text" :loading="page.loadingMore" @click="page.loadMore"
      >继续加载更多</wd-button
    >
    <view class="my-6"
      ><wd-button block @click="page.goPublish">{{
        page.game ? '发起 ' + page.game.name + ' 组队' : '发起组队'
      }}</wd-button></view
    >
    <view class="section-title mb-3">看看其他游戏</view
    ><wd-cell-group
      ><wd-cell
        v-for="game in page.others"
        :key="game.slug"
        :title="game.entryLabel"
        is-link
        @click="page.goGame(game.seoKey || game.slug)"
    /></wd-cell-group>
    <welcome-letter />
  </app-shell>
</template>
