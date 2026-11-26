<script setup lang="ts">
import { appTheme, pageThemeBackground, pageThemeStyle, pageThemeForeground } from '../../utils/app-theme';
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { usePageActive } from '../../composables/usePageActive';
const pageActive = usePageActive('pages/index/index');
import { reactive, ref } from 'vue';
import { onShow, onPageScroll, onResize } from '@dcloudio/uni-app';
import { homeNavigationMetrics, type CapsuleRect } from '../../utils/home-navigation';
import { privacyConsent } from '../../utils/privacy';
import { platform } from '../../platform/host';
import { useAppTheme } from '../../composables/useAppTheme';
import { useLobby } from '../../composables/useLobby';
import { useWechatTabBar } from '../../composables/useWechatTabBar';
import TeamFilters from '../../components/team-filters/index.vue';
import TeamResults from '../../components/team-results/index.vue';
import NextTeam from '../../components/next-team/index.vue';
import type { TeamSearch } from '../../types/domain';
defineOptions({ name: 'IndexIndexPage' });
useAppTheme();
const page = reactive(useLobby());
const layoutKey = 'home-team-layout';
const waterfall = ref(false);
try {
  waterfall.value = platform.getStorageSync(layoutKey) === 'waterfall';
} catch {
  // Keep the default when storage is unavailable.
}
function toggleLayout() {
  waterfall.value = !waterfall.value;
  try {
    platform.setStorageSync(layoutKey, waterfall.value ? 'waterfall' : 'list');
  } catch {
    // The current page still switches layout.
  }
}
useWechatTabBar('pages/index/index', () => page.singlePage);
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
// Keep native share hook registration in the page SFC for uni compilation.
onShareAppMessage(page.shareAppMessage);
onShareTimeline(page.shareTimeline);
</script>
<template>
  <page-meta :page-style="pageThemeStyle" :background-color="pageThemeBackground">
    <navigation-bar :front-color="pageThemeForeground" :background-color="pageThemeBackground" />
  </page-meta>
  <view
    class="lobby-home"
    :class="{ 'lobby-home-dark': appTheme === 'dark' }"
    :style="{ '--home-nav-height': navigation.total + 'px' }"
  >
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
            <wd-button
              size="small"
              variant="text"
              custom-class="home-ranking-button"
              aria-label="用户排行"
              @click="platform.navigateTo({ url: '/pages/friday/friday' })"
            >
              <wd-icon name="trophy" size="16px" /> 排行
            </wd-button>
          </view>
        </template>
      </team-filters>
      <!-- #ifndef MP-WEIXIN -->
      <wd-button
        size="small"
        variant="text"
        custom-class="home-play-button"
        @click="platform.navigateTo({ url: '/pages/play/play' })"
      >
        今天玩啥 <wd-icon name="arrow-right" size="14px" />
      </wd-button>
      <!-- #endif -->
      <team-results
        :query="page.query()"
        :teams="page.filtered"
        :waterfall="waterfall"
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
            <wd-button
              variant="text"
              size="small"
              custom-class="home-layout-button"
              :aria-label="waterfall ? '切换为单栏' : '切换为双栏瀑布流'"
              :aria-pressed="waterfall"
              @click="toggleLayout"
              ><wd-icon :name="waterfall ? 'list' : 'apps'" size="18px"
            /></wd-button>
          </view>
        </template>
      </team-results>
      <!-- #ifdef MP-WEIXIN -->
      <view class="wechat-tab-spacer" />
      <!-- #endif -->
      <entry-notices />
    </app-shell>
  </view>
  <canvas
    type="2d"
    id="cardShareCover"
    class="fixed -left-[2000px] top-0 w-[375px] h-[300px] pointer-events-none"
  />
</template>
<style scoped>
.home-filter-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  min-height: 44px;
  margin: 0 0 8px;
}
.home-filter-toolbar :deep(.home-inline-search) {
  flex: 1;
  min-width: 0;
  --wot-search-padding: 4px 0;
}
.home-filter-toolbar :deep(.home-filter-button.wd-button) {
  position: relative;
  flex: 0 0 auto;
  min-width: 56px;
  padding: 0 7px;
  font-size: 12px;
}
.home-filter-toolbar :deep(.home-ranking-button.wd-button) {
  flex: 0 0 auto;
  min-width: 54px;
  padding: 0 5px;
  font-size: 12px;
  color: var(--app-secondary);
}
:deep(.home-play-button.wd-button) {
  margin: 0 0 8px;
  padding: 0 8px;
}
.home-filter-dot {
  position: absolute;
  top: 6px;
  right: 7px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--app-brand);
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
  padding: 0 7px;
  min-width: 42px;
  font-size: 12px;
}

.home-sort-switch :deep(.home-layout-button.wd-button) {
  min-width: 44px;
  padding: 0;
}
.lobby-home {
  position: relative;
  min-height: 100vh;
  background: var(--app-page);
}
.lobby-atmosphere {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: calc(var(--home-nav-height) + 170px);
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
  background: var(--app-frosted);
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
  background: var(--app-brand);
  color: var(--app-on-brand);
  font-size: 21px;
  line-height: 26px;
}
.home-brand-name {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 1px;
  white-space: nowrap;
  color: var(--app-ink);
}
.home-navigation-spacer {
  height: var(--home-nav-height);
}
.lobby-home :deep(.page-lobby) {
  position: relative;
  min-height: calc(100vh - var(--home-nav-height));
  background: transparent;
  padding-top: 10px;
}
.lobby-home-dark .lobby-atmosphere {
  background: radial-gradient(ellipse at 85% 0, var(--app-soft-glow), transparent 70%), var(--app-page);
}
.lobby-home-dark .home-navigation:not(.home-navigation-scrolled) {
  background: var(--app-glass);
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
