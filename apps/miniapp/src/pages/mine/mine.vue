<script setup lang="ts">
import { usePageActive } from '../../composables/usePageActive';
const pageActive = usePageActive('pages/mine/mine');
import { useAppTheme } from '../../composables/useAppTheme';
useAppTheme();
defineOptions({ name: 'MineMinePage' });
import { computed, reactive, ref, watch } from 'vue';
import MineAvatar from '../../components/mine-avatar/index.vue';
import MineTeamCard from '../../components/mine-team-card/index.vue';
import NextTeam from '../../components/next-team/index.vue';
import { useTabBarOverlay } from '../../composables/useTabBarOverlay';
import { onHide, onShow, onResize } from '@dcloudio/uni-app';
import { homeNavigationMetrics, type CapsuleRect } from '../../utils/home-navigation';
import { useMine } from '../../composables/useMine';
const page = reactive(useMine());
const navigation = ref(homeNavigationMetrics());
function updateNavigation() {
  const info = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync();
  let capsule: CapsuleRect | undefined;
  // #ifdef MP-WEIXIN || MP-QQ
  if (uni.getMenuButtonBoundingClientRect) capsule = uni.getMenuButtonBoundingClientRect();
  // #endif
  navigation.value = homeNavigationMetrics(info.statusBarHeight, info.windowWidth, capsule);
}
onShow(updateNavigation);
onResize(updateNavigation);
const showSettings = ref(false);
const { afterLeave: releaseSettingsOverlay } = useTabBarOverlay(showSettings, { waitForAfterLeave: true });
let pendingSetting: (() => void) | undefined;
function openSetting(action: () => void) {
  pendingSetting = action;
  showSettings.value = false;
}
function settingsAfterLeave() {
  releaseSettingsOverlay();
  const action = pendingSetting;
  pendingSetting = undefined;
  action?.();
}
onHide(() => {
  showSettings.value = false;
});
const activeList = computed(() => `${page.teamTab}-${page.phase}`);
const visitedLists = reactive<Record<string, boolean>>({});
watch(
  activeList,
  (key) => {
    visitedLists[key] = true;
  },
  { immediate: true },
);
// Lazily mount each list once. Switching filters keeps loaded avatars and card instances alive.
const lists = computed(() => [
  { key: 'hosted-Ongoing', hosted: true, teams: page.hostedOngoing },
  { key: 'hosted-Past', hosted: true, teams: page.hostedPast },
  { key: 'joined-Ongoing', hosted: false, teams: page.joinedOngoing },
  { key: 'joined-Past', hosted: false, teams: page.joinedPast },
]);
</script>
<template>
  <timeline-preview v-if="page.singlePage" />
  <app-shell :active="pageActive" v-else variant="profile">
    <view class="mine-cover">
      <image
        class="mine-cover-art"
        src="/static/images/brand/mine-cover-v1.jpg"
        mode="aspectFill"
        aria-hidden="true"
      />
      <view class="mine-cover-shade" aria-hidden="true" />
      <view class="mine-navigation" :style="{ paddingTop: navigation.status + 'px' }">
        <view class="mine-navigation-title" :style="{ height: navigation.height + 'px' }">我的</view>
      </view>
      <view class="mine-profile">
        <view class="mine-profile-main" role="button" aria-label="编辑个人资料" @tap="page.editProfile">
          <view class="mine-avatar-frame"
            ><mine-avatar :src="page.user.avatarUrl" :identity="page.user.userId || page.user._id" :size="56"
          /></view>
          <view class="mine-profile-copy">
            <view class="mine-nickname">{{ page.user.nickName || '设置头像昵称' }}</view>
            <view class="mine-bio">{{ page.profileHint }}</view>
            <view class="mine-edit">编辑资料 <wd-icon name="arrow-right" size="11px" /></view>
          </view>
        </view>
        <wd-button
          variant="text"
          icon="settings"
          aria-label="服务与设置"
          custom-class="mine-settings-button"
          @click="showSettings = true"
        />
      </view>
      <view class="mine-cover-caption">一起开黑，下局见。</view>
    </view>
    <view class="mine-content">
      <view v-if="page.state.profileError" class="panel flex items-center justify-between gap-3"
        ><text class="text-sm text-secondary">{{ page.state.profileError }}</text
        ><wd-button size="small" variant="soft" @click="page.load(true)">重试</wd-button></view
      >
      <next-team
        v-if="page.nextTeam"
        :team="page.nextTeam"
        highlighted
        @open="page.onOpen"
        @refresh="page.load()"
      />
      <view class="mine-tabs">
        <wd-tabs
          :model-value="page.teamTab"
          line-theme="text"
          @change="page.pickTeamTab(String($event.name))"
        >
          <wd-tab name="hosted" :title="'我发起的 ' + page.hostedCount" />
          <wd-tab name="joined" :title="'我加入的 ' + page.joinedCount" />
        </wd-tabs>
      </view>
      <wd-segmented
        :value="page.phase"
        :options="[
          { value: 'Ongoing', payload: { label: '未结束' } },
          { value: 'Past', payload: { label: '历史记录' } },
        ]"
        custom-class="mine-phase !flex !w-full !mb-4"
        @change="page.pickPhase(String($event.value))"
        ><template #label="{ option }">{{ option.payload.label }}</template></wd-segmented
      >
      <view v-if="page.state.listError" class="panel"
        ><view class="text-sm text-secondary mb-3">{{ page.state.listError }}</view
        ><wd-button variant="soft" :loading="page.state.loading" @click="page.load(true)"
          >重新加载</wd-button
        ></view
      >
      <view v-if="page.state.loading && !page.visibleTeams.length" class="panel" aria-label="正在加载队伍"
        ><wd-skeleton
          animation="gradient"
          :row-col="[
            { width: '160px', height: '24px' },
            { width: '100%', height: '16px' },
          ]"
      /></view>
      <template v-for="list in lists" :key="list.key">
        <view v-if="visitedLists[list.key]" v-show="activeList === list.key">
          <mine-team-card
            v-for="team in list.teams"
            :key="team.id || team._id"
            :team="team"
            :hosted="list.hosted"
            @open="page.onOpen"
          />
        </view>
      </template>
      <view
        v-if="!page.visibleTeams.length && !page.state.loading && !page.state.listError"
        class="empty-state"
        ><wd-empty
          icon="empty"
          :icon-size="58"
          :tip="
            page.phase === 'Past'
              ? '还没有历史记录'
              : page.teamTab === 'hosted'
                ? '还没有待开的队伍'
                : '还没有加入队伍'
          " /><view class="hint mb-2">{{
          page.phase === 'Past' ? '结束的队伍会保存在这里' : '约好时间，和队友一起出发'
        }}</view
        ><wd-button v-if="page.phase === 'Ongoing'" variant="text" @click="page.goPlaza"
          >去大厅看看 <wd-icon name="arrow-right" size="14px" /></wd-button
      ></view>
      <wd-popup
        v-model="showSettings"
        @after-leave="settingsAfterLeave"
        position="bottom"
        root-portal
        closable
        safe-area-inset-bottom
        custom-style="border-radius:24px 24px 0 0;"
      >
        <view class="mine-settings-sheet">
          <view class="mine-settings-title">服务与设置</view>
          <wd-cell-group
            ><wd-cell
              title="更新公告"
              label="看看最近更新了什么"
              is-link
              @click="openSetting(page.openUpdates)" /><wd-cell
              title="更新日志"
              label="按版本查看详细变化"
              is-link
              @click="openSetting(page.openChangelog)" /><wd-cell
              v-if="page.isOrganizer && !page.isAdmin"
              title="帮群友发车"
              is-link
              @click="openSetting(page.openPublish)" /><wd-cell
              v-if="page.isAdmin"
              title="管理端"
              is-link
              @click="openSetting(page.openAdmin)" /><wd-cell
              title="帮助与反馈"
              label="常见问题、意见反馈、报错与联系作者"
              is-link
              @click="openSetting(page.openHelp)" /><wd-cell
              title="社区公约"
              is-link
              @click="openSetting(() => page.openLegal('community'))"
          /></wd-cell-group>
          <view class="hint text-center py-5">{{ page.versionText }}</view>
        </view></wd-popup
      >
    </view>
    <profile-gate
      :show="page.showProfile"
      @done="page.onProfileDone"
      @close="page.onProfileClose"
    /><entry-notices />
  </app-shell>
