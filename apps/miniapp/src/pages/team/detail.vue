<script>
import { capabilities } from "../../platform/host";
import { eventWithDataset } from "../../utils/state";
import { platform } from "../../platform/host";
import { getApplication } from "../../stores/app";
import { updateState } from "../../utils/state";
import { isSinglePage } from "../../utils/runtime";
import { decorateTeam, formatStartAt } from "../../utils/format";
import { callTeam, showError } from "../../utils/cloud";
import { requestTeamNotify } from "../../utils/subscribe";
import { resolveTeamId, teamShareQuery, usableTeamId } from "../../utils/team-entry";
import { bindCopyUrl, unbindCopyUrl, shareToFriend, shareToTimeline } from "../../utils/share";
import { renderTeamCover } from "../../utils/team-cover";

function queryCanvasNode() {
  return new Promise((resolve) => {
    if (typeof platform.createSelectorQuery !== "function") {
      resolve(null);
      return;
    }
    platform.createSelectorQuery()
      .select("#shareCover")
      .fields({ node: true, size: true })
      .exec((res) => resolve((res && res[0] && res[0].node) || null));
  });
}

// canvas 节点要等渲染完才查得到。setData 回调里通常已经在，偶发查不到时退一步重试。
async function waitForCanvasNode(attempts) {
  for (let i = 0; i < attempts; i += 1) {
    const node = await queryCanvasNode();
    if (node) return node;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

function pixelRatio() {
  try {
    if (typeof platform.getWindowInfo === "function") return platform.getWindowInfo().pixelRatio || 1;
    if (typeof platform.getSystemInfoSync === "function") return platform.getSystemInfoSync().pixelRatio || 1;
  } catch (e) {
    // 取不到就按 1 倍画，图糊一点但不影响分享
  }
  return 1;
}

function readLaunchExtras() {
  const extras = {};
  try {
    if (typeof platform.getEnterOptionsSync === "function") extras.enter = platform.getEnterOptionsSync();
  } catch (e) {
    // 旧基础库或未就绪时忽略
  }
  try {
    if (typeof platform.getLaunchOptionsSync === "function") extras.launch = platform.getLaunchOptionsSync();
  } catch (e) {
    // 旧基础库或未就绪时忽略
  }
  return extras;
}

function shouldFoldNote(note) {
  if (!note || typeof note !== "string") return false;
  const trimmed = note.trim();
  if (trimmed.length > 80) return true;
  const lines = trimmed.split("\n");
  if (lines.length > 3) return true;
  return false;
}

export default {
 data() { return { singlePage: false, wechatSubscription: capabilities.wechatSubscription, ...{
    teamId: "",
    team: null,
    members: [],
    seats: [],
    showManage: false,
    showMemberProfile: false,
    memberProfileLoading: false,
    memberProfile: null,
    memberProfileError: "",
    selectedMemberId: "",
    role: null,
    loading: true,
    showProfile: false,
    pendingAction: "",
    notifyHint: "",
    notifyAuthorized: false,
    noteCanFold: false,
    noteExpanded: false,
  } }; },
onLoad(options) {
    this.entryOptions = options || {};
    const teamId = this.syncTeamId(this.entryOptions);
    const rawName = options && (options.name || options.gameName);
    if (rawName) {
      let name = String(rawName);
      try {
        name = decodeURIComponent(name);
      } catch (e) {
        // 已经是明文
      }
      platform.setNavigationBarTitle({ title: name.slice(0, 40) });
    }
    if (!teamId) this.setData({ loading: false, team: null });
  },
onPullDownRefresh() {
    return this.loadDetail().finally(() => platform.stopPullDownRefresh());
  },
onShow() {
    const singlePage = isSinglePage();
    this.setData({ singlePage });
    if (singlePage) return;
    bindCopyUrl(platform, () => ({
      query: teamShareQuery(this.teamId),
      title: (this.team && this.team.gameName) || "开黑星球",
    }));
    const teamId = this.syncTeamId(this.entryOptions || this.options);
    if (teamId) {
      this.loadDetail();
    } else {
      this.setData({ loading: false, team: null, teamId: "" });
    }
  },
onHide() {
    unbindCopyUrl(platform);
  },
onUnload() {
    unbindCopyUrl(platform);
  },
onShareAppMessage() {
    return shareToFriend(this.buildShare(), this.shareCoverPath);
  },
onShareTimeline() {
    return shareToTimeline(this.buildShare(), this.shareCoverPath);
  },
methods: { eventWithDataset, setData: updateState,
syncTeamId(options) {
    const teamId = resolveTeamId(options || this.options || {}, readLaunchExtras());
    if (teamId !== this.teamId) {
      this.setData({ teamId, noteExpanded: false, noteCanFold: false });
    }
    return teamId;
  },
buildShare() {
    const team = this.team;
    const query = teamShareQuery(this.teamId);
    const path = query ? `/pages/team/detail?${query}` : "/pages/index/index";
    if (!team) {
      return { title: "开黑星球", path, query };
    }
    const time = formatStartAt(team.startAt).replace(/今天 |今晚 |明天 /, "");
    let title = `开黑星球｜${team.gameName}`;
    if (team.displayStatus === "recruiting") {
      title += ` 还差 ${team.needCount} 人 · ${time}`;
    } else if (team.displayStatus === "full") {
      title += " 已满员";
    } else if (team.displayStatus === "cancelled") {
      title += " 已散";
    } else {
      title += " 已结束";
    }
    return { title, path, query };
  },
async prepareShareCover() {
    const team = this.team;
    const requestId = (this.coverRequest || 0) + 1;
    this.coverRequest = requestId;
    this.shareCoverPath = "";
    if (!team) return;

    let path = "";
    try {
      const canvas = await waitForCanvasNode(3);
      if (requestId !== this.coverRequest) return;
      path = await renderTeamCover(canvas, team, pixelRatio());
    } catch (e) {
      path = "";
    }
    if (requestId !== this.coverRequest) return;
    this.shareCoverPath = path;
  },
async loadDetail() {
    if (isSinglePage()) return;
    const teamId = usableTeamId(this.teamId);
    if (!teamId) {
      this.setData({ loading: false, team: null, teamId: "" });
      return;
    }
    const requestId = (this.detailRequest || 0) + 1;
    this.detailRequest = requestId;
    this.setData({ loading: true });
    try {
      const res = await callTeam("getTeam", { teamId });
      if (requestId !== this.detailRequest) return;
      const role = res.role;
      const note = (res.team && res.team.note) || "";
      const noteCanFold = shouldFoldNote(note);
      this.setData(
        {
          team: decorateTeam(res.team),
          noteCanFold,
          noteExpanded: false,
          members: res.members || [],
          seats: Array.from({ length: res.team.capacity }, (_, i) => ({
            key: i,
            member: (res.members || [])[i] || null,
          })),
          role,
          loading: false,
        },
        // 回调里 canvas 节点才渲染出来，此时才画得了封面
        () => this.prepareShareCover()
      );
      platform.setNavigationBarTitle({
        title: (res.team && res.team.gameName) || "组队详情",
      });
    } catch (e) {
      if (requestId !== this.detailRequest) return;
      this.setData({ team: null, loading: false });
      // 数据没取到，别让分享还用着上一趟车的封面
      this.prepareShareCover();
      showError(e);
    }
  },
toggleNoteExpand() {
    this.setData({ noteExpanded: !this.noteExpanded });
  },
onMemberProfile(e) {
    const memberId = e.currentTarget.dataset.memberid;
    if (!memberId) return;
    this.setData({ showMemberProfile: true, selectedMemberId: memberId, memberProfile: null });
    this.loadMemberProfile();
  },
async loadMemberProfile() {
    const requestId = (this.memberProfileRequest || 0) + 1;
    this.memberProfileRequest = requestId;
    this.setData({ memberProfileLoading: true, memberProfileError: "" });
    try {
      const res = await callTeam("getPublicProfile", {
        teamId: this.teamId,
        memberId: this.selectedMemberId,
      });
      if (requestId !== this.memberProfileRequest) return;
      this.setData({ memberProfile: res.profile, memberProfileLoading: false });
    } catch (err) {
      if (requestId !== this.memberProfileRequest) return;
      this.setData({ memberProfileLoading: false, memberProfileError: err.message || "资料加载失败" });
    }
  },
closeMemberProfile() {
    this.memberProfileRequest = (this.memberProfileRequest || 0) + 1;
    this.setData({ showMemberProfile: false, memberProfile: null, selectedMemberId: "" });
  },
copyRoom() {
    const no = this.team && this.team.roomNo;
    if (!no) return;
    platform.setClipboardData({ data: String(no) });
  },
copyPwd() {
    const pwd = this.team && this.team.roomPwd;
    if (!pwd) return;
    platform.setClipboardData({ data: String(pwd) });
  },
async onEnableNotify() {
    if (!capabilities.wechatSubscription) { platform.showToast({ title: "当前平台暂不支持开打提醒", icon: "none" }); return; }
    if (this.requestingNotify || this.notifyAuthorized) return;
    this.requestingNotify = true;
    const ok = await requestTeamNotify();
    this.requestingNotify = false;
    this.setData({
      notifyAuthorized: ok,
      notifyHint: ok
        ? ""
        : "未获得通知授权，可再次点击重试或检查微信订阅设置",
    });
  },
async onJoin() {
    if (this.joining) return;
    this.joining = true;
    try {
      await requestTeamNotify();
      platform.showLoading({ title: "上车中" });
      await callTeam("joinTeam", { teamId: this.teamId });
      platform.hideLoading();
      platform.showToast({ title: "已上车", icon: "success" });
      this.loadDetail();
    } catch (e) {
      platform.hideLoading();
      if (e.code === "NEED_PROFILE") {
        this.setData({ showProfile: true, pendingAction: "join" });
      } else {
        showError(e);
      }
    } finally {
      this.joining = false;
    }
  },
onLeave() {
    platform.showModal({
      title: "下车？",
      success: async (res) => {
        if (!res.confirm) return;
        platform.showLoading({ title: "下车中" });
        try {
          await callTeam("leaveTeam", { teamId: this.teamId });
          platform.showToast({ title: "已下车", icon: "success" });
          this.loadDetail();
        } catch (e) {
          platform.hideLoading();
          showError(e);
        }
      },
    });
  },
onManage() {
    if (this.role !== "host") return;
    this.setData({ showManage: true });
  },
closeManage() { this.setData({ showManage: false }); },
stopManageTouch() {},
onManageAction(e) {
    if (this.role !== "host") return;
    const actions = { edit: "onEdit", cancel: "onCancel" };
    const action = actions[e.currentTarget.dataset.action];
    this.closeManage();
    if (action) this[action]();
  },
onEdit() {
    const app = getApplication();
    app.globalData.editingTeamId = this.teamId;
    platform.switchTab({ url: "/pages/publish/publish" });
  },
onRepublish() {
    const team = this.team;
    if (!team) return;
    const app = getApplication();
    app.globalData.republishTeam = {
      gameName: team.gameName,
      capacity: team.capacity,
      roomNo: team.roomNo,
      roomPwd: team.roomPwd,
      platform: team.platform,
      server: team.server,
      voice: team.voice,
      rankReq: team.rankReq,
      note: team.note,
    };
    platform.switchTab({ url: "/pages/publish/publish" });
  },
onCancel() {
    platform.showModal({
      title: "散了这趟？",
      content: "散了之后不能再上车。",
      confirmColor: "#c1121f",
      success: async (res) => {
        if (!res.confirm) return;
        platform.showLoading({ title: "处理中" });
        try {
          await callTeam("cancelTeam", { teamId: this.teamId });
          platform.showToast({ title: "已散", icon: "success" });
          this.loadDetail();
        } catch (e) {
          platform.hideLoading();
          showError(e);
        }
      },
    });
  },
goPlaza() {
    platform.switchTab({ url: "/pages/index/index" });
  },
onReport() {
    const team = this.team;
    if (!team) return;
    const name = encodeURIComponent(team.gameName || "");
    platform.navigateTo({
      url: `/pages/report/report?teamId=${this.teamId}&name=${name}`,
    });
  },
onProfileClose() { this.setData({ showProfile: false, pendingAction: "" }); },
onProfileDone() {
    this.setData({ showProfile: false });
    if (this.pendingAction === "join") {
      this.setData({ pendingAction: "" });
      this.onJoin();
    }
  } }
};
</script>
<template>
<timeline-preview v-if="singlePage" />
<template v-else>
<view class="page" v-if="team">
  <view class="hero card">
    <view class="status-row">
      <view :class="'status status-' + (team.displayStatus)">{{team.statusText}}</view>
      <view class="started" v-if="team.started">进行中</view>
      <view class="soon" v-else-if="team.soon">即将开始</view>
    </view>
            <view class="game">{{team.gameName}}</view>
    <view class="proxy-tip" v-if="team.proxyNickName">由 {{team.proxyNickName}} 代开</view>
    <view class="time">{{team.timeText}}</view>
    <view v-if="wechatSubscription && role && (team.displayStatus === 'recruiting' || team.displayStatus === 'full')" class="notify-row">
      <button size="mini" :class="'notify-link ' + (notifyAuthorized ? 'notify-authorized' : '')" @tap="onEnableNotify(eventWithDataset($event, {}))">
        <text>{{notifyAuthorized ? '已授权开打前提醒' : '开打前 10 分钟提醒我'}}</text>
        <text v-if="!notifyAuthorized" class="notify-arrow">›</text>
      </button>
      <view v-if="notifyHint" class="notify-hint">{{notifyHint}}</view>
    </view>
    <view class="count">{{team.memberCount}}/{{team.capacity}}
      <text class="need" v-if="team.displayStatus === 'recruiting'">还差 {{team.needCount}} 人</text>
    </view>
    <view class="tags">
      <text v-if="team.platform">{{team.platform}}</text>
      <text v-if="team.server">{{team.server}}</text>
      <text v-if="team.voice && team.voice !== '不限'">{{team.voice}}</text>
      <text v-if="team.rankReq">{{team.rankReq}}</text>
    </view>
    <view class="note-wrap" v-if="team.note">
      <view :class="'note ' + (noteCanFold && !noteExpanded ? 'note-collapsed' : '')">{{team.note}}</view>
      <view class="note-toggle" v-if="noteCanFold" @tap="toggleNoteExpand(eventWithDataset($event, {}))">
        <text>{{noteExpanded ? '收起' : '展开全部'}}</text>
        <view :class="'note-chevron ' + (noteExpanded ? 'note-chevron-up' : '')"></view>
      </view>
    </view>
  </view>


  <view class="card" v-if="team.roomNo || role">
    <view class="card-title">怎么进</view>
    <view class="copy-row" v-if="team.roomNo" @tap="copyRoom(eventWithDataset($event, {}))">
      <view class="copy-label">房间 / 好友码</view>
      <view class="copy-val">{{team.roomNo}}</view>
      <view class="copy-btn">复制</view>
    </view>
    <view class="copy-row" v-if="role" @tap="copyPwd(eventWithDataset($event, {}))">
      <view class="copy-label">密码</view>
      <view class="copy-val">{{team.roomPwd || '无'}}</view>
      <view class="copy-btn" v-if="team.roomPwd">复制</view>
    </view>
    <view class="hint" v-if="!role && team.hasPwd">加入后可见进房密码</view>
    <view class="hint" v-if="!team.roomNo && !team.hasPwd">进房方式看备注，或上车后问车头</view>
  </view>

  <view class="card">
    <view class="members-heading"><view class="card-title">这局的队友</view><text class="member-total">{{members.length}} / {{team.capacity}} 人</text></view>
    <view class="member-profile-tip">点头像，查看队友的游戏资料</view>
    <view class="seats">
      <template v-for="(item, index) in seats" :key="item.key"><view class="seat">
        <template v-if="item.member">
          <button size="mini" class="seat-profile" :data-memberid="item.member._id" @tap="onMemberProfile(eventWithDataset($event, {'memberid': item.member._id}))" :aria-label="'查看 ' + (item.member.nickName || '玩家') + ' 的公开资料'"><image class="seat-avatar" :src="item.member.avatarUrl || (item.member.avatarBase64 ? 'data:image/jpeg;base64,' + item.member.avatarBase64 : '/static/images/avatar.png')" mode="aspectFill" /></button>
          <view class="seat-name">{{item.member.nickName || '玩家'}}</view>
          <text class="host-tag" v-if="item.member.role === 'host'">车头</text>
        </template>
        <template v-else><view class="seat-empty">＋</view><view class="seat-name seat-wait">{{team.ongoing ? '等队友' : '空位'}}</view></template>
      </view></template>
    </view>
  </view>

  <view class="actions" v-if="team.ongoing">
    <button class="btn-ghost compact-action" v-if="role === 'host'" @tap="onManage(eventWithDataset($event, {}))">管理</button>
    <button class="btn-ghost compact-action" v-if="role === 'member'" @tap="onLeave(eventWithDataset($event, {}))">下车</button>
    <button :class="role ? 'btn-primary' : 'btn-ghost compact-action'" open-type="share">{{team.displayStatus === 'full' ? '分享队伍' : '邀请好友'}}</button>
    <button class="btn-primary" v-if="!role && team.displayStatus === 'recruiting'" @tap="onJoin(eventWithDataset($event, {}))">{{team.started ? '中途加入' : '上车'}} · 还差 {{team.needCount}} 人</button>
    <button class="btn-primary" v-if="!role && team.displayStatus === 'full'" @tap="goPlaza(eventWithDataset($event, {}))">已满员，看看别的局</button>
  </view>
  <view class="actions" v-else>
    <view class="over-tip">{{team.displayStatus === 'cancelled' ? '这趟已经散了' : '这局已结束，下次再一起玩'}}</view>
    <button class="btn-ghost" @tap="goPlaza(eventWithDataset($event, {}))">回大厅</button>
    <button class="btn-primary" v-if="role === 'host'" @tap="onRepublish(eventWithDataset($event, {}))">再发一趟</button>
  </view>

  <view class="report-entry" v-if="role !== 'host'">
    <text @tap="onReport(eventWithDataset($event, {}))">举报这趟车</text>
  </view>
</view>

<view class="empty" v-else-if="loading">
  <view>正在找这趟车…</view>
</view>

<view class="empty" v-else>
  <view>找不到这趟车</view>
  <view class="empty-hint">{{teamId ? "这趟可能已经散了，或链接失效了。" : "链接不完整。让车头点「邀请好友」，把卡片直接发过来。"}}</view>
  <button class="btn-primary empty-btn" @tap="goPlaza(eventWithDataset($event, {}))">去大厅看看</button>
</view>

<profile-gate :show="showProfile" @done="onProfileDone({ detail: $event })" @close="onProfileClose({ detail: $event })" />
<canvas type="2d" id="shareCover" class="share-cover-canvas" v-if="team"></canvas>
<welcome-letter />

<view v-if="showManage && role === 'host'" class="manage-mask" @tap="closeManage(eventWithDataset($event, {}))" @touchmove.stop.prevent="stopManageTouch(eventWithDataset($event, {}))">
  <view class="manage-sheet" @tap.stop.prevent="stopManageTouch(eventWithDataset($event, {}))">
    <button class="manage-item" data-action="edit" @tap="onManageAction(eventWithDataset($event, {'action': 'edit'}))">编辑组队</button>
    <button class="manage-item manage-danger" data-action="cancel" @tap="onManageAction(eventWithDataset($event, {'action': 'cancel'}))">散了这趟</button>
    <button class="manage-item manage-dismiss" @tap="closeManage(eventWithDataset($event, {}))">取消</button>
  </view>
</view>

<view v-if="showMemberProfile" class="manage-mask" @tap="closeMemberProfile(eventWithDataset($event, {}))" @touchmove.stop.prevent="stopManageTouch(eventWithDataset($event, {}))">
  <view class="public-profile-sheet" @tap.stop.prevent="stopManageTouch(eventWithDataset($event, {}))">
    <view class="public-profile-heading"><text>公开资料</text><button size="mini" class="public-close" @tap="closeMemberProfile(eventWithDataset($event, {}))" aria-label="关闭公开资料">×</button></view>
    <scroll-view class="public-profile-content" scroll-y>
      <view v-if="memberProfileLoading" class="profile-placeholder">正在加载队友资料…</view>
      <view v-else-if="memberProfileError" class="profile-placeholder"><view>{{memberProfileError}}</view><button class="profile-retry" @tap="loadMemberProfile(eventWithDataset($event, {}))">重新加载</button></view>
      <view v-else-if="memberProfile">
        <view class="public-identity"><image class="public-avatar" :src="memberProfile.avatarUrl || (memberProfile.avatarBase64 ? 'data:image/jpeg;base64,' + memberProfile.avatarBase64 : '/static/images/avatar.png')" mode="aspectFill" /><view class="public-name">{{memberProfile.nickName}}</view></view>
        <view class="public-bio" v-if="memberProfile.bio" selectable>{{memberProfile.bio}}</view>
        <view v-else class="profile-placeholder">这位队友还没有填写签名</view>
      </view>
    </scroll-view>
  </view>
</view>

</template>

</template>
<style scoped>
.page { padding-bottom: calc(230rpx + env(safe-area-inset-bottom)); }
.card { padding: 28rpx; margin-bottom: 22rpx; background: #fff; border: 1rpx solid #e9ebf3; border-radius: 28rpx; }
.hero { background: linear-gradient(145deg, #eeecff 0%, #ffffff 78%); border-color: #e3dffa; padding: 32rpx; }
.status-row { display: flex; gap: 14rpx; align-items: center; }
.status { font-size: 23rpx; padding: 6rpx 16rpx; border-radius: 10rpx; background: #f0f1f6; color: #777e92; }
.status-recruiting { background: #6255e7; color: #fff; }
.status-full { color: #21876f; background: #e9f7f3; }
.soon { font-size: 23rpx; color: #6255e7; }
.started { font-size: 23rpx; padding: 6rpx 16rpx; border-radius: 10rpx; color: #6255e7; background: #eeecff; }
.game { margin-top: 22rpx; font-size: 52rpx; font-weight: 700; line-height: 1.3; word-break: break-all; }
.proxy-tip { margin-top: 12rpx; font-size: 24rpx; color: #6255e7; }
.time { margin-top: 16rpx; font-size: 29rpx; font-weight: 500; color: #535b72; line-height: 1.6; }
.count { margin-top: 16rpx; font-size: 40rpx; font-weight: 700; }
.need { margin-left: 16rpx; font-size: 25rpx; font-weight: 400; color: #6255e7; }
.tags { margin-top: 20rpx; display: flex; flex-wrap: wrap; gap: 10rpx; }
.tags text { background: #f1f2f9; color: #697188; font-size: 23rpx; padding: 7rpx 14rpx; border-radius: 9rpx; }
.note-wrap { margin-top: 22rpx; padding-top: 20rpx; border-top: 1rpx solid #e9ebf3; }
.note { font-size: 27rpx; color: #535b72; line-height: 1.7; word-break: break-all; white-space: pre-wrap; }
.note-collapsed {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  text-overflow: ellipsis;
}
.note-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #6255e7;
  font-weight: 500;
  padding: 6rpx 0;
}
.note-toggle:active { opacity: 0.7; }
.note-chevron {
  width: 10rpx;
  height: 10rpx;
  border-right: 3rpx solid currentColor;
  border-bottom: 3rpx solid currentColor;
  transform: translateY(-3rpx) rotate(45deg);
  transition: transform 0.2s ease;
}
.note-chevron-up {
  transform: translateY(3rpx) rotate(225deg);
}
button.notify-link { display: inline-flex; width: auto; min-height: 68rpx; align-items: center; padding: 8rpx 0; box-sizing: border-box; font-size: 24rpx; color: #6255e7; line-height: 1.5; text-align: left; }
.notify-authorized { color: #777e92; }
.notify-arrow { margin-left: 12rpx; font-size: 28rpx; }
.notify-hint, .hint { font-size: 24rpx; line-height: 1.6; color: #777e92; }
.card-title { font-size: 29rpx; font-weight: 600; }
.copy-row { display: flex; gap: 16rpx; align-items: center; padding: 22rpx 0; }
.copy-label { width: 140rpx; flex-shrink: 0; font-size: 24rpx; color: #777e92; }
.copy-val { flex: 1; min-width: 0; font-size: 28rpx; word-break: break-all; }
.copy-btn { font-size: 23rpx; color: #6255e7; flex-shrink: 0; }
.members-heading { display: flex; align-items: center; justify-content: space-between; }
.member-total { font-size: 24rpx; color: #777e92; }
.seats { display: flex; flex-wrap: wrap; margin: 26rpx -8rpx 0; }
.seat { width: 20%; padding: 0 6rpx 12rpx; box-sizing: border-box; text-align: center; }
.seat-avatar, .seat-empty { width: 80rpx; height: 80rpx; border-radius: 26rpx; display: block; margin: 0 auto; background: #f1f2f9; }
.seat-empty { box-sizing: border-box; border: 2rpx dashed #d8d4f3; line-height: 76rpx; color: #ada5e8; font-size: 38rpx; background: #faf9ff; }
.seat-name { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 22rpx; margin-top: 12rpx; color: #535b72; }
.seat-wait { color: #969cb0; }
.host-tag { display: inline-block; font-size: 20rpx; color: #6255e7; margin-top: 8rpx; }
.actions { position: fixed; z-index: 10; bottom: 0; left: 0; right: 0; padding: 22rpx 32rpx calc(22rpx + env(safe-area-inset-bottom)); background: #fff; border-top: 1rpx solid #e9ebf3; display: flex; flex-wrap: wrap; gap: 16rpx; }
.actions button { flex: 1; min-width: 0; }
.actions .compact-action { flex: 0 0 160rpx; }
.over-tip { width: 100%; text-align: center; color: #777e92; font-size: 24rpx; }
.empty-hint { margin-top: 8rpx; font-size: 24rpx; color: #969cb0; }
.empty-btn { width: 300rpx !important; margin: 36rpx auto 0; }

.manage-mask { position: fixed; inset: 0; z-index: 100; background: rgba(0, 0, 0, .45); display: flex; align-items: flex-end; }
.manage-sheet { width: 100%; background: #fff; border-radius: 26rpx 26rpx 0 0; overflow: hidden; padding-bottom: env(safe-area-inset-bottom); }
button.manage-item { width: 100% !important; margin: 0; padding: 28rpx 24rpx; line-height: 44rpx; font-size: 32rpx; font-weight: 400; color: #202438; border-radius: 0; background: #fff; border-bottom: 1rpx solid #f0f1f6; box-sizing: border-box; }
button.manage-danger { color: #e5484d; }
button.manage-dismiss { border-top: 14rpx solid #f5f6fa; border-bottom: none; }

button.seat-profile { display: block; margin: 0 auto; padding: 0; width: 80rpx; height: 80rpx; min-width: 0; border-radius: 26rpx; background: transparent; line-height: 1; }
.member-profile-tip { font-size: 23rpx; color: #858ba0; margin-top: 10rpx; }
.public-profile-sheet { width: 100%; padding: 20rpx 32rpx calc(32rpx + env(safe-area-inset-bottom)); background: #fff; border-radius: 28rpx 28rpx 0 0; box-sizing: border-box; }
.public-profile-heading { display: flex; align-items: center; justify-content: space-between; font-size: 30rpx; font-weight: 600; }
button.public-close { margin: 0; padding: 0; width: 72rpx; line-height: 72rpx; font-size: 40rpx; color: #777e92; background: transparent; }
.public-profile-content { height: 52vh; }
.public-identity { display: flex; align-items: center; gap: 24rpx; margin: 20rpx 0; }
.public-avatar { width: 100rpx; height: 100rpx; border-radius: 32rpx; flex-shrink: 0; }
.public-name { font-size: 36rpx; font-weight: 700; word-break: break-all; }
.public-bio { color: #697188; font-size: 28rpx; line-height: 1.7; white-space: pre-wrap; word-break: break-word; margin-bottom: 24rpx; }
.profile-placeholder { padding: 50rpx 8rpx; color: #777e92; font-size: 26rpx; line-height: 1.6; text-align: center; }
button.profile-retry { margin: 24rpx auto 0; color: #6255e7; font-size: 26rpx; background: #eeecff; }
.report-entry { margin: 40rpx 0 120rpx; text-align: center; color: #969cb0; font-size: 23rpx; text-decoration: underline; }

/* 分享封面离屏预渲染用。得留在布局里（display:none 就查不到 canvas 节点），所以推出可视区藏起来 */
.share-cover-canvas { position: fixed; top: 0; left: -9999px; width: 375px; height: 300px; pointer-events: none; }

</style>
