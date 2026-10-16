<script>
import { eventWithDataset } from "../../utils/state";
import { platform } from "../../platform/host";
import { getApplication } from "../../stores/app";
import { updateState } from "../../utils/state";
import { FEEDBACK_PAGES, BUG_TEMPLATE } from "../../utils/constants";
import { getAppVersion } from "../../utils/version";
import { callTeam, showError } from "../../utils/cloud";

function systemSummary() {
  try {
    const info = platform.getSystemInfoSync() || {};
    return [
      info.platform,
      info.model,
      info.system,
      info.SDKVersion ? `SDK ${info.SDKVersion}` : "",
    ]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 200);
  } catch (e) {
    return "";
  }
}

export default {
 data() { return { singlePage: false, ...{
    pages: FEEDBACK_PAGES,
    pageName: "大厅",
    content: BUG_TEMPLATE,
    errorMsg: "",
    submitting: false,
  } }; },
onLoad(options) {
    const pageName = options.page && FEEDBACK_PAGES.includes(options.page)
      ? options.page
      : "大厅";
    const errorMsg = options.errorMsg ? decodeURIComponent(options.errorMsg) : "";
    this.setData({ pageName, errorMsg: errorMsg.slice(0, 500) });
  },
methods: { eventWithDataset, setData: updateState,
pickPage(e) {
    this.setData({ pageName: e.currentTarget.dataset.name });
  },
onContent(e) {
    this.setData({ content: e.detail.value });
  },
onErrorMsg(e) {
    this.setData({ errorMsg: e.detail.value });
  },
async onSubmit() {
    if (this.submitting) return;
    const content = (this.content || "").trim();
    const filled = content
      .replace(/【我做了什么】/g, "")
      .replace(/【出现了什么】/g, "")
      .replace(/\s/g, "");
    if (filled.length < 4) {
      platform.showToast({ title: "请简单说说发生了什么", icon: "none" });
      return;
    }
    this.setData({ submitting: true });
    try {
      const ver = getAppVersion();
      await callTeam("submitBug", {
        page: this.pageName,
        content,
        errorMsg: (this.errorMsg || "").trim(),
        systemInfo: systemSummary(),
        version: ver.version,
        envVersion: ver.envLabel,
      });
      platform.showToast({ title: "已收到，谢谢你", icon: "success" });
      this.setData({ content: BUG_TEMPLATE, errorMsg: "" });
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
  <view class="page-heading">报个错</view>
  <view class="page-caption">用着不顺手、页面报错、数据不对？按模板说清楚，我们会尽快排查。</view>

  <view class="form">
    <view class="label">出问题的页面</view>
    <view class="games">
      <template v-for="(item, index) in pages" :key="item"><view :class="'game ' + (pageName === item ? 'game-on' : '')" :data-name="item" @tap="pickPage(eventWithDataset($event, {'name': item}))">{{item}}</view></template>
    </view>

    <view class="label">发生了什么</view>
    <textarea class="area" maxlength="800" :value="content" @input="onContent(eventWithDataset($event, {}))" placeholder="按模板填写" />
    <view class="hint">已经填好模板，直接在空行里写就行。</view>

    <view class="label">报错信息（选填）</view>
    <textarea class="area area-sm" maxlength="500" :value="errorMsg" @input="onErrorMsg(eventWithDataset($event, {}))" placeholder="如果看到一串错误提示，可以贴在这里" />

    <button class="btn-primary submit" :loading="submitting" :disabled="submitting" @tap="onSubmit(eventWithDataset($event, {}))">提交报错</button>
  </view>
</view>

</template>
<style scoped>
.form { margin-top: 28rpx; background: #fff; border: 1rpx solid #e9ebf3; border-radius: 28rpx; padding: 4rpx 28rpx 28rpx; }
.label { margin: 28rpx 0 14rpx; color: #535b72; font-size: 25rpx; font-weight: 600; }
.area { width: 100%; min-height: 300rpx; padding: 20rpx; line-height: 1.7; border: 1rpx solid #e9ebf3; background: #f7f8fc; border-radius: 16rpx; box-sizing: border-box; font-size: 28rpx; color: #202438; }
.area-sm { min-height: 150rpx; }
.games { display: flex; flex-wrap: wrap; gap: 12rpx; }
.game { padding: 15rpx 23rpx; background: #f5f6fa; color: #697188; border-radius: 14rpx; font-size: 25rpx; }
.game-on { background: #eeecff; color: #6255e7; box-shadow: inset 0 0 0 1rpx #c8c1fb; }
.hint { margin-top: 12rpx; font-size: 23rpx; color: #858ba0; }
.submit { margin-top: 32rpx; }

</style>
