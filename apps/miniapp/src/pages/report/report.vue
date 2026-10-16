<script>
import { eventWithDataset } from "../../utils/state";
import { platform } from "../../platform/host";
import { getApplication } from "../../stores/app";
import { updateState } from "../../utils/state";
import { REPORT_REASONS } from "../../utils/constants";
import { getAppVersion } from "../../utils/version";
import { callTeam, showError } from "../../utils/cloud";

export default {
 data() { return { singlePage: false, ...{
    reasons: REPORT_REASONS,
    reason: "",
    content: "",
    teamId: "",
    targetName: "",
    submitting: false,
  } }; },
onLoad(options) {
    const targetName = options.name ? decodeURIComponent(options.name) : "";
    this.setData({
      teamId: options.teamId || "",
      targetName,
    });
    platform.setNavigationBarTitle({ title: targetName ? `举报：${targetName}` : "举报" });
  },
methods: { eventWithDataset, setData: updateState,
pickReason(e) {
    this.setData({ reason: e.currentTarget.dataset.name });
  },
onContent(e) {
    this.setData({ content: e.detail.value });
  },
async onSubmit() {
    if (this.submitting) return;
    if (!this.reason) {
      platform.showToast({ title: "请选择举报理由", icon: "none" });
      return;
    }
    if (!this.teamId) {
      platform.showToast({ title: "举报对象已失效", icon: "none" });
      return;
    }
    this.setData({ submitting: true });
    try {
      const ver = getAppVersion();
      await callTeam("submitReport", {
        targetType: "team",
        targetId: this.teamId,
        reason: this.reason,
        content: (this.content || "").trim(),
        version: ver.version,
        envVersion: ver.envLabel,
      });
      platform.showToast({ title: "已收到举报", icon: "success" });
      setTimeout(() => platform.navigateBack(), 700);
    } catch (e) {
      showError(e);
    } finally {
      this.setData({ submitting: false });
    }
  } }
};
</script>
<template>
<view class="page">
  <view class="page-heading">举报</view>
  <view class="page-caption">如果这趟车涉及广告、辱骂或违规内容，告诉我们，我们会尽快处理。</view>

  <view class="target card">
    <view class="target-label">举报对象</view>
    <view class="target-name">{{targetName || '这趟车已不存在'}}</view>
  </view>

  <view class="form">
    <view class="label">举报理由</view>
    <view class="games">
      <template v-for="(item, index) in reasons" :key="item"><view :class="'game ' + (reason === item ? 'game-on' : '')" :data-name="item" @tap="pickReason(eventWithDataset($event, {'name': item}))">{{item}}</view></template>
    </view>

    <view class="label">补充说明（选填）</view>
    <textarea class="area" maxlength="500" :value="content" @input="onContent(eventWithDataset($event, {}))" placeholder="方便的话，说说具体是什么情况" />
    <view class="hint">举报会记录你的账号，恶意举报可能影响使用。</view>

    <button class="btn-primary submit" :loading="submitting" :disabled="submitting" @tap="onSubmit(eventWithDataset($event, {}))">提交举报</button>
  </view>
</view>

</template>
<style scoped>
.page-heading { font-size: 44rpx; font-weight: 700; letter-spacing: -1rpx; line-height: 1.35; }
.page-caption { margin-top: 10rpx; font-size: 26rpx; color: #777e92; line-height: 1.6; }
.target { margin-top: 28rpx; padding: 24rpx 28rpx; }
.target-label { font-size: 23rpx; color: #858ba0; }
.target-name { margin-top: 8rpx; font-size: 32rpx; font-weight: 600; word-break: break-all; }
.form { margin-top: 24rpx; background: #fff; border: 1rpx solid #e9ebf3; border-radius: 28rpx; padding: 4rpx 28rpx 28rpx; }
.label { margin: 28rpx 0 14rpx; color: #535b72; font-size: 25rpx; font-weight: 600; }
.area { width: 100%; min-height: 220rpx; padding: 20rpx; line-height: 1.7; border: 1rpx solid #e9ebf3; background: #f7f8fc; border-radius: 16rpx; box-sizing: border-box; font-size: 28rpx; color: #202438; }
.games { display: flex; flex-wrap: wrap; gap: 12rpx; }
.game { padding: 15rpx 23rpx; background: #f5f6fa; color: #697188; border-radius: 14rpx; font-size: 25rpx; }
.game-on { background: #feecef; color: #c54d69; box-shadow: inset 0 0 0 1rpx #f3c3ce; }
.hint { margin-top: 12rpx; font-size: 23rpx; color: #858ba0; }
.submit { margin-top: 32rpx; }

</style>
