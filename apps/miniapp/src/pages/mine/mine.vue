<script>
import { eventWithDataset } from "../../utils/state";
import { platform } from "../../platform/host";
import { getApplication } from "../../stores/app";
import { updateState } from "../../utils/state";
import { isSinglePage } from "../../utils/runtime";
import { decorateTeam } from "../../utils/format";
import { callTeam, showError } from "../../utils/cloud";
import { getAppVersion } from "../../utils/version";
import { plazaShare, bindCopyUrl, unbindCopyUrl, shareToFriend, shareToTimeline } from "../../utils/share";
import { teamDetailPath } from "../../utils/team-entry";

function splitTeams(list) {
  const ongoing = [];
  const past = [];
  (list || []).forEach((t) => {
    if (t.ongoing) ongoing.push(t);
    else past.push(t);
  });
  return { ongoing, past };
}

// 资料卡副标题：优先展示签名，没填时给引导文案。
function profileHint(user) {
  const bio = ((user && user.bio) || "").trim();
  return bio || "写个签名，把 Steam 好友码放进去，队友加你好友";
}

export default {
 data() { return { singlePage: false, ...{
    user: {},
    teamTab: "hosted",
    phase: "Ongoing",
    visibleTeams: [],
    hostedOngoing: [],
    hostedPast: [],
    joinedOngoing: [],
    joinedPast: [],
    showProfile: false,
    profileHint: "",
    versionText: "",
    isAdmin: false,
    isOrganizer: false,
    hostedCount: 0,
    joinedCount: 0,
  } }; },
onShow() {
    const singlePage = isSinglePage();
    this.setData({ singlePage });
    if (singlePage) return;
    bindCopyUrl(platform, () => plazaShare());
    this.setData({ versionText: getAppVersion().text });
    this.load();
  },
onHide() {
    unbindCopyUrl(platform);
  },
onUnload() {
    unbindCopyUrl(platform);
  },
onPullDownRefresh() {
    return this.load().finally(() => platform.stopPullDownRefresh());
  },
onShareAppMessage() {
    return shareToFriend(plazaShare());
  },
onShareTimeline() {
    return shareToTimeline(plazaShare());
  },
methods: { eventWithDataset, setData: updateState,
async load() {
    if (isSinglePage()) return;
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
      this.setData({
        user: profile.user || {},
        profileHint: profileHint(profile.user),
        isAdmin: !!profile.isAdmin,
        isOrganizer: !!profile.isOrganizer,
        hostedOngoing: hosted.ongoing,
        hostedPast: hosted.past,
        joinedOngoing: joined.ongoing,
        joinedPast: joined.past,
        hostedCount: hosted.ongoing.length + hosted.past.length,
        joinedCount: joined.ongoing.length + joined.past.length,
      });
      this.updateVisibleTeams();
    } catch (e) {
      showError(e);
    }
  },
updateVisibleTeams() {
    this.setData({ visibleTeams: this[this.teamTab + this.phase] || [] });
  },
pickTeamTab(e) {
    this.setData({ teamTab: e.currentTarget.dataset.tab });
    this.updateVisibleTeams();
  },
pickPhase(e) {
    this.setData({ phase: e.currentTarget.dataset.phase });
    this.updateVisibleTeams();
  },
goPlaza() { platform.switchTab({ url: "/pages/index/index" }); },
editProfile() {
    this.setData({ showProfile: true });
  },
onProfileClose() { this.setData({ showProfile: false, pendingAction: "" }); },
onProfileDone(e) {
    const user = (e && e.detail && e.detail.user) || {};
    if (user.nickName) {
      this.setData({ showProfile: false, user });
    } else {
      this.setData({ showProfile: false });
    }
    this.load();
  },
onOpen(e) {
    const id = e.detail && e.detail.id;
    const url = teamDetailPath(id, { gameName: e.detail && e.detail.gameName });
    if (!url) return;
    platform.navigateTo({ url });
  },
openLegal(e) {
    const type = e.currentTarget.dataset.type;
    platform.navigateTo({
      url: `/pages/legal/legal?type=${type}`,
    });
  },
openFeedback() {
    platform.navigateTo({ url: "/pages/feedback/feedback" });
  },
openAuthor() {
    platform.showModal({
      title: "联系作者",
      content: "作者微信号：Louisville_k",
      confirmText: "复制微信号",
      success: (res) => {
        if (!res.confirm) return;
        platform.setClipboardData({
          data: "Louisville_k",
          fail: () => platform.showToast({ title: "复制失败，请重试", icon: "none" }),
        });
      },
    });
  },
openBug() {
    const app = getApplication();
    const errorMsg = encodeURIComponent((app.globalData && app.globalData.lastError) || "");
    platform.navigateTo({ url: `/pages/bug/bug?page=我的&errorMsg=${errorMsg}` });
  },
openAdmin() {
    platform.navigateTo({ url: "/pages/admin/admin" });
  },
openPublish() {
    platform.switchTab({ url: "/pages/publish/publish" });
  } }
};
</script>
<template>
<timeline-preview v-if="singlePage" />
<template v-else>
<view class="page">
  <view class="me card" @tap="editProfile(eventWithDataset($event, {}))">
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
  <view v-if="!visibleTeams.length" class="empty"><image class="empty-art" src="/static/images/brand/empty-v1.jpg" mode="aspectFit" lazy-load aria-hidden="true" /><view>{{phase === 'Past' ? '还没有历史组队' : '下一局，等你出发'}}</view><view class="empty-sub">{{phase === 'Past' ? '结束的组队会留在这里' : '发起一局，或去大厅找队友'}}</view><button v-if="phase === 'Ongoing'" class="btn-ghost" @tap="goPlaza(eventWithDataset($event, {}))">去大厅看看</button></view>
  <view class="footer">
    <button v-if="isOrganizer && !isAdmin" class="footer-action" @tap="openPublish(eventWithDataset($event, {}))">帮群友发车</button>
    <button v-if="isAdmin" class="footer-action" @tap="openAdmin(eventWithDataset($event, {}))">管理端</button>
    <view class="footer-links">
      <text class="footer-link" @tap="openAuthor(eventWithDataset($event, {}))">联系作者</text>
      <text class="footer-dot">·</text>
      <text class="footer-link" @tap="openFeedback(eventWithDataset($event, {}))">意见反馈</text>
      <text class="footer-dot">·</text>
      <text class="footer-link" @tap="openBug(eventWithDataset($event, {}))">报个错</text>
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

  <profile-gate :show="showProfile" @done="onProfileDone({ detail: $event })" @close="onProfileClose({ detail: $event })" />
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
