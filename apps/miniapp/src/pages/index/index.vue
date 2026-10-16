<script setup lang="ts">
defineOptions({ name: 'IndexIndexPage' });
import { reactive } from 'vue';
import { useLobby } from '../../composables/useLobby';
const page = reactive(useLobby());
</script>
<template>
  <timeline-preview v-if="page.singlePage" />
  <app-shell
    v-else
    title="找游戏搭子，一起开黑"
    subtitle="王者开黑、三角洲搭子、瓦搭子、和平精英搭子，快速找到一起玩的队友。"
  >
    <view class="panel flex items-center gap-4">
      <view class="flex-1"
        ><view class="section-title">热门游戏搭子</view
        ><view class="flex flex-wrap gap-2 mt-3">
          <wd-button
            v-for="game in page.featured"
            :key="game.seoKey"
            size="small"
            variant="soft"
            @click="page.goGame(game.seoKey || game.slug)"
            >{{ game.entryLabel }}</wd-button
          >
        </view></view
      ><image class="w-24 h-24 shrink-0" src="/static/images/brand/lobby-v1.jpg" mode="aspectFit" />
    </view>
    <wd-search
      :model-value="page.keyword"
      placeholder="搜索游戏 / 区服 / 段位 / 备注"
      hide-cancel
      @update:model-value="page.onSearch(String($event))"
      @clear="page.clearSearch"
    />
    <view class="flex items-center justify-between gap-3 my-4"
      ><view class="section-title"
        >现在的车 <text class="text-muted text-sm">{{ page.filtered.length }}/{{ page.total }}</text></view
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
    <scroll-view v-if="page.games.length > 1" scroll-x class="mb-4 whitespace-nowrap"
      ><view class="inline-flex gap-2"
        ><wd-button
          v-for="game in page.games"
          :key="game"
          size="small"
          :variant="page.gameFilter === game ? 'base' : 'soft'"
          @click="page.pickGame(game)"
          >{{ game }}</wd-button
        ></view
      ></scroll-view
    >
    <view v-if="page.listError" class="panel text-center"
      ><wd-empty :tip="page.listError" /><wd-button variant="soft" @click="page.loadList()"
        >重新加载</wd-button
      ></view
    >
    <wd-loading v-else-if="page.loading" />
    <template v-else
      ><team-card
        v-for="team in page.filtered"
        :key="team._id"
        :team="team"
        :team-id="team.id || team._id"
        @open="page.onOpen"
      />
      <view v-if="!page.filtered.length" class="panel text-center"
        ><wd-empty
          icon="/static/images/brand/empty-v1.jpg"
          :tip="page.keyword ? '已加载的队伍中没有匹配结果' : '还没有队伍，发起一局吧'"
        /><wd-button v-if="page.hasMore" variant="soft" @click="page.loadMore">继续加载更多</wd-button
        ><wd-button v-else @click="page.goPublish">发起组队</wd-button></view
      >
      <view class="py-6 text-center"
        ><wd-button v-if="page.hasMore" variant="text" :loading="page.loadingMore" @click="page.loadMore"
          >加载更多</wd-button
        ><text v-else class="hint">没有更多了</text></view
      ></template
    >
    <welcome-letter />
  </app-shell>
</template>
