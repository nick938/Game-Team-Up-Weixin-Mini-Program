<script setup lang="ts">
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { usePageActive } from '../../composables/usePageActive';
const pageActive = usePageActive('pages/game/game');
import AppActionDock from '../../components/app-action-dock/index.vue';
import { reactive } from 'vue';
import { useAppTheme } from '../../composables/useAppTheme';
import { useGame } from '../../composables/useGame';
import TeamFilters from '../../components/team-filters/index.vue';
import TeamResults from '../../components/team-results/index.vue';
defineOptions({ name: 'GameGamePage' });
useAppTheme();
const page = reactive(useGame());
// Keep native share hook registration in the page SFC for uni compilation.
onShareAppMessage(page.shareAppMessage);
onShareTimeline(page.shareTimeline);
</script>
<template>
  <timeline-preview v-if="page.singlePage" />
  <app-shell
    :active="pageActive"
    v-else
    :title="page.game?.headline || '找游戏搭子'"
    :subtitle="page.game?.blurb || '约好时间，找到一起开黑的人。'"
  >
    <wd-search
      :model-value="page.keyword"
      hide-cancel
      placeholder="搜索区服、玩法、要求"
      @update:model-value="page.onSearch(String($event))"
      @clear="page.clearSearch"
    />
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
    <view class="section-title mb-3">看看其他游戏</view
    ><wd-cell-group
      ><wd-cell
        v-for="game in page.others"
        :key="game.slug"
        :title="game.name"
        is-link
        @click="page.goGame(game.seoKey || game.slug)"
    /></wd-cell-group>
    <app-action-dock :active="pageActive"
      ><wd-button block @click="page.goPublish">{{
        page.game ? '发布 ' + page.game.name + ' 队伍' : '发布队伍'
      }}</wd-button></app-action-dock
    >
    <entry-notices />
  </app-shell>
  <canvas
    type="2d"
    id="cardShareCover"
    class="fixed -left-[2000px] top-0 w-[375px] h-[300px] pointer-events-none"
  />
</template>
