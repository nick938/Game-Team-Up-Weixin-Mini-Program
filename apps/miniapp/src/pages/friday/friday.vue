<script setup lang="ts">
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { useWeeklyPlay } from '../../composables/useWeeklyPlay';
import { platform } from '../../platform/host';
import { teamDetailPath } from '../../utils/team-entry';
import { shareToFriend, shareToTimeline } from '../../utils/share';
import TeamResults from '../../components/team-results/index.vue';
defineOptions({ name: 'FridayPlayPage' });
const page = useWeeklyPlay(true);
const share = { title: '每周五 21:00，来开黑星球一起玩', path: '/pages/friday/friday', query: '' };
onShareAppMessage(() => shareToFriend(share));
onShareTimeline(() => shareToTimeline(share));
function open(input: { id?: string; gameName?: string }) {
  const url = teamDetailPath(input.id, input);
  if (url) platform.navigateTo({ url });
}
</script>
<template>
  <timeline-preview v-if="page.singlePage.value" />
  <app-shell v-else title="周五，一起开黑" subtitle="每周五 21:00 · 北京时间">
    <view v-if="page.state.error" class="panel"
      ><view class="text-sm mb-3">{{ page.state.error }}</view
      ><wd-button variant="soft" @click="page.load">重新加载</wd-button></view
    >
    <view v-else-if="!page.state.activity" class="panel"><wd-loading /> 正在加载本期活动</view>
    <template v-else>
      <view class="panel friday-feature">
        <image class="friday-art" src="/static/images/play-friday.png" mode="aspectFit" />
        <view class="brand-kicker">{{ page.state.activity.weekId }} · 周五 21:00</view>
        <view class="page-heading mt-3">{{
          page.state.activity.selectedGame?.name || '本周玩什么？交给好运气'
        }}</view>
        <view class="text-sm text-secondary mt-3">{{
          page.state.activity.selectedGame
            ? '本期随机游戏已揭晓！周五 21:00 一起玩，选一趟车加入，也欢迎自己当车头。'
            : '每周五 20:00，从常见联机游戏中等概率随机抽一款，21:00 一起开黑。不用投票，也能遇到新乐趣。'
        }}</view>
        <view class="hint mt-3"
          >候选包括
          {{
            page.state.activity.games
              .slice(0, 4)
              .map((game) => game.name)
              .join('、')
          }}
          等游戏。北京时间，每周一期。</view
        >
        <wd-button
          v-if="page.state.activity.selectedGame && page.now.value < page.state.activity.endAt"
          :loading="page.state.loading"
          :disabled="!page.canPublish.value"
          block
          custom-class="!mt-5"
          @click="page.publish"
          >发起本期游戏局</wd-button
        >
        <view v-else-if="!page.closed.value" class="friday-wait mt-4">周五 20:00 揭晓 · 21:00 开玩</view>
        <view v-else-if="page.state.activity.selectedGame" class="hint mt-4"
          >本期活动已结束，下一期周六开始征集。</view
        >
      </view>
      <view class="hint mb-4">想参加？挑选下面的队伍加入，按车头提供的方式进游戏。</view>
      <team-results
        v-if="page.state.activity.selectedGame"
        :teams="page.teams.state.filtered"
        :total="page.teams.state.total"
        :loading="page.teams.state.loading"
        :loading-more="page.teams.state.loadingMore"
        :has-more="page.teams.state.hasMore"
        :error="page.teams.state.listError"
        @open="open"
        @retry="page.teams.loadList()"
        @more="page.teams.loadMore"
        @clear="page.teams.loadList()"
        @publish="page.publish"
        :allow-publish="page.canPublish.value"
        hide-clear
        publish-label="发起本期游戏局"
      />
      <wd-button block variant="soft" open-type="share">分享本期周五开黑</wd-button>
    </template>
  </app-shell>
</template>
<style scoped>
.friday-feature {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #eeecff, #eaf0ff);
  border-color: #ded9ff;
}
.friday-art {
  position: absolute;
  right: -24px;
  top: -12px;
  width: 160px;
  height: 130px;
  opacity: 0.28;
  pointer-events: none;
}
.friday-feature > view,
.friday-feature :deep(.wd-button) {
  position: relative;
}
.friday-wait {
  padding: 12px;
  background: #fff8;
  border-radius: 12px;
  color: #6255e7;
  text-align: center;
  font-weight: 600;
}
</style>
