<script setup lang="ts">
import { reactive, toRefs, nextTick } from 'vue';
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app';
import type { PageEvent, AdminRow, AdminStats } from '../../types/domain';
import { eventWithDataset } from "../../utils/state";
import { platform as hostPlatform } from "../../platform/host";

import { callTeam, showError } from "../../utils/cloud";
function formatTime(ts: number | undefined) {
    if (!ts)
        return "";
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function decorate(rows: AdminRow[], kind: string) {
    return (rows || []).map((r) => ({
        ...r,
        timeText: formatTime(r.createdAt),
        handled: r.status === "handled",
        tag: kind === "report" ? r.reason : kind === "bug" ? r.page : r.kind,
    }));
}
const TEAM_STATUS_TEXT: Record<string, string> = {
    recruiting: "缺人",
    full: "满员",
};
function decorateTeams(rows: AdminRow[]) {
    return (rows || []).map((t) => ({
        ...t,
        statusText: TEAM_STATUS_TEXT[t.displayStatus || ""] || t.displayStatus,
        timeText: formatTime(t.startAt),
    }));
}
function decorateStats(stats: AdminStats) {
    if (!stats)
        return stats;
    const games = stats.topGames || [];
    const maxScore = games.reduce((m, g) => Math.max(m, g.score || 0), 0) || 1;
    const trend = stats.trend || [];
    const maxTrend = trend.reduce((m, t) => Math.max(m, t.count || 0), 0) || 1;
    const platforms = stats.platforms || [];
    const maxPlatform = platforms.reduce((m, p) => Math.max(m, p.count || 0), 0) || 1;
    return {
        ...stats,
        topGames: games.map((g) => ({
            ...g,
            pct: Math.max(6, Math.round(((g.score || 0) / maxScore) * 100)),
        })),
        trend: trend.map((t) => ({
            ...t,
            pct: Math.max(4, Math.round(((t.count || 0) / maxTrend) * 100)),
        })),
        platforms: platforms.map((p) => ({
            ...p,
            pct: Math.max(6, Math.round(((p.count || 0) / maxPlatform) * 100)),
        })),
    };
}
const state = reactive({ allUsers: [] as AdminRow[], singlePage: false, ...{
        tab: "overview",
        loading: true,
        denied: false,
        stats: null as AdminStats | null,
        list: [] as AdminRow[],
        onlyOpen: true,
        userKeyword: "",
        bannedOnly: false,
        userTotal: 0,
    } });
const { singlePage, tab, loading, denied, stats, list, onlyOpen, userKeyword, bannedOnly, userTotal } = toRefs(state);
function patchState(patch: Partial<typeof state>, done?: () => void) {
  Object.assign(state, patch);
  if (done) void nextTick(done);
}
async function load() {
    patchState({ loading: true });
    try {
        if (state.tab === "overview") {
            const res = await callTeam("adminOverview");
            patchState({ stats: decorateStats(res.stats), denied: false, loading: false });
        }
        else if (state.tab === "teams") {
            const res = await callTeam("adminTeams", {});
            patchState({ list: decorateTeams(res.list), denied: false, loading: false });
        }
        else if (state.tab === "users") {
            const res = await callTeam("adminUsers", {});
            patchState({
                userTotal: res.total || 0,
                denied: false,
                loading: false,
            });
            applyUsersFilter(res.list || []);
        }
        else {
            const res = await loadList();
            patchState({ list: res, denied: false, loading: false });
        }
    }
    catch (error) {
        const e: Error & { code?: string } = error instanceof Error ? error : new Error(String(error));
        patchState({ loading: false });
        if ((e.message || "").indexOf("管理权限") >= 0) {
            patchState({ denied: true });
        }
        else {
            showError(e);
        }
    }
}
function applyUsersFilter(rows?: AdminRow[], keywordInput?: string) {
    const source = rows || state.allUsers || [];
    state.allUsers = source;
    const keyword = String(keywordInput === undefined ? state.userKeyword || "" : keywordInput)
        .trim()
        .toLowerCase();
    const list = source.filter((u) => {
        if (state.bannedOnly && !u.banned)
            return false;
        if (!keyword)
            return true;
        return ((u.nickName || "").toLowerCase().includes(keyword) ||
            (u.openid || "").toLowerCase().includes(keyword));
    });
    patchState({ list });
}
function onUserSearch(e: PageEvent) {
    const userKeyword = e.detail.value;
    patchState({ userKeyword });
    applyUsersFilter(state.allUsers, userKeyword);
}
function toggleBannedOnly() {
    patchState({ bannedOnly: !state.bannedOnly });
    applyUsersFilter();
}
function onBan(e: PageEvent) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || "该用户";
    hostPlatform.showModal({
        title: "封禁用户？",
        editable: true,
        placeholderText: "封禁原因（可选）",
        content: "",
        confirmColor: "#c1121f",
        success: async (res) => {
            if (!res.confirm)
                return;
            await setBan(id, true, (res.content || "").trim(), `${name} 已封禁`);
        },
    });
}
function onUnban(e: PageEvent) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || "该用户";
    hostPlatform.showModal({
        title: "解封用户？",
        content: `将恢复「${name}」的发车、上车与提交权限。`,
        success: async (res) => {
            if (!res.confirm)
                return;
            await setBan(id, false, "", `${name} 已解封`);
        },
    });
}
async function setBan(id: string, banned: boolean, reason: string, toast: string) {
    try {
        await callTeam("adminSetBan", { userId: id, banned, reason });
        hostPlatform.showToast({ title: toast, icon: "none" });
        state.allUsers = (state.allUsers || []).map((u) => u._id === id
            ? { ...u, banned, banReason: reason, isOrganizer: banned ? false : u.isOrganizer }
            : u);
        applyUsersFilter();
    }
    catch (err) {
        showError(err);
    }
}
function onToggleOrganizer(e: PageEvent) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || "该用户";
    const enabled = String(e.currentTarget.dataset.on) !== "true";
    hostPlatform.showModal({
        title: enabled ? "设为组局员？" : "取消组局员？",
        content: enabled
            ? `「${name}」将可以帮群友发车，但不能进入管理端。`
            : `「${name}」将不能再帮别人发车。`,
        success: async (res) => {
            if (!res.confirm)
                return;
            try {
                await callTeam("adminSetOrganizer", { userId: id, enabled });
                state.allUsers = (state.allUsers || []).map((u) => u._id === id ? { ...u, isOrganizer: enabled } : u);
                applyUsersFilter();
                hostPlatform.showToast({
                    title: enabled ? "已设为组局员" : "已取消组局员",
                    icon: "none",
                });
            }
            catch (err) {
                showError(err);
            }
        },
    });
}
function onCloseTeam(e: PageEvent) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || "这趟车";
    hostPlatform.showModal({
        title: "强制关闭？",
        content: `将关闭「${name}」并通知车上所有人。`,
        confirmColor: "#c1121f",
        success: async (res) => {
            if (!res.confirm)
                return;
            try {
                await callTeam("adminCancelTeam", { teamId: id });
                hostPlatform.showToast({ title: "已关闭", icon: "success" });
                patchState({ list: state.list.filter((t) => t._id !== id) });
            }
            catch (err) {
                showError(err);
            }
        },
    });
}
async function loadList() {
    if (state.tab === "feedback") {
        const res = await callTeam("adminFeedback", {
            status: state.onlyOpen ? "open" : "",
        });
        return decorate(res.list, "feedback");
    }
    const kind = state.tab === "bug" ? "bug" : "report";
    const res = await callTeam("adminReports", {
        kind,
        status: state.onlyOpen ? "open" : "",
    });
    return decorate(res.list, kind);
}
async function pickTab(e: PageEvent) {
    patchState({ tab: e.currentTarget.dataset.tab });
    await load();
}
async function toggleOpen() {
    patchState({ onlyOpen: !state.onlyOpen });
    if (state.tab !== "overview")
        await load();
}
async function onHandle(e: PageEvent) {
    const id = e.currentTarget.dataset.id;
    // WXML dataset 一律是字符串，"false" 也是真值，这里显式转换成布尔。
    const handled = String(e.currentTarget.dataset.handled) === "true";
    const next = handled ? "open" : "handled";
    try {
        if (state.tab === "feedback") {
            await callTeam("adminHandleFeedback", { feedbackId: id, status: next });
        }
        else {
            await callTeam("adminHandleReport", { reportId: id, status: next });
        }
        const list = state.list.map((r) => r._id === id ? { ...r, handled: next === "handled" } : r);
        patchState({ list });
        hostPlatform.showToast({ title: next === "handled" ? "已处理" : "已重开", icon: "none" });
    }
    catch (err) {
        showError(err);
    }
}
onLoad(() => {
    load();
});
onPullDownRefresh(() => {
    return load().finally(() => hostPlatform.stopPullDownRefresh());
});
</script>
<template>
<view class="page">
  <view class="page-heading">管理端</view>
  <view class="page-caption">数据概览、举报与报错处理、意见反馈。仅你能进；组局员只能代开发车。</view>

  <view class="denied" v-if="denied">
    <view>你没有管理权限。</view>
    <view class="denied-sub">请联系开发者把你的 OpenID 加入 admins 集合或 ADMIN_OPENIDS。</view>
  </view>

  <template v-else>
    <scroll-view class="tabs" scroll-x enhanced :show-scrollbar="false">
      <view class="tabs-inner">
        <button size="mini" :class="'tab ' + (tab === 'overview' ? 'tab-active' : '')" data-tab="overview" @tap="pickTab(eventWithDataset($event, {'tab': 'overview'}))">概览</button>
        <button size="mini" :class="'tab ' + (tab === 'teams' ? 'tab-active' : '')" data-tab="teams" @tap="pickTab(eventWithDataset($event, {'tab': 'teams'}))">组队</button>
        <button size="mini" :class="'tab ' + (tab === 'users' ? 'tab-active' : '')" data-tab="users" @tap="pickTab(eventWithDataset($event, {'tab': 'users'}))">用户</button>
        <button size="mini" :class="'tab ' + (tab === 'report' ? 'tab-active' : '')" data-tab="report" @tap="pickTab(eventWithDataset($event, {'tab': 'report'}))">举报</button>
        <button size="mini" :class="'tab ' + (tab === 'bug' ? 'tab-active' : '')" data-tab="bug" @tap="pickTab(eventWithDataset($event, {'tab': 'bug'}))">报错</button>
        <button size="mini" :class="'tab ' + (tab === 'feedback' ? 'tab-active' : '')" data-tab="feedback" @tap="pickTab(eventWithDataset($event, {'tab': 'feedback'}))">反馈</button>
      </view>
    </scroll-view>

    <view v-if="loading" class="empty">加载中…</view>

    <!-- 概览 -->
    <template v-else-if="tab === 'overview' && stats">
      <view class="stat-grid">
        <view class="stat-card"><view class="stat-num">{{stats.teams.total}}</view><view class="stat-label">累计组队</view></view>
        <view class="stat-card"><view class="stat-num">{{stats.teams.active}}</view><view class="stat-label">进行中</view></view>
        <view class="stat-card"><view class="stat-num">{{stats.teams.recruiting}}</view><view class="stat-label">缺人中</view></view>
        <view class="stat-card"><view class="stat-num">{{stats.teams.full}}</view><view class="stat-label">满员中</view></view>
        <view class="stat-card"><view class="stat-num">{{stats.users.total}}</view><view class="stat-label">用户数</view></view>
        <view class="stat-card"><view class="stat-num">{{stats.members.total}}</view><view class="stat-label">上车人次</view></view>
        <view :class="'stat-card ' + (stats.reports.open ? 'stat-warn' : '')"><view class="stat-num">{{stats.reports.open}}</view><view class="stat-label">待处理举报/报错</view></view>
        <view :class="'stat-card ' + (stats.feedback.open ? 'stat-warn' : '')"><view class="stat-num">{{stats.feedback.open}}</view><view class="stat-label">待处理反馈</view></view>
      </view>

      <view class="card">
        <view class="card-title">最活跃的游戏</view>
        <view class="card-sub">按进行中场次、总场次与上车人次综合排序</view>
        <view v-if="!stats.topGames.length" class="card-empty">还没有数据</view>
        <template v-for="(item, index) in stats.topGames" :key="item.gameName"><view class="bar-row">
          <view class="bar-head"><text class="bar-name">{{item.gameName}}</text><text class="bar-val">{{item.active}} 进行中 · 共 {{item.teams}} 场</text></view>
          <view class="bar-track"><view class="bar-fill" :style="'width: ' + (item.pct) + '%'"></view></view>
        </view></template>
      </view>

      <view class="card">
        <view class="card-title">平台分布</view>
        <view v-if="!stats.platforms.length" class="card-empty">还没有数据</view>
        <template v-for="(item, index) in stats.platforms" :key="item.platform"><view class="bar-row">
          <view class="bar-head"><text class="bar-name">{{item.platform}}</text><text class="bar-val">{{item.count}}</text></view>
          <view class="bar-track"><view class="bar-fill alt" :style="'width: ' + (item.pct) + '%'"></view></view>
        </view></template>
      </view>

      <view class="card">
        <view class="card-title">近 7 天发车</view>
        <view class="trend">
          <template v-for="(item, index) in stats.trend" :key="item.date"><view class="trend-col">
            <view class="trend-bar-wrap"><view class="trend-bar" :style="'height: ' + (item.pct) + '%'"></view></view>
            <view class="trend-count">{{item.count}}</view>
            <view class="trend-date">{{item.date}}</view>
          </view></template>
        </view>
      </view>
    </template>

    <!-- 进行中的组队：可强制关闭 -->
    <template v-else-if="tab === 'teams'">
      <view class="list-toolbar">
        <text class="toolbar-count">进行中 {{list.length}} 趟</text>
      </view>
      <view v-if="!list.length" class="empty">当前没有进行中的组队</view>
      <template v-for="(item, index) in list" :key="item._id"><view class="team-record card">
        <view class="team-record-head">
          <view class="team-game">{{item.gameName}}</view>
          <view :class="'team-status status-' + (item.displayStatus)">{{item.statusText}}</view>
        </view>
        <view class="team-meta">
          <text>{{item.memberCount}}/{{item.capacity}} 人</text>
          <text>车头：{{item.hostNickName}}</text>
          <text v-if="item.platform">{{item.platform}}</text>
          <text>{{item.timeText}} 开打</text>
          <text v-if="item.started" class="team-started">已开始</text>
        </view>
        <button class="btn-ghost team-close" :data-id="item._id" :data-name="item.gameName" @tap="onCloseTeam(eventWithDataset($event, {'id': item._id, 'name': item.gameName}))">强制关闭</button>
      </view></template>
    </template>

    <!-- 用户：搜索、封禁 / 解封 -->
    <template v-else-if="tab === 'users'">
      <view class="user-toolbar">
        <input class="user-search" :value="userKeyword" placeholder="搜昵称或 OpenID" @input="onUserSearch(eventWithDataset($event, {}))" />
        <view class="toolbar-filter" @tap="toggleBannedOnly()">{{bannedOnly ? '只看已封禁' : '全部用户'}} ⇄</view>
      </view>
      <view class="list-toolbar"><text class="toolbar-count">共 {{userTotal}} 人 · 显示 {{list.length}} 人</text></view>
      <view v-if="!list.length" class="empty">没有符合条件的用户</view>
      <template v-for="(item, index) in list" :key="item._id"><view :class="'user-record card ' + (item.banned ? 'user-banned' : '')">
        <view class="user-head">
          <view class="user-name">{{item.nickName}}</view>
          <view class="user-badges">
            <view class="user-state" v-if="item.banned">已封禁</view>
            <view class="user-organizer" v-if="item.isOrganizer">组局员</view>
          </view>
        </view>
        <view class="user-openid">{{item.openid}}</view>
        <view class="user-meta">
          <text>发车 {{item.hosted}}</text>
          <text>上车 {{item.joined}}</text>
          <text v-if="item.banReason" class="user-reason">原因：{{item.banReason}}</text>
        </view>
        <button v-if="!item.banned" class="btn-ghost user-ban" :data-id="item._id" :data-name="item.nickName" @tap="onBan(eventWithDataset($event, {'id': item._id, 'name': item.nickName}))">封禁</button>
        <button v-else class="btn-ghost user-unban" :data-id="item._id" :data-name="item.nickName" @tap="onUnban(eventWithDataset($event, {'id': item._id, 'name': item.nickName}))">解封</button>
        <button v-if="!item.banned && !item.envOrganizer" class="btn-ghost user-organizer-btn" :data-id="item._id" :data-name="item.nickName" :data-on="item.isOrganizer" @tap="onToggleOrganizer(eventWithDataset($event, {'id': item._id, 'name': item.nickName, 'on': item.isOrganizer}))">{{item.isOrganizer ? '取消组局员' : '设为组局员'}}</button>
      </view></template>
    </template>

    <!-- 列表：举报 / 报错 / 反馈 -->
    <template v-else-if="tab !== 'overview'">
      <view class="list-toolbar">
        <text class="toolbar-count">{{list.length}} 条</text>
        <view class="toolbar-filter" @tap="toggleOpen()">{{onlyOpen ? '只看未处理' : '全部记录'}} ⇄</view>
      </view>
      <view v-if="!list.length" class="empty">暂时没有记录</view>
      <template v-for="(item, index) in list" :key="item._id"><view :class="'record card ' + (item.handled ? 'record-done' : '')">
        <view class="record-head">
          <view class="record-tag">{{item.tag}}</view>
          <text class="record-time">{{item.timeText}}</text>
        </view>
        <view class="record-body">{{item.content || '（无补充说明）'}}</view>
        <view class="record-error" v-if="item.errorMsg">报错：{{item.errorMsg}}</view>
        <view class="record-meta">
          <text v-if="item.targetName">对象：{{item.targetName}}</text>
          <text v-if="item.kind === 'report' && item.hostOpenid">车头：{{item.hostOpenid}}</text>
          <text v-if="item.page">页面：{{item.page}}</text>
          <text v-if="item.nickName">用户：{{item.nickName}}</text>
          <text v-if="item.version">版本：{{item.version}}</text>
          <text v-if="item.systemInfo">{{item.systemInfo}}</text>
        </view>
        <button class="btn-ghost record-btn" :data-id="item._id" :data-handled="item.handled" @tap="onHandle(eventWithDataset($event, {'id': item._id, 'handled': item.handled}))">{{item.handled ? '重新打开' : '标记已处理'}}</button>
      </view></template>
    </template>
  </template>
