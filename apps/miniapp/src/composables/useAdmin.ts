import { usePageFeedback } from './usePageFeedback';
import { reactive, toRefs, nextTick } from 'vue';
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app';
import type { AdminRow, AdminStats } from '../types/domain';
import { platform as hostPlatform } from '../platform/host';
import { callTeam } from '../api/team';
export function useAdmin() {
  const { toast, dialog, showError } = usePageFeedback();
  function formatTime(ts: number | undefined) {
    if (!ts) return '';
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function decorate(rows: AdminRow[], kind: string) {
    return (rows || []).map((r) => ({
      ...r,
      timeText: formatTime(r.createdAt),
      handled: r.status === 'handled',
      tag: kind === 'report' ? r.reason : kind === 'bug' ? r.page : r.kind,
    }));
  }
  const TEAM_STATUS_TEXT: Record<string, string> = {
    recruiting: '缺人',
    full: '满员',
  };
  function decorateTeams(rows: AdminRow[]) {
    return (rows || []).map((t) => ({
      ...t,
      statusText: TEAM_STATUS_TEXT[t.displayStatus || ''] || t.displayStatus,
      timeText: formatTime(t.startAt),
    }));
  }
  function decorateStats(stats: AdminStats) {
    if (!stats) return stats;
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
  const state = reactive({
    allUsers: [] as AdminRow[],
    singlePage: false,
    ...{
      tab: 'overview',
      loading: true,
      denied: false,
      stats: null as AdminStats | null,
      list: [] as AdminRow[],
      onlyOpen: true,
      userKeyword: '',
      bannedOnly: false,
      userTotal: 0,
    },
  });
  const { singlePage, tab, loading, denied, stats, list, onlyOpen, userKeyword, bannedOnly, userTotal } =
    toRefs(state);
  function patchState(patch: Partial<typeof state>, done?: () => void) {
    Object.assign(state, patch);
    if (done) void nextTick(done);
  }
  async function load() {
    patchState({ loading: true });
    try {
      if (state.tab === 'fixed') {
        await callTeam('adminFixedTeams');
        patchState({ denied: false, loading: false });
      } else if (state.tab === 'overview') {
        const res = await callTeam('adminOverview');
        patchState({ stats: decorateStats(res.stats), denied: false, loading: false });
      } else if (state.tab === 'teams') {
        const res = await callTeam('adminTeams', {});
        patchState({ list: decorateTeams(res.list), denied: false, loading: false });
      } else if (state.tab === 'users') {
        const res = await callTeam('adminUsers', {});
        patchState({
          userTotal: res.total || 0,
          denied: false,
          loading: false,
        });
        applyUsersFilter(res.list || []);
      } else {
        const res = await loadList();
        patchState({ list: res, denied: false, loading: false });
      }
    } catch (error) {
      const e: Error & { code?: string } = error instanceof Error ? error : new Error(String(error));
      patchState({ loading: false });
      if ((e.message || '').indexOf('管理权限') >= 0) {
        patchState({ denied: true });
      } else {
        showError(e);
      }
    }
  }
  function applyUsersFilter(rows?: AdminRow[], keywordInput?: string) {
    const source = rows || state.allUsers || [];
    state.allUsers = source;
    const keyword = String(keywordInput === undefined ? state.userKeyword || '' : keywordInput)
      .trim()
      .toLowerCase();
    const list = source.filter((u) => {
      if (state.bannedOnly && !u.banned) return false;
      if (!keyword) return true;
      return (
        (u.nickName || '').toLowerCase().includes(keyword) || (u.openid || '').toLowerCase().includes(keyword)
      );
    });
    patchState({ list });
  }
  function onUserSearch(input: string) {
    const userKeyword = input;
    patchState({ userKeyword });
    applyUsersFilter(state.allUsers, userKeyword);
  }
  function toggleBannedOnly() {
    patchState({ bannedOnly: !state.bannedOnly });
    applyUsersFilter();
  }
  function onBan(input: { id: string; name: string }) {
    const id = input.id;
    const name = input.name || '该用户';
    void dialog
      .prompt({
        title: '封禁用户？',
        msg: '',
        inputProps: { placeholder: '封禁原因（可选）' },
        confirmButtonProps: { type: 'danger' },
      })
      .then(async ({ value }) => {
        await setBan(id, true, String(value || '').trim(), `${name} 已封禁`);
      })
      .catch(() => {});
  }
  function onUnban(input: { id: string; name: string }) {
    const id = input.id;
    const name = input.name || '该用户';
    void dialog
      .confirm({ title: '解封用户？', msg: `将恢复「${name}」的发车、上车与提交权限。` })
      .then(async () => {
        await setBan(id, false, '', `${name} 已解封`);
      })
      .catch(() => {});
  }
  async function setBan(id: string, banned: boolean, reason: string, toastText: string) {
    try {
      await callTeam('adminSetBan', { userId: id, banned, reason });
      toast.show(toastText);
      state.allUsers = (state.allUsers || []).map((u) =>
        u._id === id ? { ...u, banned, banReason: reason, isOrganizer: banned ? false : u.isOrganizer } : u,
      );
      applyUsersFilter();
    } catch (err) {
      showError(err);
    }
  }
  function onToggleOrganizer(input: { id: string; name: string; on: boolean | string }) {
    const id = input.id;
    const name = input.name || '该用户';
    const enabled = String(input.on) !== 'true';
    void dialog
      .confirm({
        title: enabled ? '设为组局员？' : '取消组局员？',
        msg: enabled ? `「${name}」将可以帮群友发车，但不能进入管理端。` : `「${name}」将不能再帮别人发车。`,
      })
      .then(async () => {
        try {
          await callTeam('adminSetOrganizer', { userId: id, enabled });
          state.allUsers = (state.allUsers || []).map((u) =>
            u._id === id ? { ...u, isOrganizer: enabled } : u,
          );
          applyUsersFilter();
          toast.show(enabled ? '已设为组局员' : '已取消组局员');
        } catch (err) {
          showError(err);
        }
      })
      .catch(() => {});
  }
  function onCloseTeam(input: { id: string; name: string }) {
    const id = input.id;
    const name = input.name || '这趟车';
    void dialog
      .confirm({
        title: '强制关闭？',
        msg: `将关闭「${name}」并通知车上所有人。`,
        confirmButtonProps: { type: 'danger' },
      })
      .then(async () => {
        try {
          await callTeam('adminCancelTeam', { teamId: id });
          toast.success('已关闭');
          patchState({ list: state.list.filter((t) => t._id !== id) });
        } catch (err) {
          showError(err);
        }
      })
      .catch(() => {});
  }
  async function loadList() {
    if (state.tab === 'feedback') {
      const res = await callTeam('adminFeedback', {
        status: state.onlyOpen ? 'open' : '',
      });
      return decorate(res.list, 'feedback');
    }
    const kind = state.tab === 'bug' ? 'bug' : 'report';
    const res = await callTeam('adminReports', {
      kind,
      status: state.onlyOpen ? 'open' : '',
    });
    return decorate(res.list, kind);
  }
  async function pickTab(input: string) {
    patchState({ tab: input });
    await load();
  }
  async function toggleOpen() {
    patchState({ onlyOpen: !state.onlyOpen });
    if (state.tab !== 'overview') await load();
  }
  async function onHandle(input: { id: string; handled: boolean | string }) {
    const id = input.id;
    // WXML dataset 一律是字符串，"false" 也是真值，这里显式转换成布尔。
    const handled = String(input.handled) === 'true';
    const next = handled ? 'open' : 'handled';
    try {
      if (state.tab === 'feedback') {
        await callTeam('adminHandleFeedback', { feedbackId: id, status: next });
      } else {
        await callTeam('adminHandleReport', { reportId: id, status: next });
      }
      const list = state.list.map((r) => (r._id === id ? { ...r, handled: next === 'handled' } : r));
      patchState({ list });
      toast.show(next === 'handled' ? '已处理' : '已重开');
    } catch (err) {
      showError(err);
    }
  }
  onLoad(() => {
    load();
  });
  onPullDownRefresh(() => {
    return load().finally(() => hostPlatform.stopPullDownRefresh());
  });
  return {
    formatTime,
    decorate,
    TEAM_STATUS_TEXT,
    decorateTeams,
    decorateStats,
    state,
    singlePage,
    tab,
    loading,
    denied,
    stats,
    list,
    onlyOpen,
    userKeyword,
    bannedOnly,
    userTotal,
    patchState,
    load,
    applyUsersFilter,
    onUserSearch,
    toggleBannedOnly,
    onBan,
    onUnban,
    setBan,
    onToggleOrganizer,
    onCloseTeam,
    loadList,
    pickTab,
    toggleOpen,
    onHandle,
  };
}
