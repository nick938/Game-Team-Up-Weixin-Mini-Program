<script setup lang="ts">
import { usePageActive } from '../../composables/usePageActive';
const pageActive = usePageActive('pages/index/index');
import { reactive, computed } from 'vue';
import { useAppTheme } from '../../composables/useAppTheme';
import { useLobby } from '../../composables/useLobby';
import TeamFilters from '../../components/team-filters/index.vue';
import TeamResults from '../../components/team-results/index.vue';
import NextTeam from '../../components/next-team/index.vue';
defineOptions({ name: 'IndexIndexPage' });
useAppTheme();
const page = reactive(useLobby());
const gameTabs = computed(() => [
  ...new Set(['全部', ...page.recent, ...page.featured.map((game) => game.name), ...page.games]),
]);
</script>
<template>
  <timeline-preview v-if="page.singlePage" />
  <app-shell :active="pageActive" v-else variant="lobby">
    <lobby-hero />
    <wd-search
      :model-value="page.keyword"
      placeholder="搜索游戏、区服、玩法"
      hide-cancel
      @update:model-value="page.onSearch(String($event))"
      @clear="page.clearSearch"
    />
    <view class="mt-3 mb-2"
      ><wd-tabs
        :model-value="page.gameFilter"
        slidable="always"
        :map-num="99"
        line-theme="text"
        @change="page.pickGame(String($event.name))"
        ><wd-tab v-for="name in gameTabs" :key="name" :name="name" :title="name" /></wd-tabs
    ></view>
    <next-team v-if="page.nextTeam" :team="page.nextTeam" @open="page.onOpen" @refresh="page.loadUpcoming" />
    <view v-if="page.gameFilter !== '全部'" class="text-right"
      ><wd-button variant="text" size="small" @click="page.goGame(page.gameFilter)"
        >{{ page.gameFilter }} 专区 <wd-icon name="arrow-right" size="12px" /></wd-button
    ></view>
    <team-filters :active="pageActive" :query="page.query()" @change="page.setFilters" />
    <team-results
      :teams="page.filtered"
      :total="page.total"
      :loading="page.loading"
      :loading-more="page.loadingMore"
      :has-more="page.hasMore"
      :error="page.listError"
      @open="page.onOpen"
      @retry="page.loadList()"
      @more="page.loadMore"
      @clear="page.clearFilters"
      @publish="page.goPublish"
    />
    <welcome-letter />
  </app-shell>
</template>
