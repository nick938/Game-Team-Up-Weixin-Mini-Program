<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { onPageScroll, onResize, onShow } from '@dcloudio/uni-app';
import { usePageActive } from '../../composables/usePageActive';
import { useAppTheme } from '../../composables/useAppTheme';
import { useMine } from '../../composables/useMine';
import { homeNavigationMetrics, type CapsuleRect } from '../../utils/home-navigation';
import MineAvatar from '../../components/mine-avatar/index.vue';
import NextTeam from '../../components/next-team/index.vue';
defineOptions({ name: 'MineMinePage' });
const pageActive = usePageActive('pages/mine/mine');
useAppTheme();
const page = reactive(useMine());
const navigation = ref(homeNavigationMetrics());
const scrolled = ref(false);
function updateNavigation() {
  const info = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync();
  let capsule: CapsuleRect | undefined;
  // #ifdef MP-WEIXIN || MP-QQ
  if (uni.getMenuButtonBoundingClientRect) capsule = uni.getMenuButtonBoundingClientRect();
  // #endif
  navigation.value = homeNavigationMetrics(info.statusBarHeight, info.windowWidth, capsule);
}
function syncNavigationColor() {
  uni.setNavigationBarColor?.({
    frontColor: scrolled.value ? '#000000' : '#ffffff',
    backgroundColor: scrolled.value ? '#F4F5F8' : '#211B3B',
    fail() {},
  });
}
onShow(() => {
  updateNavigation();
  syncNavigationColor();
});
onResize(updateNavigation);
onPageScroll(({ scrollTop }) => {
  const next = scrollTop > 180;
  if (next === scrolled.value) return;
  scrolled.value = next;
  syncNavigationColor();
});
const entries = computed(() => [
  { tab: 'hosted' as const, title: '我发起的', count: page.hostedCount },
  { tab: 'joined' as const, title: '我加入的', count: page.joinedCount },
  { tab: 'all' as const, title: '未结束', count: page.ongoingCount },
]);
</script>
<template>
  <timeline-preview v-if="page.singlePage" />
  <app-shell v-else :active="pageActive" variant="profile">
    <view class="profile-hub" :style="{ '--mine-nav-height': navigation.total + 'px' }">
      <view
        class="mine-navigation"
        :class="{ 'mine-navigation-scrolled': scrolled }"
        :style="{ paddingTop: navigation.status + 'px' }"
      >
        <view class="mine-navigation-title" :style="{ height: navigation.height + 'px' }">我的</view>
      </view>
      <view class="mine-cover">
        <image
          class="mine-cover-art"
          src="/static/images/brand/mine-cover-v1.jpg"
          mode="aspectFill"
          aria-hidden="true"
        />
        <view class="mine-cover-shade" aria-hidden="true" />
        <view class="mine-profile" role="button" aria-label="编辑个人资料" @tap="page.editProfile">
          <view class="mine-avatar-frame"
            ><mine-avatar :src="page.user.avatarUrl" :identity="page.user.userId || page.user._id" :size="60"
          /></view>
          <view class="mine-profile-copy">
            <view class="mine-nickname">{{ page.user.nickName || '设置头像昵称' }}</view>
            <view class="mine-bio">{{ page.profileHint }}</view>
            <profile-tags :user="page.user" groups-only />
            <view class="mine-edit">编辑资料 <wd-icon name="arrow-right" size="12px" /></view>
          </view>
        </view>
      </view>
      <view class="mine-content">
        <view class="mine-stats">
          <wd-button
            v-for="entry in entries"
            :key="entry.tab"
            variant="text"
            :aria-label="entry.title + '，' + (page.state.teamsLoaded ? entry.count : '加载中')"
            custom-class="mine-stat-button"
            @click="page.openMyTeams(entry.tab)"
          >
            <view class="mine-stat-content"
              ><text class="mine-stat-count">{{ page.state.teamsLoaded ? entry.count : '—' }}</text
              ><text class="mine-stat-label">{{ entry.title }}</text></view
            >
          </wd-button>
        </view>
        <view v-if="page.state.profileError || page.state.listError" class="mine-error">
          <text>{{ page.state.profileError || page.state.listError }}</text>
          <wd-button size="small" variant="text" :loading="page.state.loading" @click="page.load(true)"
            >重试</wd-button
          >
        </view>
        <view v-if="page.nextTeam" class="mine-next">
          <next-team :team="page.nextTeam" highlighted @open="page.onOpen" @refresh="page.load()" />
        </view>
        <view class="mine-menu-group">
          <wd-cell-group border>
            <wd-cell title="更新公告" prefix-icon="notification" is-link center @click="page.openUpdates" />
          </wd-cell-group>
        </view>
        <view v-if="page.isAdmin || page.isOrganizer" class="mine-menu-group">
          <wd-cell-group border>
            <wd-cell
              v-if="page.isOrganizer && !page.isAdmin"
              title="帮群友发车"
              prefix-icon="user-group"
              is-link
              center
              @click="page.openPublish"
            />
            <wd-cell
              v-if="page.isAdmin"
              title="管理端"
              prefix-icon="dashboard"
              is-link
              center
              @click="page.openAdmin"
            />
          </wd-cell-group>
        </view>
        <view class="mine-menu-group">
          <wd-cell-group border>
            <wd-cell title="帮助与反馈" prefix-icon="message" is-link center @click="page.openHelp" />
            <wd-cell
              title="社区公约"
              prefix-icon="safe"
              is-link
              center
              @click="page.openLegal('community')"
            />
            <wd-cell title="设置中心" prefix-icon="settings" is-link center @click="page.openSettings" />
          </wd-cell-group>
        </view>
        <view class="mine-version"
          >{{ page.versionText }}<text class="mine-version-caption">开黑星球 · 找到一起玩的朋友</text></view
        >
      </view>
    </view>
    <profile-gate :show="page.showProfile" @done="page.onProfileDone" @close="page.onProfileClose" />
    <entry-notices />
  </app-shell>
