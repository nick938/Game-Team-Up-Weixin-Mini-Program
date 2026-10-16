<script setup lang="ts">
import { reactive, toRefs, nextTick } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import type { PageEvent } from '../../types/domain';
import { eventWithDataset } from "../../utils/state";
import { platform as hostPlatform } from "../../platform/host";

import { FEEDBACK_KINDS, FEEDBACK_PAGES, FEEDBACK_TEMPLATE } from "../../utils/constants";
import { getAppVersion } from "../../utils/version";
import { callTeam, showError } from "../../utils/cloud";
const state = reactive({ version: null as ReturnType<typeof getAppVersion> | null, singlePage: false, ...{
        kinds: FEEDBACK_KINDS,
        pages: FEEDBACK_PAGES,
        kind: "遇到问题",
        pageName: "大厅",
        content: FEEDBACK_TEMPLATE,
        submitting: false,
        versionText: "",
    } });
const { singlePage, kinds, pages, kind, pageName, content, submitting, versionText } = toRefs(state);
function patchState(patch: Partial<typeof state>, done?: () => void) {
  Object.assign(state, patch);
  if (done) void nextTick(done);
}
function pickKind(e: PageEvent) {
    patchState({ kind: e.currentTarget.dataset.name });
}
function pickPage(e: PageEvent) {
    patchState({ pageName: e.currentTarget.dataset.name });
}
function onContent(e: PageEvent) {
    patchState({ content: e.detail.value });
}
async function onSubmit() {
    if (state.submitting)
        return;
    const content = (state.content || "").trim();
    const filled = content
        .replace(/【我遇到的情况】/g, "")
        .replace(/【我希望怎样】/g, "")
        .replace(/\s/g, "");
    if (filled.length < 4) {
        hostPlatform.showToast({ title: "请把情况写具体一点", icon: "none" });
        return;
    }
    patchState({ submitting: true });
    try {
        const ver = state.version || getAppVersion();
        const res = await callTeam("submitFeedback", {
            kind: state.kind,
            page: state.pageName,
            content,
            version: ver.version,
            envVersion: ver.envLabel,
        });
        if (res.mailed) {
            hostPlatform.showToast({ title: "已发到邮箱", icon: "success" });
            patchState({ content: FEEDBACK_TEMPLATE });
            setTimeout(() => hostPlatform.navigateBack(), 600);
            return;
        }
        hostPlatform.showModal({
            title: "反馈已记下，邮件没发出去",
            content: res.mailError || "请重新上传云函数 team，并勾选云端安装依赖。也可在云开发控制台查看 feedback 集合。",
            showCancel: false,
        });
    }
    catch (error) {
        const e: Error & { code?: string } = error instanceof Error ? error : new Error(String(error));
        showError(e);
    }
    finally {
        patchState({ submitting: false });
    }
}
onLoad(() => {
    const ver = getAppVersion();
    state.version = ver;
    patchState({ versionText: ver.text });
});
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

    <button class="btn-primary submit" :loading="submitting" :disabled="submitting" @tap="onSubmit()">发送到邮箱</button>
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
