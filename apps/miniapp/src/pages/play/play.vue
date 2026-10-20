<script setup lang="ts">
import { computed, ref } from 'vue';
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { useDailyPlay } from '../../composables/useDailyPlay';
import { shareToFriend, shareToTimeline } from '../../utils/share';
defineOptions({ name: 'PlayVotePage' });
const page = useDailyPlay();
const showEditor = ref(false);
const dayStart = computed(() =>
  Date.parse(
    `${page.state.board?.dayId || new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)}T00:00:00+08:00`,
  ),
);
const options = computed(() =>
  [...(page.state.board?.options || [])].sort(
    (a, b) =>
      Number(a.expired || a.status === 'cancelled') - Number(b.expired || b.status === 'cancelled') ||
      b.createdAt - a.createdAt,
  ),
);
const share = { title: '今天玩啥？选游戏、约时间，够两人就发车', path: '/pages/play/play', query: '' };
onShareAppMessage(() => shareToFriend(share));
onShareTimeline(() => shareToTimeline(share));
function time(at: number) {
  const date = new Date(at + 8 * 3600000);
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}
</script>
<template>
  <timeline-preview v-if="page.singlePage.value" />
  <app-shell v-else title="今天玩啥" subtitle="把想玩的游戏放这里，等一个同频的搭子。">
    <view class="panel play-intro">
      <image class="play-art" src="/static/images/play-today.png" mode="aspectFill" />
      <view class="brand-kicker">TODAY'S PLAYLIST</view>
      <view class="section-title mt-2">想玩的，都可以安排</view>
      <view class="intro-copy">选游戏，约时间。至少 2 人想玩，就能一键发车。</view>
      <view class="hint mt-3">发车的人是车头，投过想玩的搭子自动上车；发车后还可以继续加入。</view>
    </view>
    <wd-button v-if="!showEditor" block custom-class="!mb-4" @click="showEditor = true"
      >＋ 添加想玩的游戏和时间</wd-button
    >
    <view v-else class="panel">
      <view class="section-title mb-3">＋ 添加我的想玩</view>
      <view class="hint mb-2">游戏名称</view>
      <wd-input
        v-model="page.form.gameName"
        placeholder="例如：双人成行、饥荒联机版"
        :maxlength="40"
        clearable
      />
      <view class="platforms">
        <wd-button
          v-for="item in ['Steam', '端游', '手游', '主机']"
          :key="item"
          size="small"
          :variant="page.form.platform === item ? 'solid' : 'soft'"
          @click="page.form.platform = item"
          >{{ item }}</wd-button
        >
      </view>
      <app-datetime-picker
        v-model="page.form.startAt"
        label="可以开始"
        :min-date="dayStart"
        :max-date="dayStart + 86400000 - 1"
      />
      <app-datetime-picker
        v-model="page.form.endAt"
        label="玩到几点"
        :min-date="page.form.startAt + 60000"
        :max-date="page.form.startAt + 86400000"
      />
      <view class="hint my-3"
        >北京时间 · 开始时间选今天，可添加多个游戏或不同时间的选项。创建后默认加入想玩。</view
      >
      <wd-button block :loading="page.state.busy" @click="page.create">添加想玩选项</wd-button>
      <wd-button block variant="text" @click="showEditor = false">收起，看看大家想玩什么</wd-button>
    </view>
    <view class="flex justify-between items-center mb-3">
      <text class="font-semibold">大家的想玩清单</text
      ><text class="hint">{{ page.state.board?.dayId || '今天' }}</text>
    </view>
    <view v-if="page.state.error" class="panel"
      ><view class="text-sm mb-3">{{ page.state.error }}</view
      ><wd-button variant="soft" @click="page.load">重新加载</wd-button></view
    >
    <view v-else-if="!page.state.board" class="panel"><wd-loading /> 正在寻找今天的搭子</view>
    <view v-if="page.state.board && !options.length" class="panel empty-play"
      ><view class="section-title">今天的第一局，等你提议</view
      ><view class="hint mt-2">在上面写下游戏和时间，邀请搭子来点「想玩」。</view></view
    >
    <view v-for="option in options" :key="option.id" class="panel play-option">
      <view class="flex items-center justify-between gap-2"
        ><view class="text-base font-semibold">{{ option.gameName }}</view
        ><text class="option-tag">{{ option.teamId ? '已发车' : '约局中' }}</text></view
      >
      <view class="text-sm text-secondary mt-2"
        >{{ option.platform }} · {{ time(option.startAt) }}–{{ time(option.endAt)
        }}{{
          option.endAt >= Date.parse(`${page.state.board?.dayId}T00:00:00+08:00`) + 86400000 ? '（次日）' : ''
        }}</view
      >
      <view class="intent-count mt-3"
        >{{ option.votes }} 人想玩<text v-if="option.teamId" class="hint">
          · {{ option.memberCount }}/{{ option.capacity }} 人在车上</text
        ></view
      >
      <view v-if="option.expired || option.status === 'cancelled'" class="hint mt-3">{{
        option.status === 'cancelled' ? '这趟车已散' : '这个时间段已结束'
      }}</view>
      <view v-else class="option-actions mt-3">
        <wd-button
          :variant="option.mine ? 'solid' : 'soft'"
          :disabled="page.state.busy"
          @click="page.vote(option)"
          >{{
            option.teamId
              ? option.joined
                ? '已上车 · 查看'
                : '想玩并上车'
              : option.mine
                ? '已想玩 · 取消'
                : '＋ 我想玩'
          }}</wd-button
        >
        <wd-button
          v-if="!option.teamId"
          variant="soft"
          :disabled="option.votes < 2 || page.state.busy"
          @click="page.launch(option)"
          >{{ option.votes >= 2 ? '一键发车' : '再等一位搭子' }}</wd-button
        >
        <wd-button v-else variant="text" @click="page.open(option.teamId)">查看这趟车 →</wd-button>
      </view>
      <view v-if="!option.teamId && option.votes >= 2" class="hint mt-3"
        >点击发车即成为车头，全部想玩的人自动上车。</view
      >
    </view>
    <wd-button block variant="soft" open-type="share">邀请搭子来选今天的游戏</wd-button>
    <profile-gate
      :show="page.showProfile.value"
      @close="page.showProfile.value = false"
      @done="page.profileDone"
    />
  </app-shell>
</template>
<style scoped>
.play-intro {
  position: relative;
  overflow: hidden;
  background: #eee9ff;
  padding-top: 24px;
}
.play-art {
  position: absolute;
  right: 0;
  top: 0;
  width: 160px;
  height: 100%;
  opacity: 0.4;
  pointer-events: none;
}
.play-intro > view {
  position: relative;
}
.intro-copy {
  max-width: 75%;
  margin-top: 12px;
  font-size: 14px;
  line-height: 1.7;
  color: #594b86;
}
.platforms,
.option-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.platforms {
  margin: 12px 0;
}
.option-tag {
  flex-shrink: 0;
  padding: 4px 8px;
  color: #6255e7;
  background: #eeecff;
  border-radius: 8px;
  font-size: 11px;
}
.intent-count {
  color: #6255e7;
  font-size: 14px;
  font-weight: 600;
}
.empty-play {
  text-align: center;
  padding: 28px 16px;
}
</style>
