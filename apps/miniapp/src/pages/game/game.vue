<script setup lang="ts">
defineOptions({ name: 'GameGamePage' });
import { reactive } from 'vue';
import { useGame } from '../../composables/useGame';
const page = reactive(useGame());
</script>
<template>
  <timeline-preview v-if="page.singlePage" />
  <app-shell v-else :title="page.seoHeading" :subtitle="page.seoDescription">
    <view class="panel"
      ><view class="flex flex-wrap gap-2"
        ><wd-tag v-for="tag in page.tags" :key="tag" type="primary" variant="light">{{ tag }}</wd-tag></view
      ><view class="mt-4"
        ><wd-button block @click="page.goPublish">{{
          page.game ? '发起 ' + page.game.name + ' 组队' : '发起组队'
        }}</wd-button></view
      ></view
    >
    <view class="flex justify-between items-center my-4"
      ><view class="section-title">正在组队</view
      ><view class="flex gap-2"
        ><wd-button
          v-for="sort in page.sorts"
          :key="sort.key"
          size="small"
          :variant="page.sortMode === sort.key ? 'base' : 'soft'"
          @click="page.pickSort(sort.key)"
          >{{ sort.label }}</wd-button
        ></view
      ></view
    >
    <view v-if="page.listError" class="panel"
      ><wd-empty tip="加载失败，请稍后重试" /><wd-button block variant="soft" @click="page.loadList()"
        >重新加载</wd-button
      ></view
    >
    <template v-else
      ><team-card
        v-for="team in page.filtered"
        :key="team._id"
        :team="team"
        :team-id="team.id || team._id"
        @open="page.onOpen"
      /><wd-empty v-if="!page.filtered.length" tip="这款游戏暂时没有队伍，来发起第一局吧" /><wd-button
        v-if="page.hasMore"
        block
        variant="text"
        :loading="page.loadingMore"
        @click="page.loadMore"
        >继续加载更多</wd-button
      ></template
    >
    <view class="section-title my-4">看看其他游戏</view
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
