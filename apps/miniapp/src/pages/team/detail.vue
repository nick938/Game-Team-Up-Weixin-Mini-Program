<script setup lang="ts">
import { pageThemeBackground, pageThemeStyle, pageThemeForeground } from '../../utils/app-theme';
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { usePageActive } from '../../composables/usePageActive';
const pageActive = usePageActive('pages/team/detail');
import { officialTeamLabel } from '../../utils/team-source';
import AppActionDock from '../../components/app-action-dock/index.vue';
import { useAppTheme } from '../../composables/useAppTheme';
import { reactive, computed } from 'vue';
import { useTeamDetail } from '../../composables/useTeamDetail';
import { useTeamPresentation } from '../../composables/useTeamPresentation';
defineOptions({ name: 'TeamDetailPage' });
useAppTheme();
const page = reactive(useTeamDetail());
const view = useTeamPresentation(
  () => page.team || {},
  () => page.role,
  () => {
    void page.loadDetail();
  },
);
const officialLabel = computed(() => officialTeamLabel(page.team || {}));
const seats = computed(() => {
  const members = [...page.members].sort((a, b) => Number(b.role === 'host') - Number(a.role === 'host'));
  const capacity = Number(page.team?.capacity);
  const count = Number(page.team?.memberCount);
  const total =
    Number.isInteger(capacity) && capacity >= 2 && capacity <= 20
      ? Math.max(capacity, Math.min(members.length, 20))
      : Math.min(members.length, 20);
  const occupied = Number.isInteger(count) && count >= 0 && count <= total ? count : members.length;
  return Array.from({ length: total }, (_, index) => ({
    member: members[index],
    occupied: index < occupied || Boolean(members[index]),
  }));
});
// Keep native share hook registration in the page SFC for uni compilation.
onShareAppMessage(page.shareAppMessage);
onShareTimeline(page.shareTimeline);
</script>
<template>
  <page-meta :page-style="pageThemeStyle" :background-color="pageThemeBackground">
    <navigation-bar :front-color="pageThemeForeground" :background-color="pageThemeBackground" />
  </page-meta>
  <page-navigation title="组队详情" />
  <timeline-preview v-if="page.singlePage" />
  <app-shell :active="pageActive" v-else variant="detail">
    <template v-if="page.team">
      <view class="panel detail-summary">
        <view class="detail-summary-heading">
          <view class="detail-game-name">{{ page.team.gameName }}</view>
          <text
            class="room-status"
            :class="
              view.tone === 'open'
                ? 'bg-success-soft text-success'
                : view.tone === 'full'
                  ? 'bg-brand-light text-brand'
                  : 'bg-surface-muted text-secondary'
            "
            >{{ view.recruitment === 'open' && !page.team.pendingHost ? '招募中' : view.statusLabel }}</text
          >
        </view>
        <view v-if="page.team.timeText" class="detail-time">
          <wd-icon name="time-line" size="16px" />
          <text class="detail-time-text">{{ page.team.timeText }}</text>
        </view>
        <view v-if="view.timeLabel || officialLabel" class="detail-summary-meta">
          <text v-if="view.timeLabel" class="hint">{{ view.timeLabel }}</text>
          <text v-if="officialLabel" class="official-badge">{{ officialLabel }}</text>
        </view>
        <view v-if="page.team.pendingHost && view.ongoing" class="hint mt-3">
          接手后，你会成为这局的车头。
        </view>
        <view v-if="page.team.proxyNickName" class="hint mt-3">由 {{ page.team.proxyNickName }} 代开</view>
      </view>
      <view v-if="page.state.changeNotice" class="panel !bg-brand-light text-sm">{{
        page.state.changeNotice
      }}</view>
      <view v-if="seats.length" class="panel detail-seating">
        <view class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <view class="section-title">队伍座位</view>
          <text
            v-if="page.state.joinSuccess && page.role === 'member' && view.ongoing"
            class="text-sm text-success"
            >加入成功</text
          >
          <text v-else-if="page.members.length" class="hint">点头像看资料</text>
        </view>
        <view class="detail-seats" :style="{ '--seat-columns': Math.min(4, seats.length) }">
          <view v-for="(seat, index) in seats" :key="index" class="detail-seat">
            <template v-if="seat.member">
              <wd-button
                variant="text"
                custom-class="!p-0 !h-auto"
                :aria-label="'查看' + (seat.member.nickName || '玩家') + '的资料'"
                @click="page.onMemberProfile(seat.member._id)"
              >
                <wd-avatar
                  size="44px"
                  shape="square"
                  mode="aspectFill"
                  :src="seat.member.avatarUrl || '/static/images/avatar.png'"
                />
              </wd-button>
              <view class="text-xs truncate mt-1">{{ seat.member.nickName || '玩家' }}</view>
              <view v-if="seat.member.role === 'host'" class="text-xs text-brand">车头</view>
            </template>
            <template v-else>
              <view class="detail-seat-placeholder" :class="{ 'detail-seat-occupied': seat.occupied }">
                <wd-icon :name="seat.occupied ? 'user' : 'user-add'" size="18px" />
              </view>
              <view class="hint mt-1">{{ seat.occupied ? '已入座' : '空位' }}</view>
            </template>
          </view>
        </view>
      </view>
      <view v-if="page.wechatSubscription && page.role && view.ongoing" class="panel detail-inline-row">
        <view class="min-w-0">
          <view class="text-sm font-semibold">开打提醒</view>
          <view class="hint mt-1">
            {{
              page.notifyHint ||
              (page.role === 'host'
                ? '授权后可在开打前约 10 分钟收到微信提醒。'
                : '开始前 10 分钟内上车可能赶不上提醒。')
            }}
          </view>
        </view>
        <wd-button
          size="small"
          variant="soft"
          :loading="page.state.requestingNotify"
          :disabled="page.notifyAuthorized"
          @click="page.onEnableNotify"
          >{{ page.notifyAuthorized ? '已授权' : '提醒我' }}</wd-button
        >
      </view>
      <app-action-dock v-if="view.ongoing || (page.role === 'host' && view.confirmed)" :active="pageActive">
        <view class="detail-dock-actions">
          <view class="min-w-0 flex-1">
            <wd-button
              v-if="view.primaryAction === 'join'"
              block
              :loading="page.state.joining"
              :disabled="page.state.joining"
              @click="page.onJoin"
              >{{
                page.team.pendingHost ? '我来发车' : view.lifecycle === 'active' ? '中途加入' : '加入队伍'
              }}</wd-button
            >
            <wd-button v-else-if="view.primaryAction === 'share'" block open-type="share">分享招人</wd-button>
            <wd-button
              v-else-if="view.primaryAction === 'room' && page.role === 'host'"
              block
              :disabled="page.state.mutating"
              @click="page.onManage"
              >管理队伍</wd-button
            >
            <wd-button v-else-if="view.primaryAction === 'room'" block open-type="share">分享队伍</wd-button>
            <wd-button v-else-if="view.ongoing" block open-type="share">分享</wd-button>
            <wd-button v-else block @click="page.onRepublish">再发一趟</wd-button>
          </view>
          <wd-button
            v-if="view.primaryAction === 'share'"
            variant="soft"
            :disabled="page.state.mutating"
            @click="page.onManage"
            >管理队伍</wd-button
          >
          <wd-button
            v-else-if="
              view.primaryAction === 'join' || (view.primaryAction === 'room' && page.role === 'host')
            "
            variant="soft"
            open-type="share"
            >分享</wd-button
          >
        </view>
      </app-action-dock>
      <view v-if="view.ongoing && page.role === 'member'" class="flex flex-wrap gap-2 mt-3">
        <wd-button
          variant="text"
          size="small"
          type="danger"
          :loading="page.state.mutating"
          @click="page.onLeave"
          >下车</wd-button
        >
      </view>
    </template>
    <view v-else-if="page.loading" class="panel" aria-label="正在加载队伍"
      ><wd-skeleton
        animation="gradient"
        :row-col="[
          { width: '160px', height: '24px' },
          { width: '100%', height: '16px' },
          { width: '100%', height: '48px' },
        ]"
    /></view>
    <view v-else class="panel text-center">
      <wd-empty
        :tip="
          page.state.detailError
            ? page.state.detailNotFound
              ? '找不到这趟队伍'
              : '暂时无法加载队伍'
            : '链接不完整，请让车头重新分享'
        "
      />
      <view v-if="page.state.detailError && !page.state.detailNotFound" class="hint mb-4">{{
        page.state.detailError
      }}</view>
      <wd-button
        v-if="page.teamId && !page.state.detailNotFound"
        block
        variant="soft"
        custom-class="!mb-3"
        @click="page.loadDetail"
        >重新加载</wd-button
      >
    </view>
    <team-manage-sheet
      v-if="page.role === 'host'"
      :show="page.showManage"
      @close="page.closeManage"
      @action="page.onManageAction"
    />
    <member-profile-sheet
      :show="page.showMemberProfile"
      :loading="page.memberProfileLoading"
      :user="page.memberProfile"
      :error="page.memberProfileError"
      @close="page.closeMemberProfile"
      @retry="page.loadMemberProfile"
    />
    <profile-gate :show="page.showProfile" @done="page.onProfileDone" @close="page.onProfileClose" />
    <entry-notices />
  </app-shell>
  <canvas
    v-if="page.team"
    type="2d"
    id="shareCover"
    class="fixed -left-[2000px] top-0 w-[375px] h-[300px] pointer-events-none"
  />
</template>

<style scoped>
.detail-summary {
  background: var(--app-surface);
}
.detail-summary-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.detail-game-name {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 23px;
  font-weight: 700;
  line-height: 1.25;
}
.detail-time {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 9px;
  color: var(--app-secondary);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
}
.detail-time-text {
  min-width: 0;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
.detail-summary-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  margin-top: 10px;
}
.detail-seats {
  display: grid;
  grid-template-columns: repeat(var(--seat-columns), minmax(0, 1fr));
  gap: 14px 8px;
}
.detail-seat {
  min-width: 0;
  text-align: center;
}
.detail-seat-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin: 0 auto;
  box-sizing: border-box;
  border: 1px dashed var(--app-control-border);
  border-radius: 12px;
  background: var(--app-surface-muted);
  color: var(--app-muted);
}
.detail-seat-occupied {
  border-style: solid;
  background: var(--app-brand-light);
  color: var(--app-brand-pressed);
}
.detail-inline-row,
.detail-dock-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.official-badge {
  padding: 4px 8px;
  border-radius: 6px;
  color: var(--app-brand);
  background: var(--app-brand-light);
  font-size: 12px;
  font-weight: 600;
}
</style>
