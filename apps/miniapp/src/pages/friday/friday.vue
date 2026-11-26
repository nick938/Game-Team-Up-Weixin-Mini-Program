<script setup lang="ts">
import { pageThemeBackground, pageThemeStyle, pageThemeForeground } from '../../utils/app-theme';
import { computed } from 'vue';
import { cardShareFromEvent } from '../../utils/card-share';
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { useUserRankings } from '../../composables/useUserRankings';
import { shareToFriend, shareToTimeline } from '../../utils/share';
defineOptions({ name: 'UserRankingsPage' });
const page = useUserRankings();
const modes = [
  { value: 'hosted', payload: { label: '发车榜', icon: 'send' } },
  { value: 'joined', payload: { label: '上车榜', icon: 'user-group' } },
];
const hosted = computed(() => page.mode.value === 'hosted');
const podium = computed(() =>
  [1, 0, 2].map((index) => ({ rank: index + 1, user: page.rows.value[index] })).filter(({ user }) => user),
);
const share = { title: '谁是开黑达人？来看看发车、上车前十名', path: '/pages/friday/friday', query: '' };
onShareAppMessage((event) => cardShareFromEvent(event) || shareToFriend(share));
onShareTimeline(() => shareToTimeline(share));
</script>
<template>
  <page-meta :page-style="pageThemeStyle" :background-color="pageThemeBackground">
    <navigation-bar :front-color="pageThemeForeground" :background-color="pageThemeBackground" />
  </page-meta>
  <page-navigation title="用户排行" />
  <timeline-preview v-if="page.singlePage.value" />
  <app-shell v-else>
    <wd-segmented
      :value="page.mode.value"
      :options="modes"
      custom-class="ranking-switch !flex !w-full"
      @change="page.mode.value = $event.value === 'joined' ? 'joined' : 'hosted'"
    >
      <template #label="{ option }">
        <view class="ranking-switch-label">
          <wd-icon :name="option.payload.icon" size="16px" />
          <text>{{ option.payload.label }}</text>
        </view>
      </template>
    </wd-segmented>
    <view class="ranking-stage">
      <view class="ranking-stage-heading">
        <view class="ranking-stage-visual" aria-hidden="true">
          <image class="ranking-stage-art" src="/static/images/home-rankings.png" mode="aspectFill" />
          <view class="ranking-stage-shade" />
        </view>
        <view class="ranking-stage-copy">
          <view class="ranking-stage-caption">累计前十</view>
          <view class="ranking-stage-title">{{ hosted ? '发车榜' : '上车榜' }}</view>
          <view class="ranking-stage-description">
            {{ hosted ? '已完成发车的队伍数' : '加入其他车头的队伍数，同一队伍只计一次' }}
          </view>
        </view>
      </view>
      <view v-if="!page.state.error && podium.length" class="podium" aria-label="用户排行前三名">
        <button
          v-for="{ rank, user } in podium"
          :key="user.userKey"
          class="podium-seat"
          :class="'podium-seat-' + rank"
          :aria-label="'第 ' + rank + ' 名，' + user.nickName + '，' + user.count + ' 次，查看资料'"
          @click="page.openProfile(user)"
        >
          <view class="podium-avatar">
            <wd-avatar
              :src="user.avatarUrl || '/static/images/avatar.png'"
              :size="rank === 1 ? '61px' : '46px'"
              mode="aspectFill"
            />
            <text class="podium-rank">{{ rank }}</text>
          </view>
          <text class="podium-name">{{ user.nickName }}</text>
          <view class="podium-count">{{ user.count }}<text> 次</text></view>
        </button>
      </view>
    </view>
    <view v-if="page.state.error" class="panel ranking-status">
      <view class="text-sm mb-3">{{ page.state.error }}</view>
      <wd-button variant="soft" @click="page.load">重新加载</wd-button>
    </view>
    <view v-else-if="page.state.loading && !page.state.loaded" class="panel ranking-status">
      <wd-loading /> 正在加载榜单
    </view>
    <template v-else>
      <view v-if="!page.rows.value.length" class="panel ranking-status">
        <view class="section-title">暂时还没有人上榜</view>
        <view class="hint mt-2">
          {{ hosted ? '完成一次发车，就有机会登榜。' : '加入一趟队伍，就有机会登榜。' }}
        </view>
      </view>
      <view v-if="page.rows.value.length > 3" class="ranking-list">
        <view class="ranking-list-heading">
          <text>更多上榜玩家</text>
          <text class="ranking-list-unit">{{ hosted ? '发车数' : '上车数' }}</text>
        </view>
        <button
          v-for="(user, index) in page.rows.value.slice(3)"
          :key="user.userKey"
          class="ranking-row"
          :aria-label="'第 ' + (index + 4) + ' 名，' + user.nickName + '，' + user.count + ' 次，查看资料'"
          @click="page.openProfile(user)"
        >
          <text class="rank-number">{{ index + 4 }}</text>
          <wd-avatar :src="user.avatarUrl || '/static/images/avatar.png'" size="34px" mode="aspectFill" />
          <text class="user-name">{{ user.nickName }}</text>
          <text class="user-count">{{ user.count }}</text>
        </button>
      </view>
      <view class="ranking-footnote">
        {{ hosted ? '系统待发车不计入发车榜。' : '车头不计入上车榜。已退出且没有留下记录的上车无法追溯。' }}
      </view>
      <wd-button block variant="soft" open-type="share">分享榜单</wd-button>
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
:deep(.ranking-switch) {
  margin-bottom: 12px;
  box-sizing: border-box;
  --wot-segmented-bg: var(--app-surface-muted);
  --wot-segmented-item-color: var(--app-secondary);
  --wot-segmented-item-color-active: var(--app-brand-pressed);
}
.ranking-switch-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 30px;
}
.ranking-stage {
  margin-bottom: 14px;
  overflow: hidden;
  border-radius: 22px;
  background:
    radial-gradient(ellipse at 73% 42%, #4c3d85, transparent 69%),
    linear-gradient(155deg, #27214e 0%, #231d40 80%);
  color: #f9f7ff;
  box-shadow: 0 10px 24px rgba(46, 31, 104, 0.14);
}
.ranking-stage-heading {
  position: relative;
  min-height: 132px;
  overflow: hidden;
  box-sizing: border-box;
}
.ranking-stage-visual {
  position: absolute;
  inset: 0;
  -webkit-mask-image: linear-gradient(#000 50%, transparent);
  mask-image: linear-gradient(#000 50%, transparent);
}
.ranking-stage-art {
  position: absolute;
  top: 0;
  right: 0;
  width: min(68%, 290px);
  height: 100%;
}
.ranking-stage-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #28214e 0%, #28214e 28%, rgba(40, 33, 78, 0.85) 42%, transparent 73%);
}
.ranking-stage-copy {
  position: relative;
  width: 64%;
  padding: 16px 0 12px 16px;
  box-sizing: border-box;
}
.ranking-stage-caption {
  color: #e4d9ff;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
}
.ranking-stage-title {
  margin: 3px 0 4px;
  font-size: 28px;
  line-height: 34px;
  font-weight: 750;
}
.ranking-stage-description {
  max-width: 160px;
  color: #e2dbf7;
  font-size: 12px;
  line-height: 17px;
}
.podium {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 6px;
  padding: 4px 10px 13px;
}
.podium-seat,
.ranking-row {
  margin: 0;
  border: 0;
  box-sizing: border-box;
  text-align: left;
}
.podium-seat::after,
.ranking-row::after {
  border: 0;
}
.podium-seat {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  max-width: 148px;
  padding: 11px 4px 10px;
  border: 1px solid rgba(214, 204, 255, 0.2);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(198, 183, 245, 0.18), rgba(198, 183, 245, 0.07));
  color: #f4efff;
  line-height: 1.35;
  --medal-light: #eee9ff;
  --medal-dark: #b0a5cf;
  --medal-text: #3b2e51;
}
.podium-seat-1 {
  padding-top: 14px;
  border-color: rgba(255, 223, 149, 0.56);
  background: linear-gradient(180deg, rgba(250, 207, 111, 0.23), rgba(228, 169, 72, 0.1));
  --medal-light: #fff2b7;
  --medal-dark: #e9ad50;
  --medal-text: #50331b;
}
.podium-seat-3 {
  border-color: rgba(250, 201, 180, 0.22);
  background: linear-gradient(180deg, rgba(229, 163, 130, 0.19), rgba(229, 163, 130, 0.07));
  --medal-light: #ffd9bd;
  --medal-dark: #d59170;
  --medal-text: #4e2d30;
}
.podium-avatar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
  padding: 2px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--medal-light), var(--medal-dark));
}
.podium-rank {
  position: absolute;
  left: 50%;
  bottom: -8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  transform: translateX(-50%);
  border: 2px solid #392b5f;
  border-radius: 50%;
  background: linear-gradient(145deg, var(--medal-light), var(--medal-dark));
  color: var(--medal-text);
  font-size: 12px;
  font-weight: 750;
}
.podium-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
}
.podium-count,
.user-count {
  font-variant-numeric: tabular-nums;
}
.podium-count {
  margin-top: 4px;
  max-width: 100%;
  overflow-wrap: anywhere;
  font-size: 21px;
  font-weight: 700;
  line-height: 1.2;
}
.podium-seat-1 .podium-count {
  color: #ffdd8b;
  font-size: 26px;
}
.podium-count text {
  font-size: 11px;
  font-weight: 500;
}
.ranking-status {
  padding: 24px 16px;
  text-align: center;
}
.ranking-list {
  overflow: hidden;
  padding: 3px 13px 1px;
  border: 1px solid var(--app-border);
  border-radius: 18px;
  background: var(--app-surface);
}
.ranking-list-heading,
.ranking-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ranking-list-heading {
  justify-content: space-between;
  padding: 10px 3px 9px;
  font-size: 14px;
  font-weight: 700;
}
.ranking-list-unit {
  flex-shrink: 0;
  color: var(--app-secondary);
  font-size: 11px;
  font-weight: 500;
}
.ranking-row {
  width: 100%;
  min-height: 54px;
  padding: 8px 3px;
  border-top: 1px solid var(--app-border);
  border-radius: 0;
  background: transparent;
  color: var(--app-ink);
  line-height: 1.35;
}
.podium-seat:active,
.ranking-row:active {
  opacity: 0.76;
}
.rank-number {
  width: 23px;
  flex-shrink: 0;
  color: var(--app-secondary);
  font-size: 13px;
  font-weight: 650;
  text-align: center;
}
.user-name {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 14px;
}
.user-count {
  flex-shrink: 0;
  color: var(--app-brand-pressed);
  font-weight: 700;
  font-size: 16px;
}
.ranking-footnote {
  margin: 12px 2px 14px;
  color: var(--app-secondary);
  font-size: 12px;
  line-height: 18px;
}
</style>
