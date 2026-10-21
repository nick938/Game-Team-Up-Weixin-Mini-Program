<script setup lang="ts">
import { ref } from 'vue';
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { useDailyPlay } from '../../composables/useDailyPlay';
import { shareToFriend, shareToTimeline } from '../../utils/share';
defineOptions({ name: 'PlayVotePage' });
const page = useDailyPlay();
const showRules = ref(false);
const podium = [1, 0, 2];
const share = { title: '今天玩啥？投想玩，随时自己发一车', path: '/pages/play/play', query: '' };
onShareAppMessage(() => shareToFriend(share));
onShareTimeline(() => shareToTimeline(share));
</script>
<template>
  <page-navigation title="今天玩啥" />
  <timeline-preview v-if="page.singlePage.value" />
  <app-shell v-else>
    <view class="play-content">
      <view class="play-heading">
        <view class="page-heading">大家今天想玩啥</view>
      </view>
      <view class="play-caption">全天投票，选好游戏就能自己发车。</view>
      <view v-if="page.state.error" class="panel"
        ><view class="text-sm mb-3">{{ page.state.error }}</view
        ><wd-button variant="soft" @click="page.load">重新加载</wd-button></view
      >
      <view v-else-if="!page.state.board" class="panel"><wd-loading /> 正在收集大家的想玩</view>
      <template v-if="page.state.board">
        <view class="podium" aria-label="今天想玩游戏前三名">
          <view v-for="place in podium" :key="place" class="podium-seat" :class="`podium-${place}`">
            <view class="podium-label">{{ ['👑 冠军', '🥈 亚军', '🥉 季军'][place] }}</view>
            <view class="podium-name">{{ page.options.value[place]?.gameName || '等你来发起' }}</view>
            <view class="podium-count">{{ page.options.value[place]?.votes || 0 }}<text> 票</text></view>
          </view>
        </view>
        <view class="list-heading"
          ><text class="section-title">全部游戏投票</text
          ><text class="hint">{{ page.options.value.length }} 个投票 · 实时排序</text></view
        >
        <view v-if="!page.options.value.length" class="panel empty-play">
          <view class="section-title">还没有投票，发起一个吧</view>
          <view class="hint mt-2 mb-4">点下方「发起投票」，填个游戏名，邀请群友一起选。</view>
        </view>
        <view v-for="(option, index) in page.options.value" :key="option.id" class="panel play-option">
          <view class="option-main"
            ><text class="rank-number" :class="{ 'rank-top': index < 3 }">{{ index + 1 }}</text
            ><view class="option-name">{{ option.gameName }}</view
            ><text class="vote-count">{{ option.votes }}<text> 票</text></text></view
          >
          <view class="option-actions">
            <wd-button
              block
              size="small"
              :variant="option.mine ? 'soft' : 'base'"
              :disabled="page.state.busy"
              @click="page.vote(option)"
              >{{ option.mine ? '已投票 · 取消' : '＋ 投一票' }}</wd-button
            >
            <wd-button block size="small" variant="soft" @click="page.launch(option)">发一车 →</wd-button>
          </view>
        </view>
        <view v-if="page.options.value.length" class="hint mb-5"
          >投票不占座；点「发一车」，时间、人数由你自己定。</view
        >
        <view class="rules-toggle" role="button" @click="showRules = !showRules"
          >{{ showRules ? '收起规则' : '投票规则' }} <text>{{ showRules ? '⌃' : '⌄' }}</text></view
        >
        <view v-if="showRules" class="panel rules-copy">
          <view>全天都能发起投票、给多个游戏投票，也能随时自己发车。同一款游戏每人一票，再点可取消。</view>
          <view
            >官方每天16:00选出一辆车，在大厅查看，21:00–23:00开玩。有票选当时冠军，无票从历史车随机选；之后仍可继续投票。</view
          >
          <view>点游戏下方的「发一车」，自己选择时间和人数。并列票数按发起投票的时间排序。</view>
        </view>
      </template>
    </view>
    <view v-if="!page.showEditor.value && !page.showProfile.value" class="vote-action-dock">
      <view class="vote-action-inner">
        <wd-button block variant="soft" open-type="share">邀请群友投票</wd-button>
        <wd-button block @click="page.showEditor.value = true">＋ 发起投票</wd-button>
      </view>
    </view>
    <wd-popup
      :z-index="1100"
      v-model="page.showEditor.value"
      position="center"
      closable
      custom-style="width: calc(100% - 40px); max-width: 420px; border-radius: 20px;"
      :close-on-click-modal="!page.state.busy"
    >
      <view class="proposal-editor">
        <view class="section-title mb-4">发起游戏投票</view>
        <view class="text-sm mb-2">游戏名称</view>
        <wd-input v-model="page.form.gameName" placeholder="例如：饥荒联机版" :maxlength="40" clearable />
        <view class="hint my-4"
          >每个游戏每人一票，可以支持多个游戏。同名游戏会合并，发起后默认给自己投一票。</view
        >
        <wd-button block :loading="page.state.busy" @click="page.create">发起投票</wd-button>
      </view>
    </wd-popup>
    <profile-gate
      :show="page.showProfile.value"
      @close="page.showProfile.value = false"
      @done="page.profileDone"
    />
  </app-shell>
