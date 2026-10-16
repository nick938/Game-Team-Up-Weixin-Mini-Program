<script setup lang="ts">
import { reactive, toRefs, nextTick } from 'vue';
import { onShow, onHide, onUnload, onPullDownRefresh, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import type { Team, User, PageEvent } from '../../types/domain';
import { eventWithDataset } from "../../utils/state";
import { platform as hostPlatform } from "../../platform/host";
import { getApplication } from "../../stores/app";
import { isSinglePage } from "../../utils/runtime";
import { decorateTeam } from "../../utils/format";
import { callTeam, showError } from "../../utils/cloud";
import { getAppVersion } from "../../utils/version";
import { plazaShare, bindCopyUrl, unbindCopyUrl, shareToFriend, shareToTimeline } from "../../utils/share";
import { teamDetailPath } from "../../utils/team-entry";
function splitTeams(list: Team[]) {
    const ongoing: Team[] = [];
    const past: Team[] = [];
    (list || []).forEach((t) => {
        if (t.ongoing)
            ongoing.push(t);
        else
            past.push(t);
    });
    return { ongoing, past };
}
// 资料卡副标题：优先展示签名，没填时给引导文案。
function getProfileHint(user: User | undefined) {
    const bio = ((user && user.bio) || "").trim();
    return bio || "写个签名，把 Steam 好友码放进去，队友加你好友";
}
const state = reactive({ pendingAction: "", singlePage: false, ...{
        user: {} as User,
        teamTab: "hosted",
        phase: "Ongoing",
        visibleTeams: [] as Team[],
        hostedOngoing: [] as Team[],
        hostedPast: [] as Team[],
        joinedOngoing: [] as Team[],
        joinedPast: [] as Team[],
        showProfile: false,
        profileHint: "",
        versionText: "",
        isAdmin: false,
        isOrganizer: false,
        hostedCount: 0,
        joinedCount: 0,
    } });
const { singlePage, user, teamTab, phase, visibleTeams, hostedOngoing, hostedPast, joinedOngoing, joinedPast, showProfile, profileHint, versionText, isAdmin, isOrganizer, hostedCount, joinedCount } = toRefs(state);
function patchState(patch: Partial<typeof state>, done?: () => void) {
  Object.assign(state, patch);
  if (done) void nextTick(done);
}
async function load() {
    if (isSinglePage())
        return;
    try {
        const [profile, teams] = await Promise.all([
            callTeam("getProfile"),
            callTeam("myTeams"),
        ]);
        const app = getApplication();
        if (profile.user) {
            app.globalData.user = profile.user;
        }
        app.globalData.isAdmin = !!profile.isAdmin;
        app.globalData.isOrganizer = !!profile.isOrganizer;
        const hosted = splitTeams((teams.hosted || []).map(decorateTeam));
        const joined = splitTeams((teams.joined || []).map(decorateTeam));
        patchState({
            user: profile.user || {},
            profileHint: getProfileHint(profile.user),
            isAdmin: !!profile.isAdmin,
            isOrganizer: !!profile.isOrganizer,
            hostedOngoing: hosted.ongoing,
            hostedPast: hosted.past,
            joinedOngoing: joined.ongoing,
            joinedPast: joined.past,
            hostedCount: hosted.ongoing.length + hosted.past.length,
            joinedCount: joined.ongoing.length + joined.past.length,
        });
        updateVisibleTeams();
    }
    catch (error) {
        const e: Error & { code?: string } = error instanceof Error ? error : new Error(String(error));
        showError(e);
    }
}
function updateVisibleTeams() {
    patchState({ visibleTeams: state.teamTab === "hosted"
        ? (state.phase === "Past" ? state.hostedPast : state.hostedOngoing)
        : (state.phase === "Past" ? state.joinedPast : state.joinedOngoing) });
}
function pickTeamTab(e: PageEvent) {
    patchState({ teamTab: e.currentTarget.dataset.tab });
    updateVisibleTeams();
}
function pickPhase(e: PageEvent) {
    patchState({ phase: e.currentTarget.dataset.phase });
    updateVisibleTeams();
}
function goPlaza() {
    hostPlatform.switchTab({ url: "/pages/index/index" });
}
function editProfile() {
    patchState({ showProfile: true });
}
function onProfileClose() {
    patchState({ showProfile: false, pendingAction: "" });
}
function onProfileDone(e: Pick<PageEvent, 'detail'>) {
    const user = (e && e.detail && e.detail.user) || {};
    if (user.nickName) {
        patchState({ showProfile: false, user });
    }
    else {
        patchState({ showProfile: false });
    }
    load();
}
function onOpen(e: Pick<PageEvent, 'detail'>) {
    const id = e.detail && e.detail.id;
    const url = teamDetailPath(id, { gameName: e.detail && e.detail.gameName });
    if (!url)
        return;
    hostPlatform.navigateTo({ url });
}
function openLegal(e: PageEvent) {
    const type = e.currentTarget.dataset.type;
    hostPlatform.navigateTo({
        url: `/pages/legal/legal?type=${type}`,
    });
}
function openFeedback() {
    hostPlatform.navigateTo({ url: "/pages/feedback/feedback" });
}
function openAuthor() {
    hostPlatform.showModal({
        title: "联系作者",
        content: "作者微信号：Louisville_k",
        confirmText: "复制微信号",
        success: (res) => {
            if (!res.confirm)
                return;
            hostPlatform.setClipboardData({
                data: "Louisville_k",
                fail: () => hostPlatform.showToast({ title: "复制失败，请重试", icon: "none" }),
            });
        },
    });
}
function openBug() {
    const app = getApplication();
    const errorMsg = encodeURIComponent((app.globalData && app.globalData.lastError) || "");
    hostPlatform.navigateTo({ url: `/pages/bug/bug?page=我的&errorMsg=${errorMsg}` });
}
function openAdmin() {
    hostPlatform.navigateTo({ url: "/pages/admin/admin" });
}
function openPublish() {
    hostPlatform.switchTab({ url: "/pages/publish/publish" });
}
onShow(() => {
    const singlePage = isSinglePage();
    patchState({ singlePage });
    if (singlePage)
        return;
    bindCopyUrl(hostPlatform, () => plazaShare());
    patchState({ versionText: getAppVersion().text });
    load();
});
onHide(() => {
    unbindCopyUrl(hostPlatform);
});
onUnload(() => {
    unbindCopyUrl(hostPlatform);
});
onPullDownRefresh(() => {
    return load().finally(() => hostPlatform.stopPullDownRefresh());
});
onShareAppMessage(() => {
    return shareToFriend(plazaShare());
});
onShareTimeline(() => {
    return shareToTimeline(plazaShare());
});
</script>
<template>
<timeline-preview v-if="singlePage" />
<template v-else>
<view class="page">
  <view class="me card" @tap="editProfile()">
    <view class="avatar-wrap">
      <image class="avatar" :src="user.avatarUrl || (user.avatarBase64 ? 'data:image/jpeg;base64,' + user.avatarBase64 : '/static/images/avatar.png')" mode="aspectFill" />
      <view class="avatar-edit">✎</view>
    </view>
    <view class="me-text">
      <view class="name-row">
        <view class="name">{{user.nickName || '点这里设置头像昵称'}}</view>
        <view v-if="isOrganizer && !isAdmin" class="badge">组局员</view>
      </view>
      <view class="tip">{{profileHint}}</view>
    </view>
  </view>

  <view class="list-head">
    <view class="tabs">
      <button size="mini" :class="'tab ' + (teamTab === 'hosted' ? 'tab-active' : '')" data-tab="hosted" @tap="pickTeamTab(eventWithDataset($event, {'tab': 'hosted'}))">我发起的<text class="tab-count">{{hostedCount}}</text></button>
      <button size="mini" :class="'tab ' + (teamTab === 'joined' ? 'tab-active' : '')" data-tab="joined" @tap="pickTeamTab(eventWithDataset($event, {'tab': 'joined'}))">我加入的<text class="tab-count">{{joinedCount}}</text></button>
    </view>
    <view class="phases">
      <button size="mini" :class="'phase ' + (phase === 'Ongoing' ? 'phase-active' : '')" data-phase="Ongoing" @tap="pickPhase(eventWithDataset($event, {'phase': 'Ongoing'}))">进行中</button>
      <button size="mini" :class="'phase ' + (phase === 'Past' ? 'phase-active' : '')" data-phase="Past" @tap="pickPhase(eventWithDataset($event, {'phase': 'Past'}))">历史</button>
    </view>
  </view>
  <template v-for="(item, index) in visibleTeams" :key="item._id"><team-card :team="item" :team-id="item.id || item._id" :mark="teamTab === 'hosted' ? '车头' : '队员'" @open="onOpen({ detail: $event })" /></template>
  <view v-if="!visibleTeams.length" class="empty"><image class="empty-art" src="/static/images/brand/empty-v1.jpg" mode="aspectFit" lazy-load aria-hidden="true" /><view>{{phase === 'Past' ? '还没有历史组队' : '下一局，等你出发'}}</view><view class="empty-sub">{{phase === 'Past' ? '结束的组队会留在这里' : '发起一局，或去大厅找队友'}}</view><button v-if="phase === 'Ongoing'" class="btn-ghost" @tap="goPlaza()">去大厅看看</button></view>
  <view class="footer">
    <button v-if="isOrganizer && !isAdmin" class="footer-action" @tap="openPublish()">帮群友发车</button>
    <button v-if="isAdmin" class="footer-action" @tap="openAdmin()">管理端</button>
    <view class="footer-links">
      <text class="footer-link" @tap="openAuthor()">联系作者</text>
      <text class="footer-dot">·</text>
      <text class="footer-link" @tap="openFeedback()">意见反馈</text>
      <text class="footer-dot">·</text>
      <text class="footer-link" @tap="openBug()">报个错</text>
    </view>
    <view class="legal">
      <text data-type="agreement" @tap="openLegal(eventWithDataset($event, {'type': 'agreement'}))">用户协议</text>
      <text class="footer-dot">·</text>
      <text data-type="privacy" @tap="openLegal(eventWithDataset($event, {'type': 'privacy'}))">隐私政策</text>
      <text class="footer-dot">·</text>
      <text data-type="community" @tap="openLegal(eventWithDataset($event, {'type': 'community'}))">社区公约</text>
    </view>
    <view class="version">{{versionText}}</view>
  </view>

  <profile-gate :show="showProfile" @done="onProfileDone({ detail: $event })" @close="onProfileClose()" />
  <welcome-letter />
</view>

</template>

</template>
<style scoped>
.card { background: #fff; border: 1rpx solid #e9ebf3; border-radius: 28rpx; padding: 28rpx; }
.me { display: flex; align-items: center; padding: 12rpx 0 28rpx; background: transparent; border: none; }
.avatar-wrap { position: relative; margin-right: 24rpx; flex-shrink: 0; }
.avatar { display: block; width: 112rpx; height: 112rpx; border-radius: 36rpx; background: #eeecff; }
.avatar-edit { position: absolute; right: -6rpx; bottom: -6rpx; width: 40rpx; height: 40rpx; line-height: 38rpx; text-align: center; font-size: 22rpx; color: #fff; background: #6255e7; border: 3rpx solid #fff; border-radius: 50%; }
.me-text { min-width: 0; flex: 1; }
.name-row { display: flex; align-items: center; gap: 12rpx; min-width: 0; }
.name { font-size: 38rpx; font-weight: 700; word-break: break-word; min-width: 0; }
.badge { flex-shrink: 0; padding: 4rpx 14rpx; font-size: 21rpx; color: #5549c7; background: #eceafa; border-radius: 10rpx; }
.tip { margin-top: 10rpx; font-size: 24rpx; line-height: 1.5; color: #777e92; word-break: break-word; }
.list-head { display: flex; align-items: center; justify-content: space-between; margin: 32rpx 0 20rpx; gap: 16rpx; }
.tabs { display: flex; gap: 32rpx; min-width: 0; }
button.tab { width: auto; min-width: 0; padding: 0 0 10rpx; color: #858ba0; font-size: 32rpx; font-weight: 600; }
.tab-active { color: #202438; border-bottom: 5rpx solid #6255e7; }
.tab-count { margin-left: 8rpx; font-size: 23rpx; font-weight: 400; color: #9aa0b4; }
.tab-active .tab-count { color: #6255e7; }
.phases { display: inline-flex; flex-shrink: 0; gap: 4rpx; padding: 5rpx; background: #eceef6; border-radius: 22rpx; }
button.phase { width: auto; min-width: 0; font-size: 23rpx; padding: 8rpx 18rpx; border-radius: 18rpx; color: #737a90; line-height: 1.3; }
.phase-active { color: #6255e7; background: #fff; font-weight: 600; }
.empty { padding: 40rpx 28rpx; }
.empty-sub { font-size: 24rpx; margin: 6rpx 0 24rpx; }
.empty .btn-ghost { width: 280rpx; margin: 0 auto; }
.footer { margin-top: 48rpx; text-align: center; }
button.footer-action { width: auto; min-width: 0; display: inline-block; margin: 0 8rpx 24rpx; padding: 14rpx 32rpx; font-size: 24rpx; font-weight: 600; color: #5549c7; background: #eceafa; border-radius: 16rpx; }
.footer-links { display: flex; align-items: center; justify-content: center; gap: 6rpx; }
.footer-link { font-size: 25rpx; color: #6255e7; padding: 8rpx 12rpx; }
.footer-dot { color: #c2c7d6; font-size: 22rpx; }
.legal { margin-top: 10rpx; color: #a0a6b8; font-size: 22rpx; }
.legal text { display: inline-block; padding: 8rpx 10rpx; }
.version { margin-top: 14rpx; font-size: 22rpx; color: #b3b8c8; }

</style>
