<script setup lang="ts">
import { usePageActive } from '../../composables/usePageActive';
const pageActive = usePageActive('pages/index/index');
import { reactive, ref, watch } from 'vue';
import { useAppTheme } from '../../composables/useAppTheme';
import { useLobby } from '../../composables/useLobby';
import TeamFilters from '../../components/team-filters/index.vue';
import TeamResults from '../../components/team-results/index.vue';
import NextTeam from '../../components/next-team/index.vue';
import { useTabBarOverlay } from '../../composables/useTabBarOverlay';
defineOptions({ name: 'IndexIndexPage' });
useAppTheme();
const page = reactive(useLobby());
const showGames = ref(false);
const showSearch = ref(false);
useTabBarOverlay(showGames);
watch(pageActive, (active) => {
  if (!active) showGames.value = false;
});
</script>
<template>
  <timeline-preview v-if="page.singlePage" />
  <app-shell :active="pageActive" v-else variant="lobby">
    <lobby-hero />
    <view class="mt-3 mb-2 flex items-center gap-2"
      ><scroll-view
        scroll-x
        class="flex-1 min-w-0"
        :scroll-into-view="'quick-game-' + page.gameTabs.indexOf(page.gameFilter)"
      >
        <view class="game-quick-row">
          <view
            v-for="(name, index) in page.gameTabs"
            :id="'quick-game-' + index"
            :key="name"
            class="shrink-0"
          >
            <wd-button
              size="small"
              variant="text"
              custom-class="game-quick-tab"
              :aria-pressed="page.gameFilter === name"
              @click="page.pickGame(name)"
            >
              <text class="game-quick-label" :class="page.gameFilter === name ? 'game-quick-active' : ''">{{
                name
              }}</text>
            </wd-button>
          </view>
        </view>
      </scroll-view>
      <wd-button size="small" variant="text" custom-class="!px-1 shrink-0" @click="showGames = true"
        >更多 <wd-icon name="arrow-down" size="12px" /></wd-button
    ></view>
    <next-team v-if="page.nextTeam" :team="page.nextTeam" @open="page.onOpen" @refresh="page.loadUpcoming" />
    <team-filters :active="pageActive" :query="page.query()" @change="page.setFilters">
      <template #actions>
        <wd-button
          size="small"
          variant="text"
          custom-class="toolbar-search"
          :aria-expanded="showSearch"
          :aria-label="page.keyword ? '搜索：' + page.keyword : '搜索队伍'"
          @click="showSearch = !showSearch"
        >
          <wd-icon name="search-line" size="18px" />
          <text v-if="page.keyword" class="search-indicator" />
        </wd-button>
      </template>
    </team-filters>
    <wd-search
      v-if="showSearch"
      custom-class="lobby-search"
      :model-value="page.keyword"
      placeholder="搜索游戏、区服、玩法"
      placeholder-left
      focus
      @update:model-value="page.onSearch(String($event))"
      @clear="page.clearSearch"
      @cancel="showSearch = false"
    />
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
    <entry-notices />
    <wd-select-picker
      v-model:visible="showGames"
      :model-value="page.gameFilter"
      :columns="page.gameOptions"
      title="选择游戏"
      type="radio"
      :show-confirm="false"
      filterable
      filter-placeholder="搜索游戏"
      root-portal
      :z-index="1200"
      @confirm="page.pickGame(String($event.value))"
    />
  </app-shell>
</template>
