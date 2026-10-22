<script setup lang="ts">
import { usePageActive } from '../../composables/usePageActive';
const pageActive = usePageActive('pages/index/index');
import { reactive, ref } from 'vue';
import { onShow, onPageScroll, onResize } from '@dcloudio/uni-app';
import { homeNavigationMetrics, type CapsuleRect } from '../../utils/home-navigation';
import { privacyConsent } from '../../utils/privacy';
import { platform } from '../../platform/host';
import { useAppTheme } from '../../composables/useAppTheme';
import { useLobby } from '../../composables/useLobby';
import TeamFilters from '../../components/team-filters/index.vue';
import TeamResults from '../../components/team-results/index.vue';
import NextTeam from '../../components/next-team/index.vue';
import type { TeamSearch } from '../../types/domain';
defineOptions({ name: 'IndexIndexPage' });
useAppTheme();
const page = reactive(useLobby());
function applyFilters(patch: Partial<TeamSearch>) {
  const { gameName, ...filters } = patch;
  if (gameName !== undefined) page.gameFilter = gameName || '全部';
  page.setFilters(filters);
}
const scrolled = ref(false);
const navigation = ref(homeNavigationMetrics());
function updateNavigation() {
  const info = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync();
  let capsule: CapsuleRect | undefined;
  // #ifdef MP-WEIXIN || MP-QQ
  if (uni.getMenuButtonBoundingClientRect) capsule = uni.getMenuButtonBoundingClientRect();
  // #endif
  navigation.value = homeNavigationMetrics(info.statusBarHeight, info.windowWidth, capsule);
}
onShow(() => {
  updateNavigation();
  if (!page.singlePage) privacyConsent.check();
});
onResize(updateNavigation);
onPageScroll(({ scrollTop }) => {
  scrolled.value = scrollTop > 24;
});
</script>
<template>
  <view class="lobby-home" :style="{ '--home-nav-height': navigation.total + 'px' }">
    <view class="lobby-atmosphere" aria-hidden="true" />
    <view
      class="home-navigation"
      :class="{ 'home-navigation-scrolled': scrolled }"
      :style="{ paddingTop: navigation.status + 'px' }"
    >
      <view
        class="home-navigation-inner"
        :style="{ height: navigation.height + 'px', paddingRight: navigation.right + 'px' }"
      >
        <view class="home-brand-mark" aria-hidden="true">✦</view>
        <text class="home-brand-name">开黑星球</text>
      </view>
    </view>
    <view class="home-navigation-spacer" />
    <timeline-preview v-if="page.singlePage" />
    <app-shell :active="pageActive" v-else variant="lobby">
      <lobby-hero />
      <next-team
        v-if="page.nextTeam"
        :team="page.nextTeam"
        @open="page.onOpen"
        @refresh="page.loadUpcoming"
      />
      <next-team
        v-if="page.recruitingTeam"
        :team="page.recruitingTeam"
        @open="page.onOpen"
        @refresh="page.loadUpcoming"
      />
      <view class="home-play-entries">
        <view role="button" class="home-play-entry" @click="platform.navigateTo({ url: '/pages/play/play' })"
          ><image class="entry-art" src="/static/images/play-today.png" mode="aspectFill" /><view
            class="entry-kicker"
            >TODAY</view
          ><view class="entry-title">今天玩啥</view><view class="entry-copy">投出想玩，随时约一局</view
          ><view class="entry-link">找个搭子 →</view></view
        >
        <view
          role="button"
          class="home-play-entry home-ranking-entry"
          @click="platform.navigateTo({ url: '/pages/friday/friday' })"
          ><image class="entry-art" src="/static/images/home-rankings.png" mode="aspectFill" /><view
            class="entry-kicker"
            >TOP PLAYERS</view
          ><view class="entry-title">用户排行</view><view class="entry-copy">发车榜 · 上车榜</view
          ><view class="entry-link">看看谁上榜 →</view></view
        >
      </view>
      <team-filters
        :active="pageActive"
        :query="page.query()"
        :game-options="
          page.gameOptions.map((item) => ({
            label: item.value === '全部' ? '全部游戏' : item.label,
            value: item.value === '全部' ? '' : item.value,
          }))
        "
        @change="applyFilters"
      >
        <template #toolbar="{ open, count }">
          <view class="home-filter-toolbar">
            <wd-search
              custom-class="lobby-search home-inline-search"
              :model-value="page.keyword"
              placeholder="搜索游戏、区服、玩法"
              placeholder-left
              hide-cancel
              @update:model-value="page.onSearch(String($event))"
              @clear="page.clearSearch"
            />
            <wd-button
              size="small"
              variant="soft"
              custom-class="home-filter-button"
              :aria-label="count ? '筛选，已选 ' + count + ' 项' : '筛选'"
              @click="open"
            >
              <wd-icon name="filter" size="17px" /> 筛选<text v-if="count" class="home-filter-dot" />
            </wd-button>
          </view>
        </template>
      </team-filters>
      <team-results
        :query="page.query()"
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
        @clear-time="page.setFilters({ time: '' })"
        @relax="
          page.setFilters({
            keyword: '',
            groupIds: [],
            platform: '',
            server: '',
            voice: '',
            availableOnly: true,
          })
        "
        @publish="page.goPublish"
      >
        <template #heading
          ><view class="home-results-heading"
            ><text>正在组队</text><text class="hint home-results-count">{{ page.total }} 个队伍</text></view
          ></template
        >
        <template #header-actions>
          <view class="home-sort-switch">
            <wd-button
              v-for="item in [
                { label: '最新', value: 'latest' },
                { label: '最热', value: 'hot' },
              ]"
              :key="item.value"
              size="small"
              :variant="page.sortMode === item.value ? 'soft' : 'text'"
              custom-class="home-sort-button"
              :aria-pressed="page.sortMode === item.value"
              @click="page.pickSort(item.value)"
              >{{ item.label }}</wd-button
            >
          </view>
        </template>
      </team-results>
      <entry-notices />
      <canvas
        type="2d"
        id="cardShareCover"
        class="fixed -left-[2000px] top-0 w-[375px] h-[300px] pointer-events-none"
      />
    </app-shell>
  </view>