</template>
<style scoped>
.play-content {
  padding-bottom: calc(90px + env(safe-area-inset-bottom));
}
.vote-action-dock {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 90;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: #f4f5f8;
  border-top: 1px solid rgba(98, 85, 231, 0.08);
}
.vote-action-inner {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 12px;
  max-width: 528px;
  margin: 0 auto;
}
.play-heading .page-heading {
  font-size: 21px;
}
.play-caption {
  margin: 8px 0 20px;
  color: #7d748d;
  font-size: 13px;
  line-height: 1.6;
}
.proposal-editor {
  padding: 28px 20px 24px;
}
.podium {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-bottom: 22px;
}
.podium-seat {
  flex: 1;
  min-width: 0;
  padding: 10px 8px;
  border-radius: 12px;
  background: #eeebf6;
  text-align: center;
}
.podium-0 {
  background: #fff0c9;
  padding-top: 17px;
  padding-bottom: 14px;
}
.podium-2 {
  background: #f7e8de;
}
.podium-label {
  font-size: 11px;
  color: #7b688b;
}
.podium-0 .podium-label {
  color: #8b6416;
}
.podium-name {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  height: 36px;
  overflow: hidden;
  overflow-wrap: anywhere;
  line-height: 18px;
  margin: 6px 0;
  font-size: 12px;
  font-weight: 600;
}
.podium-count {
  color: #6255e7;
  font-size: 18px;
  font-weight: 700;
}
.podium-count text {
  font-size: 11px;
  font-weight: 400;
}
.list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}
.empty-play {
  padding: 22px 18px;
}
.empty-play .section-title {
  font-size: 15px;
}
.play-option {
  padding: 16px;
}
.option-main {
  display: flex;
  align-items: center;
  gap: 10px;
}
.rank-number {
  width: 20px;
  color: #a49bb3;
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
}
.rank-top {
  color: #6255e7;
}
.option-name {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 15px;
  font-weight: 600;
}
.vote-count {
  flex-shrink: 0;
  color: #6255e7;
  font-size: 18px;
  font-weight: 700;
}
.vote-count text {
  color: #93899f;
  font-size: 11px;
  font-weight: 400;
}
.option-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 14px;
}
.rules-toggle {
  display: flex;
  justify-content: center;
  gap: 8px;
  color: #93899f;
  font-size: 12px;
  padding: 4px 0 16px;
}
.rules-copy {
  color: #7d748d;
  font-size: 12px;
  line-height: 1.7;
}
.rules-copy > view + view {
  margin-top: 10px;
}
</style>