</template>

<style scoped>
:deep(.page-profile) {
  padding-top: 0;
  background: var(--app-page);
}
.mine-cover {
  position: relative;
  margin: 0 -16px;
  overflow: hidden;
  background: #211b3b;
  color: white;
}
.mine-cover-art,
.mine-cover-shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.mine-cover-art {
  opacity: 0.85;
}
.mine-cover-shade {
  background:
    linear-gradient(90deg, rgba(25, 20, 46, 0.8), rgba(25, 20, 46, 0.1)),
    linear-gradient(0deg, rgba(25, 20, 46, 0.75), transparent 55%);
}
.mine-navigation {
  position: relative;
}
.mine-navigation-title {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  font-weight: 600;
}
.mine-profile {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 24px 16px 12px;
}
.mine-avatar-frame {
  display: flex;
  padding: 3px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 17px;
  background: rgba(255, 255, 255, 0.12);
}
.mine-cover-caption {
  position: relative;
  padding: 2px 20px 40px;
  font-size: 11px;
  line-height: 18px;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 1px;
}
.mine-content {
  position: relative;
  margin-top: -20px;
  padding-top: 16px;
  border-radius: 20px 20px 0 0;
  background: var(--app-page);
  min-height: 55vh;
}
@media (max-width: 359px) {
  .mine-cover {
    margin-left: -12px;
    margin-right: -12px;
  }
}
.mine-profile-main {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}
.mine-profile-copy {
  flex: 1;
  min-width: 0;
}
.mine-nickname {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 20px;
  font-weight: 600;
  line-height: 24px;
}
.mine-bio {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 3px;
  font-size: 12px;
  line-height: 18px;
  color: rgba(255, 255, 255, 0.72);
}
.mine-edit {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 4px;
  font-size: 11px;
  line-height: 16px;
  color: rgba(255, 255, 255, 0.85);
}
.mine-profile :deep(.mine-settings-button) {
  flex-shrink: 0;
  width: 44px;
  padding: 0;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 12px;
  --wot-button-primary-color: #fff;
  --wot-button-primary-color-active: #eeecff;
}
.mine-tabs {
  margin: 12px 0 8px;
  --wot-tabs-nav-item-font-size: 14px;
  --wot-tabs-nav-item-padding: 10px 16px;
  --wot-tabs-nav-line-width: 24px;
}
:deep(.mine-phase) {
  --wot-segmented-padding: 3px;
  --wot-segmented-radius: 12px;
  --wot-segmented-item-padding: 5px 12px;
  --wot-segmented-item-line-height: 24px;
  --wot-segmented-item-font-size: 13px;
}
.mine-settings-sheet {
  padding: 24px 16px 0;
  max-height: 75vh;
  overflow-y: auto;
  background: var(--app-page);
  color: var(--app-ink);
}
.mine-settings-title {
  margin-bottom: 20px;
  font-size: 18px;
  line-height: 26px;
  font-weight: 600;
}
</style>
