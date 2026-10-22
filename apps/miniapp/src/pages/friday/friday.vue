<script setup lang="ts">
import { cardShareFromEvent } from '../../utils/card-share';
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { useUserRankings } from '../../composables/useUserRankings';
import { shareToFriend, shareToTimeline } from '../../utils/share';
defineOptions({ name: 'UserRankingsPage' });
const page = useUserRankings();
const podium = [1, 0, 2];
const share = { title: '谁是开黑达人？来看看发车、上车前十名', path: '/pages/friday/friday', query: '' };
onShareAppMessage((event) => cardShareFromEvent(event) || shareToFriend(share));
onShareTimeline(() => shareToTimeline(share));
</script>
<template>
  <page-navigation title="用户排行" />
  <timeline-preview v-if="page.singlePage.value" />
  <app-shell v-else>
    <view class="ranking-heading"
      ><view class="page-heading">用户排行</view><text class="top-badge">TOP 10</text></view
    >
    <view class="page-caption mb-6">每一次发车和上车，都让开黑更热闹。</view>
    <view class="ranking-switch">
      <wd-button :variant="page.mode.value === 'hosted' ? 'base' : 'soft'" @click="page.mode.value = 'hosted'"
        >发车榜</wd-button
      >
      <wd-button :variant="page.mode.value === 'joined' ? 'base' : 'soft'" @click="page.mode.value = 'joined'"
        >上车榜</wd-button
      >
    </view>
    <view class="hint mb-4"
      >累计排行 ·
      {{
        page.mode.value === 'hosted' ? '已完成发车的队伍数' : '加入其他车头的队伍数，同一队伍只计一次'
      }}</view
    >
    <view v-if="page.state.error" class="panel"
      ><view class="text-sm mb-3">{{ page.state.error }}</view
      ><wd-button variant="soft" @click="page.load">重新加载</wd-button></view
    >
    <view v-else-if="page.state.loading && !page.state.loaded" class="panel"
      ><wd-loading /> 正在统计开黑达人</view
    >
    <template v-else>
      <view class="podium" aria-label="用户排行前三名">
        <view
          v-for="place in podium"
          :key="place"
          class="podium-seat"
          :class="`podium-${place}`"
          :role="page.rows.value[place] ? 'button' : undefined"
          :aria-label="
            page.rows.value[place] ? '查看' + page.rows.value[place].nickName + '的资料' : undefined
          "
          @click="page.openProfile(page.rows.value[place])"
        >
          <view class="medal">{{ ['👑', '🥈', '🥉'][place] }}</view>
          <wd-avatar
            v-if="page.rows.value[place]"
            :src="page.rows.value[place].avatarUrl || '/static/images/avatar.png'"
            size="medium"
          />
          <view v-else class="empty-avatar">?</view>
          <view class="podium-name">{{ page.rows.value[place]?.nickName || '虚位以待' }}</view>
          <view class="podium-count">{{ page.rows.value[place]?.count || 0 }}<text> 次</text></view>
          <view class="podium-base">{{ ['冠军', '亚军', '季军'][place] }}</view>
        </view>
      </view>
      <view v-if="!page.rows.value.length" class="panel empty-ranking"
        ><view class="section-title">宝座等你来坐</view
        ><view class="hint mt-2">{{
          page.mode.value === 'hosted' ? '完成一次发车，就有机会登榜。' : '加入一趟队伍，和搭子一起开玩。'
        }}</view></view
      >
      <view
        v-for="(user, index) in page.rows.value.slice(3)"
        :key="user.userKey"
        class="panel ranking-row"
        role="button"
        :aria-label="'查看' + user.nickName + '的资料'"
        @click="page.openProfile(user)"
      >
        <text class="rank-number">{{ index + 4 }}</text>
        <wd-avatar :src="user.avatarUrl || '/static/images/avatar.png'" size="small" />
        <text class="user-name">{{ user.nickName }}</text>
        <text class="user-count">{{ user.count }}<text> 次</text></text>
      </view>
      <view class="hint my-4"
        >系统待发车不计入发车榜；车头不重复计入上车榜。历史已退出且没有留下记录的上车无法追溯。</view
      >
      <wd-button block variant="soft" open-type="share">分享开黑达人榜</wd-button>
    </template>
    <member-profile-sheet
      :show="!!page.profile.value"
      :loading="false"
      :user="page.profile.value"
      error=""
      @close="page.profile.value = null"
    />
  </app-shell>
  <canvas
    type="2d"
    id="cardShareCover"
    class="fixed -left-[2000px] top-0 w-[375px] h-[300px] pointer-events-none"
  />
</template>
<style scoped>
.ranking-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.top-badge {
  padding: 4px 9px;
  border-radius: 8px;
  color: #6255e7;
  background: #eeeaff;
  font-size: 12px;
  font-weight: 700;
}
.ranking-switch {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.ranking-switch > :deep(view) {
  flex: 1;
}
.podium {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin: 28px 0 14px;
}
.podium-seat {
  flex: 1;
  min-width: 0;
  text-align: center;
  padding: 12px 6px 0;
  border-radius: 18px 18px 10px 10px;
  background: #f0eef7;
}
.podium-0 {
  background: #fff2d1;
  padding-top: 24px;
}
.podium-2 {
  background: #f9e9df;
}
.medal {
  font-size: 28px;
  margin-bottom: 10px;
}
.empty-avatar {
  margin: auto;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #fff8;
  line-height: 40px;
  color: #a49bb3;
}
.podium-name {
  margin-top: 10px;
  height: 40px;
  line-height: 20px;
  font-size: 13px;
  font-weight: 600;
  overflow-wrap: anywhere;
  overflow: hidden;
}
.podium-count {
  color: #6255e7;
  font-size: 24px;
  font-weight: 700;
  margin: 10px 0;
}
.podium-count text {
  font-size: 12px;
  font-weight: 400;
}
.podium-base {
  margin: 0 -6px;
  padding: 12px 0;
  border-radius: 0 0 10px 10px;
  background: #ded9ef;
  color: #594b86;
  font-size: 13px;
  font-weight: 600;
}
.podium-0 .podium-base {
  padding: 20px 0;
  background: #f7d982;
  color: #765512;
}
.podium-2 .podium-base {
  padding: 8px 0;
  background: #ebc5ac;
  color: #75543f;
}
.ranking-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
}
.rank-number {
  width: 24px;
  flex-shrink: 0;
  font-weight: 700;
  color: #a49bb3;
}
.user-name {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 14px;
}
.user-count {
  flex-shrink: 0;
  color: #6255e7;
  font-weight: 700;
  font-size: 18px;
}
.user-count text {
  font-size: 12px;
  font-weight: 400;
}
.empty-ranking {
  text-align: center;
  padding: 28px 16px;
}
</style>