</view>

</template>
<style scoped>
.denied { margin-top: 60rpx; text-align: center; color: #777e92; font-size: 28rpx; line-height: 1.8; }
.denied-sub { font-size: 23rpx; color: #a0a6b8; margin-top: 10rpx; }
.tabs { margin: 28rpx 0 8rpx; border-bottom: 1rpx solid #e5e8f1; white-space: nowrap; }
.tabs-inner { display: inline-flex; gap: 24rpx; }
button.tab { width: auto; min-width: 0; padding: 0 0 20rpx; color: #858ba0; font-size: 30rpx; font-weight: 600; }
.tab-active { color: #202438; border-bottom: 5rpx solid #6255e7; }
.stat-grid { display: flex; flex-wrap: wrap; gap: 18rpx; margin-top: 24rpx; }
.stat-card { flex: 1 1 calc(25% - 18rpx); min-width: 150rpx; background: #fff; border: 1rpx solid #e9ebf3; border-radius: 22rpx; padding: 22rpx 18rpx; }
.stat-warn { background: #fff5f6; border-color: #f3c3ce; }
.stat-num { font-size: 42rpx; font-weight: 700; line-height: 1.2; }
.stat-warn .stat-num { color: #c54d69; }
.stat-label { margin-top: 6rpx; font-size: 22rpx; color: #777e92; }
.card { margin-top: 24rpx; background: #fff; border: 1rpx solid #e9ebf3; border-radius: 26rpx; padding: 26rpx 28rpx; }
.card-title { font-size: 30rpx; font-weight: 700; }
.card-sub { margin-top: 6rpx; font-size: 22rpx; color: #a0a6b8; }
.card-empty { padding: 40rpx 0; text-align: center; color: #a0a6b8; font-size: 24rpx; }
.bar-row { margin-top: 24rpx; }
.bar-head { display: flex; align-items: baseline; justify-content: space-between; }
.bar-name { font-size: 26rpx; font-weight: 600; word-break: break-all; }
.bar-val { font-size: 22rpx; color: #858ba0; flex-shrink: 0; margin-left: 16rpx; }
.bar-track { margin-top: 10rpx; height: 16rpx; background: #f0f1f6; border-radius: 8rpx; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 8rpx; background: linear-gradient(90deg, #7d72f0, #6255e7); }
.bar-fill.alt { background: linear-gradient(90deg, #6bc6a8, #3fa883); }
.trend { display: flex; align-items: flex-end; gap: 12rpx; margin-top: 24rpx; height: 220rpx; }
.trend-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
.trend-bar-wrap { flex: 1; width: 100%; display: flex; align-items: flex-end; }
.trend-bar { width: 100%; min-height: 6rpx; background: #6255e7; border-radius: 8rpx 8rpx 0 0; }
.trend-count { font-size: 20rpx; color: #777e92; margin-top: 8rpx; }
.trend-date { font-size: 19rpx; color: #a0a6b8; }
.list-toolbar { display: flex; align-items: center; justify-content: space-between; margin: 24rpx 0 8rpx; }
.toolbar-count { font-size: 24rpx; color: #858ba0; }
.toolbar-filter { font-size: 24rpx; color: #6255e7; }
.record { margin-top: 18rpx; }
.record-done { opacity: .6; }
.record-head { display: flex; align-items: center; justify-content: space-between; }
.record-tag { font-size: 22rpx; color: #6255e7; background: #eeecff; border-radius: 10rpx; padding: 6rpx 14rpx; }
.record-time { font-size: 22rpx; color: #a0a6b8; }
.record-body { margin-top: 16rpx; font-size: 27rpx; line-height: 1.7; color: #202438; white-space: pre-wrap; word-break: break-all; }
.record-error { margin-top: 12rpx; padding: 14rpx 16rpx; background: #f7f8fc; border-radius: 12rpx; font-size: 23rpx; color: #c54d69; word-break: break-all; }
.record-meta { margin-top: 14rpx; display: flex; flex-wrap: wrap; gap: 8rpx 20rpx; font-size: 22rpx; color: #858ba0; }
.record-meta text { word-break: break-all; }
.record-btn { margin-top: 20rpx; min-height: 68rpx; line-height: 40rpx; font-size: 25rpx; }
.team-record { margin-top: 18rpx; }
.team-record-head { display: flex; align-items: center; justify-content: space-between; }
.team-game { font-size: 30rpx; font-weight: 700; word-break: break-all; }
.team-status { font-size: 22rpx; border-radius: 10rpx; padding: 6rpx 14rpx; }
.status-recruiting { color: #6255e7; background: #eeecff; }
.status-full { color: #3fa883; background: #e6f5f0; }
.team-meta { margin-top: 14rpx; display: flex; flex-wrap: wrap; gap: 8rpx 20rpx; font-size: 23rpx; color: #777e92; }
.team-started { color: #c54d69; }
.team-close { margin-top: 20rpx; min-height: 68rpx; line-height: 40rpx; font-size: 25rpx; color: #c54d69; background: #feecef; }
.user-toolbar { display: flex; align-items: center; gap: 16rpx; margin-top: 24rpx; }
.user-search { flex: 1; min-width: 0; height: 72rpx; padding: 0 22rpx; background: #fff; border: 1rpx solid #e9ebf3; border-radius: 16rpx; font-size: 26rpx; box-sizing: border-box; }
.user-record { margin-top: 18rpx; }
.user-banned { background: #fff7f8; border-color: #f3c3ce; }
.user-head { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.user-name { font-size: 30rpx; font-weight: 700; word-break: break-all; }
.user-badges { display: flex; flex-shrink: 0; gap: 8rpx; }
.user-state { font-size: 22rpx; color: #c54d69; background: #feecef; border-radius: 10rpx; padding: 6rpx 14rpx; }
.user-organizer { font-size: 22rpx; color: #6255e7; background: #eeecff; border-radius: 10rpx; padding: 6rpx 14rpx; }
.user-openid { margin-top: 8rpx; font-size: 21rpx; color: #a0a6b8; word-break: break-all; }
.user-meta { margin-top: 12rpx; display: flex; flex-wrap: wrap; gap: 8rpx 20rpx; font-size: 23rpx; color: #777e92; }
.user-reason { color: #c54d69; word-break: break-all; }
.user-ban { margin-top: 20rpx; min-height: 68rpx; line-height: 40rpx; font-size: 25rpx; color: #c54d69; background: #feecef; }
.user-unban { margin-top: 20rpx; min-height: 68rpx; line-height: 40rpx; font-size: 25rpx; }
.user-organizer-btn { margin-top: 12rpx; min-height: 68rpx; line-height: 40rpx; font-size: 25rpx; }

</style>