</template>
<style scoped>
.home-play-entries {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 0 0 12px;
}
.home-play-entry {
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  height: 142px;
  padding: 14px 12px 12px;
  border-radius: 18px;
  background: #eae2ff;
  color: #3e2878;
  box-shadow: 0 5px 16px #6255e712;
}
.entry-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.entry-kicker,
.entry-title,
.entry-copy,
.entry-link {
  position: relative;
}
.entry-kicker {
  font-size: 10px;
  letter-spacing: 2px;
  opacity: 0.8;
}
.entry-title {
  margin-top: 6px;
  font-size: 18px;
  font-weight: 700;
}
.entry-copy {
  max-width: 120px;
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.55;
}
.entry-link {
  margin-top: 16px;
  font-size: 11px;
  font-weight: 600;
}
.home-ranking-entry {
  background: #252051;
  color: #fff;
}
.home-ranking-entry .entry-copy {
  color: #e1d7ff;
}

.home-filter-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 44px;
  margin: 4px 0 12px;
}
.home-filter-toolbar :deep(.home-inline-search) {
  flex: 1;
  min-width: 0;
  --wot-search-padding: 4px 0;
}
.home-filter-toolbar :deep(.home-filter-button.wd-button) {
  position: relative;
  flex: 0 0 72px;
  min-width: 72px;
  height: 36px;
  padding: 0 10px;
  font-size: 13px;
}
.home-filter-dot {
  position: absolute;
  top: 6px;
  right: 7px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #6255e7;
}
.home-results-heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
  white-space: nowrap;
}
.home-results-count {
  font-size: 11px;
  font-weight: 400;
}
.home-sort-switch {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.home-sort-switch :deep(.home-sort-button.wd-button) {
  padding: 0 12px;
  min-width: 48px;
  font-size: 12px;
}

.lobby-home {
  position: relative;
  min-height: 100vh;
  background: #f4f5f8;
}
.lobby-atmosphere {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: calc(var(--home-nav-height) + 250px);
  background:
    radial-gradient(ellipse at 95% 0, rgba(212, 226, 255, 0.75), transparent 65%),
    linear-gradient(180deg, #e7e2ff 0%, #eeecff 48%, #f4f5f8 100%);
  pointer-events: none;
}
.home-navigation {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 90;
  background: rgba(231, 226, 255, 0.22);
  transition:
    background-color 180ms ease,
    box-shadow 180ms ease;
}
.home-navigation-scrolled {
  background: rgba(247, 246, 253, 0.98);
  box-shadow: 0 1px 0 rgba(98, 85, 231, 0.06);
}
.home-navigation-inner {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 560px;
  margin: 0 auto;
  padding-left: 16px;
  box-sizing: border-box;
}
.home-brand-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 9px;
  background: #6255e7;
  color: #fff;
  font-size: 21px;
  line-height: 26px;
}
.home-brand-name {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 1px;
  white-space: nowrap;
  color: #22232a;
}
.home-navigation-spacer {
  height: var(--home-nav-height);
}
.lobby-home :deep(.page-lobby) {
  position: relative;
  min-height: calc(100vh - var(--home-nav-height));
  background: transparent;
  padding-top: 20px;
}
@media (max-width: 359px) {
  .home-navigation-inner {
    padding-left: 12px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .home-navigation {
    transition: none;
  }
}
</style>
