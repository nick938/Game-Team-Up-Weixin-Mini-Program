<script>
import { eventWithDataset } from "../../utils/state";
import { platform } from "../../platform/host";
import { updateState } from "../../utils/state";
import { usableTeamId } from "../../utils/team-entry";

export default {
props:{
    team: {
      type: Object,
      default: () => ({}),
    },
    teamId: {
      type: String,
      default: "",
    },
    mark: {
      type: String,
      default: "",
    },
  },
data(){return {}},
methods:{eventWithDataset, setData: updateState, ...{
    onTap() {
      const team = this.team || {};
      const id = usableTeamId(this.teamId || team.id || team._id);
      if (!id) return;
      this.$emit("open", { id, gameName: team.gameName || "" });
    },
  }}
};
</script>
<template>
<view class="card" hover-class="card-pressed" @tap.stop.prevent="onTap(eventWithDataset($event, {}))">
  <view class="top">
    <view class="game">{{team.gameName}}<text v-if="team.rankReq" class="game-extra"> · {{team.rankReq}}</text></view>
    <view :class="'status status-' + (team.displayStatus)">
      <template v-if="team.displayStatus === 'recruiting' && team.needCount > 0">缺{{team.needCount}}人</template>
      <template v-else>{{team.statusText}}</template>
    </view>
  </view>
  <view class="meta">{{team.timeText}}</view>
  <view class="tags">
    <text v-if="team.platform" class="tag">{{team.platform}}</text>
    <text v-if="team.voice && team.voice !== '不限'" class="tag">{{team.voice}}</text>
    <text v-if="team.server" class="tag">{{team.server}}</text>
    <text v-if="team.started" class="tag started">进行中</text>
    <text v-else-if="team.soon" class="tag soon">即将开始</text>
  </view>
  <view class="bottom">
    <view class="count"><text class="count-current">{{team.memberCount}}</text><text class="count-total"> / {{team.capacity}} 人</text></view>
    <view class="mark" v-if="mark">{{mark}}</view>
    <view class="card-action">查看队伍</view>
  </view>
</view>

</template>
<style scoped>
.card { padding: 28rpx; margin-bottom: 20rpx; background: #fff; border-radius: 28rpx; border: 1rpx solid #e9ebf3; }
.card-pressed { background: #f0efff; }
.top { display: flex; align-items: flex-start; gap: 16rpx; }
.game { flex: 1; min-width: 0; font-size: 32rpx; font-weight: 700; line-height: 1.4; word-break: break-all; }
.game-extra { font-weight: 600; color: #343950; }
.status { padding: 6rpx 14rpx; border-radius: 10rpx; font-size: 22rpx; background: #f0f1f6; color: #777e92; flex-shrink: 0; margin-top: 4rpx; }
.status-recruiting { background: #eeecff; color: #6255e7; }
.status-full { background: #e9f7f3; color: #21876f; }
.meta { font-size: 26rpx; line-height: 1.6; margin-top: 8rpx; color: #535b72; }
.tags { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 16rpx; }
.tag { font-size: 22rpx; padding: 5rpx 12rpx; border-radius: 8rpx; background: #f5f6fa; color: #777e92; word-break: break-all; }
.tag.soon { color: #21876f; background: #e9f7f3; }
.tag.started { color: #6255e7; background: #eeecff; }
.bottom { margin-top: 20rpx; padding-top: 18rpx; border-top: 1rpx solid #f0f1f6; display: flex; align-items: center; flex-wrap: wrap; gap: 12rpx; }
.count-current { font-size: 36rpx; font-weight: 700; color: #343950; }
.count-total { font-size: 24rpx; color: #777e92; }
.mark { font-size: 21rpx; color: #777e92; }
.card-action { margin-left: auto; padding: 8rpx 18rpx; border-radius: 12rpx; font-size: 23rpx; line-height: 1.3; color: #6255e7; background: #eeecff; flex-shrink: 0; }

</style>
