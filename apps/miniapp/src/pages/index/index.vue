<script setup lang="ts">
import { useAppTheme } from '../../composables/useAppTheme';
useAppTheme();
defineOptions({ name: 'IndexIndexPage' });
import { reactive } from 'vue';
import { useLobby } from '../../composables/useLobby';
const page = reactive(useLobby());
const gameVisuals: Record<string, { mark: string; label: string; color: string }> = {
  wangzhe: { mark: '王', label: '王者荣耀', color: 'game-amber' },
  delta: { mark: 'Δ', label: '三角洲', color: 'game-mint' },
  valorant: { mark: 'V', label: '无畏契约', color: 'game-rose' },
  peace: { mark: '和平', label: '和平精英', color: 'game-violet' },
};
</script>
<template>
  <timeline-preview v-if="page.singlePage" />
  <app-shell v-else variant="lobby">
    <lobby-hero @publish="page.goPublish" />
    <view class="grid grid-cols-4 gap-2 mb-4">
      <wd-button
        v-for="game in page.featured"
        :key="game.seoKey || game.slug"
        variant="text"
        custom-class="game-entry"
        @click="page.goGame(game.seoKey || game.slug)"
      >
        <view class="flex flex-col items-center min-w-0">
          <view class="game-symbol" :class="gameVisuals[game.seoKey || game.slug]?.color || 'game-violet'">{{
            gameVisuals[game.seoKey || game.slug]?.mark || game.name.slice(0, 1)
          }}</view>
          <text class="text-xs leading-4 font-medium">{{
            gameVisuals[game.seoKey || game.slug]?.label || game.name
          }}</text>
        </view>
      </wd-button>
    </view>
    <wd-search
      :model-value="page.keyword"
      placeholder="搜索已加载队伍的游戏、区服"
      hide-cancel
      @update:model-value="page.onSearch(String($event))"
      @clear="page.clearSearch"
    />
    <view class="hint mt-2">在已加载队伍中搜索，更多队伍可继续加载</view>
    <view class="flex flex-wrap items-center justify-between gap-3 mt-6 mb-3">
      <view class="flex items-center gap-2">
        <view class="text-lg font-bold text-night">组队广场</view>
        <text class="text-xs text-muted">{{ page.filtered.length }} / {{ page.total }}</text>
      </view>
      <view class="sort-segment flex">
        <wd-button
          v-for="sort in page.sorts"
          :key="sort.key"
          size="small"
          variant="text"
          :custom-class="page.sortMode === sort.key ? 'sort-active' : '!text-muted'"
          @click="page.pickSort(sort.key)"
          >{{ sort.label }}</wd-button
        >
      </view>
    </view>
    <scroll-view v-if="page.games.length > 1" scroll-x class="mb-3 whitespace-nowrap">
      <view class="inline-flex gap-2">
        <wd-button
          v-for="game in page.games"
          :key="game"
          size="small"
          :variant="page.gameFilter === game ? 'base' : 'soft'"
          @click="page.pickGame(game)"
          >{{ game }}</wd-button
        >
      </view>
    </scroll-view>
    <view v-if="page.listError && !page.total" class="panel !py-7 text-center">
      <view class="flex-center w-12 h-12 mx-auto rounded-2xl bg-brand-light text-electric mb-3"
        ><wd-icon name="wifi" size="24px"
      /></view>
      <view class="text-sm font-semibold mb-1">暂时没连上大厅</view>
      <view class="hint mb-4">{{ page.listError }}</view>
      <wd-button size="small" variant="soft" @click="page.loadList()">重新加载</wd-button>
    </view>
    <view v-else-if="page.loading && !page.total" aria-label="正在加载队伍">
      <view v-for="item in 2" :key="item" class="panel !p-4" aria-hidden="true">
        <view class="flex justify-between mb-4"
          ><view class="skeleton-shape w-28 h-5" /><view class="skeleton-shape w-14 h-5"
        /></view>
        <view class="skeleton-shape w-40 h-3 mb-3" /><view class="skeleton-shape w-28 h-3 mb-5" /><view
          class="skeleton-shape w-full h-7"
        />
      </view>
    </view>
    <template v-else>
      <view v-if="page.listError" class="panel flex items-center justify-between gap-3"
        ><text class="text-sm text-secondary">刷新失败，仍显示上次加载的队伍</text
        ><wd-button size="small" variant="soft" :loading="page.loading" @click="page.loadList()"
          >重试</wd-button
        ></view
      >
      <team-card
        v-for="(team, index) in page.filtered"
        :key="team._id"
        :team="team"
        :team-id="team.id || team._id"
        :sequence="index"
        @open="page.onOpen"
      />
      <view v-if="!page.filtered.length" class="panel text-center">
        <wd-empty
          icon="/static/images/brand/empty-v1.jpg"
          :tip="
            page.keyword || page.gameFilter !== '全部'
              ? '已加载的队伍中没有匹配结果'
              : page.hasMore
                ? '暂未找到队伍，试试继续加载'
                : '下一局，等你来发起'
          "
        />
        <view v-if="page.keyword || page.gameFilter !== '全部'" class="mb-3"
          ><wd-button
            variant="soft"
            @click="
              page.clearSearch();
              page.pickGame('全部');
            "
            >清空筛选</wd-button
          ></view
        >
        <wd-button v-if="page.hasMore" :loading="page.loadingMore" variant="soft" @click="page.loadMore"
          >继续加载更多</wd-button
        >
        <wd-button v-else @click="page.goPublish">发起组队</wd-button>
      </view>
      <view v-if="page.filtered.length" class="py-4 text-center">
        <wd-button v-if="page.hasMore" variant="text" :loading="page.loadingMore" @click="page.loadMore"
          >加载更多</wd-button
        >
        <text v-else class="hint">已经看到这里了，发起你的下一局吧</text>
      </view>
    </template>
    <welcome-letter />
  </app-shell>
</template>
