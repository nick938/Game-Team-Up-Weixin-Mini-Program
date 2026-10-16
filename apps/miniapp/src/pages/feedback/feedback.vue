<script>
import { eventWithDataset } from "../../utils/state";
import { platform } from "../../platform/host";
import { getApplication } from "../../stores/app";
import { updateState } from "../../utils/state";
import {
  FEEDBACK_KINDS,
  FEEDBACK_PAGES,
  FEEDBACK_TEMPLATE,
} from "../../utils/constants";
import { getAppVersion } from "../../utils/version";
import { callTeam, showError } from "../../utils/cloud";

export default {
 data() { return { singlePage: false, ...{
    kinds: FEEDBACK_KINDS,
    pages: FEEDBACK_PAGES,
    kind: "遇到问题",
    pageName: "大厅",
    content: FEEDBACK_TEMPLATE,
    submitting: false,
    versionText: "",
  } }; },
onLoad() {
    const ver = getAppVersion();
    this.version = ver;
    this.setData({ versionText: ver.text });
  },
methods: { eventWithDataset, setData: updateState,
pickKind(e) {
    this.setData({ kind: e.currentTarget.dataset.name });
  },
pickPage(e) {
    this.setData({ pageName: e.currentTarget.dataset.name });
  },
onContent(e) {
    this.setData({ content: e.detail.value });
  },
async onSubmit() {
    if (this.submitting) return;
    const content = (this.content || "").trim();
    const filled = content
      .replace(/【我遇到的情况】/g, "")
      .replace(/【我希望怎样】/g, "")
      .replace(/\s/g, "");
    if (filled.length < 4) {
      platform.showToast({ title: "请把情况写具体一点", icon: "none" });
      return;
    }
    this.setData({ submitting: true });
    try {
      const ver = this.version || getAppVersion();
      const res = await callTeam("submitFeedback", {
        kind: this.kind,
        page: this.pageName,
        content,
        version: ver.version,
        envVersion: ver.envLabel,
      });
      if (res.mailed) {
        platform.showToast({ title: "已发到邮箱", icon: "success" });
        this.setData({ content: FEEDBACK_TEMPLATE });
        setTimeout(() => platform.navigateBack(), 600);
        return;
      }
      platform.showModal({
        title: "反馈已记下，邮件没发出去",
        content: res.mailError || "请重新上传云函数 team，并勾选云端安装依赖。也可在云开发控制台查看 feedback 集合。",
        showCancel: false,
      });
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
  <view class="page-heading">写给我们</view>
  <view class="page-caption">按模板填就行。发送后会送到开发者邮箱，我们会认真看。</view>

  <view class="form">
    <view class="label">这是什么</view>
    <view class="games">
      <template v-for="(item, index) in kinds" :key="item"><view :class="'game ' + (kind === item ? 'game-on' : '')" :data-name="item" @tap="pickKind(eventWithDataset($event, {'name': item}))">{{item}}</view></template>
    </view>

    <view class="label">发生在哪</view>
    <view class="games">
      <template v-for="(item, index) in pages" :key="item"><view :class="'game ' + (pageName === item ? 'game-on' : '')" :data-name="item" @tap="pickPage(eventWithDataset($event, {'name': item}))">{{item}}</view></template>
    </view>

    <view class="label">反馈内容</view>
    <textarea class="area" maxlength="800" :value="content" @input="onContent(eventWithDataset($event, {}))" placeholder="按模板填写" />
    <view class="hint">已经填好模板，直接在空行里写就行。</view>

    <button class="btn-primary submit" :loading="submitting" :disabled="submitting" @tap="onSubmit(eventWithDataset($event, {}))">发送到邮箱</button>
  </view>

  <view class="version">当前版本 {{versionText}}</view>
</view>

</template>
<style scoped>
.form { margin-top: 28rpx; background: #fff; border: 1rpx solid #e9ebf3; border-radius: 28rpx; padding: 4rpx 28rpx 28rpx; }
.label { margin: 28rpx 0 14rpx; color: #535b72; font-size: 25rpx; font-weight: 600; }
.area { width: 100%; min-height: 320rpx; padding: 20rpx; line-height: 1.7; border: 1rpx solid #e9ebf3; background: #f7f8fc; border-radius: 16rpx; box-sizing: border-box; font-size: 28rpx; color: #202438; }
.games { display: flex; flex-wrap: wrap; gap: 12rpx; }
.game { padding: 15rpx 23rpx; background: #f5f6fa; color: #697188; border-radius: 14rpx; font-size: 25rpx; }
.game-on { background: #eeecff; color: #6255e7; box-shadow: inset 0 0 0 1rpx #c8c1fb; }
.hint { margin-top: 12rpx; font-size: 23rpx; color: #858ba0; }
.submit { margin-top: 32rpx; }
.version { margin-top: 28rpx; text-align: center; font-size: 22rpx; color: #858ba0; }

</style>
