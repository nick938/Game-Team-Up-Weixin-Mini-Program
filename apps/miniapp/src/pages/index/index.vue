<script setup lang="ts">
import { usePageActive } from '../../composables/usePageActive';
const pageActive = usePageActive('pages/index/index');
import { reactive, ref, watch } from 'vue';
import { onShow, onPageScroll, onResize } from '@dcloudio/uni-app';
import { homeNavigationMetrics, type CapsuleRect } from '../../utils/home-navigation';
import { privacyConsent } from '../../utils/privacy';
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
useTabBarOverlay(showGames);
watch(pageActive, (active) => {
  if (!active) showGames.value = false;
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
      <next-team
        v-if="page.nextTeam"
        :team="page.nextTeam"
        @open="page.onOpen"
        @refresh="page.loadUpcoming"
      />
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
  </view>
</template>
<style scoped>
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