</template>
<style scoped>
:deep(.page-profile) {
  padding: 0;
  max-width: none;
  background: var(--app-page);
  min-height: calc(100vh - var(--window-bottom, 0px));
}
.profile-hub {
  max-width: 560px;
  margin: 0 auto;
  background: var(--app-page);
  color: var(--app-ink);
  min-height: calc(100vh - var(--window-bottom, 0px));
}
.mine-navigation {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  color: #fff;
  transition:
    background-color 160ms ease,
    color 160ms ease;
}
.mine-navigation-scrolled {
  background: var(--app-page);
  color: var(--app-ink);
  box-shadow: 0 1px 0 var(--app-border);
}
.mine-navigation-title {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  line-height: 24px;
  font-weight: 600;
}
.mine-cover {
  position: relative;
  overflow: hidden;
  padding-top: var(--mine-nav-height);
  padding-bottom: 48px;
  background: #211b3b;
  color: #fff;
}
.mine-cover-art,
.mine-cover-shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.mine-cover-art {
  opacity: 0.7;
}
.mine-cover-shade {
  background: linear-gradient(90deg, rgba(25, 20, 46, 0.72), rgba(25, 20, 46, 0.12));
}
.mine-profile {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 32px 20px 14px;
}
.mine-avatar-frame {
  display: flex;
  flex-shrink: 0;
  padding: 3px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.12);
}
.mine-profile-copy {
  min-width: 0;
  flex: 1;
}
.mine-nickname {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 21px;
  line-height: 29px;
  font-weight: 600;
}
.mine-bio {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 4px;
  color: #bbb8c8;
  font-size: 12px;
  line-height: 20px;
}
.mine-edit {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 6px;
  font-size: 12px;
  line-height: 20px;
  color: #d6d0ff;
}
.mine-content {
  position: relative;
  margin-top: -28px;
  padding: 0 16px calc(24px + env(safe-area-inset-bottom));
}
.mine-stats {
  display: flex;
  align-items: stretch;
  margin-bottom: 16px;
  padding: 16px 4px;
  border: 1px solid var(--app-border);
  border-radius: 16px;
  background: var(--app-surface);
}
.mine-stats :deep(.mine-stat-button) {
  flex: 1;
  min-width: 0;
  height: auto;
  padding: 0;
  border-radius: 0;
  --wot-button-primary-color: var(--app-ink);
}
.mine-stats :deep(.mine-stat-button + .mine-stat-button) {
  border-left: 1px solid var(--app-border);
}
.mine-stat-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 4px 0;
}
.mine-stat-count {
  color: var(--app-brand);
  font-size: 25px;
  line-height: 34px;
  font-weight: 600;
}
.mine-stat-label {
  color: var(--app-secondary);
  font-size: 12px;
  line-height: 20px;
}
.mine-menu-group {
  margin-top: 12px;
  --wot-cell-group-bg: var(--app-surface);
  --wot-cell-bg: var(--app-surface);
  --wot-cell-bg-active: var(--app-surface-muted);
  --wot-cell-title-color: var(--app-ink);
  --wot-cell-icon-color: var(--app-secondary);
  --wot-cell-arrow-color: var(--app-muted);
  --wot-cell-border-color: var(--app-border);
  --wot-cell-padding: 16px;
  --wot-cell-tap-bg: var(--app-surface-muted);
}
.mine-menu-group :deep(.wd-cell-group) {
  border: 1px solid var(--app-border);
  border-radius: 14px;
  box-shadow: none;
}
.mine-menu-group :deep(.wd-cell) {
  display: flex;
  align-items: center;
  min-height: 58px;
  box-sizing: border-box;
}
.mine-menu-group :deep(.wd-cell__wrapper) {
  width: 100%;
  align-items: center;
}
.mine-menu-group :deep(.wd-cell__left),
.mine-menu-group :deep(.wd-cell__body) {
  align-items: center;
}
.mine-menu-group :deep(.wd-cell__prefix),
.mine-menu-group :deep(.wd-cell__arrow-right) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
/* NextTeam uses the same light purple treatment as the other pages. */
.mine-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: 12px;
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: 12px;
}
.mine-version {
  margin-top: 28px;
  color: var(--app-muted);
  font-size: 11px;
  line-height: 20px;
  text-align: center;
}
.mine-version-caption {
  display: block;
  margin-top: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .mine-navigation {
    transition: none;
  }
}
</style>
