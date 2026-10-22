import { rememberGame } from '../utils/recent-games';
import { overlappingTeams } from '../utils/team-schedule';
import { usePageFeedback } from './usePageFeedback';
import { reactive, toRefs, nextTick } from 'vue';
import { onLoad, onPullDownRefresh, onShow, onHide, onUnload } from '@dcloudio/uni-app';
import type { Team, User, Member, Seat, TeamRole, PageQuery } from '../types/domain';
import { capabilities } from '../platform/host';
import { platform as hostPlatform } from '../platform/host';
import { useAppStore } from '../stores/app';
import { isSinglePage } from '../utils/runtime';
import { presentTeam } from '../utils/team-presentation';
import { decorateTeam } from '../utils/format';
import { callTeam } from '../api/team';
import { requestTeamNotify } from '../utils/subscribe';
import { resolveTeamId, teamShareQuery, usableTeamId } from '../utils/team-entry';
import { bindCopyUrl, unbindCopyUrl, shareToFriend, shareToTimeline } from '../utils/share';
import { renderTeamCover } from '../utils/team-cover';
import { teamShare } from '../utils/team-share';
import { recruitmentText } from '../utils/recruitment';
export function useTeamDetail() {
  const { toast, dialog, showError } = usePageFeedback();
  function queryCanvasNode() {
    return new Promise<Parameters<typeof renderTeamCover>[0] | null>((resolve) => {
      if (typeof hostPlatform.createSelectorQuery !== 'function') {
        resolve(null);
        return;
      }
      hostPlatform
        .createSelectorQuery()
        .select('#shareCover')
        .fields({ node: true, size: true }, () => {})
        .exec((res) => resolve((res && res[0] && res[0].node) || null));
    });
  }
  async function waitForCanvasNode(attempts: number) {
    for (let i = 0; i < attempts; i += 1) {
      const node = await queryCanvasNode();
      if (node) return node;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return null;
  }
  function pixelRatio() {
    try {
      if (typeof hostPlatform.getWindowInfo === 'function')
        return hostPlatform.getWindowInfo().pixelRatio || 1;
      if (typeof hostPlatform.getSystemInfoSync === 'function')
        return hostPlatform.getSystemInfoSync().pixelRatio || 1;
    } catch (error) {
      // 取不到就按 1 倍画，图糊一点但不影响分享
    }
    return 1;
  }
  function readLaunchExtras() {
    const extras: {
      enter?: ReturnType<typeof hostPlatform.getEnterOptionsSync>;
      launch?: ReturnType<typeof hostPlatform.getLaunchOptionsSync>;
    } = {};
    try {
      if (typeof hostPlatform.getEnterOptionsSync === 'function')
        extras.enter = hostPlatform.getEnterOptionsSync();
    } catch (error) {
      // 旧基础库或未就绪时忽略
    }
    try {
      if (typeof hostPlatform.getLaunchOptionsSync === 'function')
        extras.launch = hostPlatform.getLaunchOptionsSync();
    } catch (error) {
      // 旧基础库或未就绪时忽略
    }
    return extras;
  }
  function shouldFoldNote(note: string) {
    if (!note || typeof note !== 'string') return false;
    const trimmed = note.trim();
    if (trimmed.length > 80) return true;
    const lines = trimmed.split('\n');
    if (lines.length > 3) return true;
    return false;
  }
  const state = reactive({
    entryOptions: {} as PageQuery,
    options: {} as PageQuery,
    shareCoverPath: '',
    coverRequest: 0,
    detailRequest: 0,
    memberProfileRequest: 0,
    requestingNotify: false,
    joining: false,
    mutating: false,
    detailError: '',
    detailNotFound: false,
    singlePage: false,
    wechatSubscription: capabilities.wechatSubscription,
    ...{
      teamId: '',
      team: null as Team | null,
      members: [] as Member[],
      seats: [] as Seat[],
      showManage: false,
      showMemberProfile: false,
      memberProfileLoading: false,
      memberProfile: null as User | null,
      memberProfileError: '',
      selectedMemberId: '',
      role: null as TeamRole | null,
      loading: true,
      showProfile: false,
      pendingAction: '',
      notifyHint: '',
      changeNotice: '',
      joinSuccess: false,
      trackedTeamId: '',
      notifyAuthorized: false,
      noteCanFold: false,
      noteExpanded: false,
    },
  });
  const {
    singlePage,
    wechatSubscription,
    teamId,
    team,
    members,
    seats,
    showManage,
    showMemberProfile,
    memberProfileLoading,
    memberProfile,
    memberProfileError,
    selectedMemberId,
    role,
    loading,
    showProfile,
    pendingAction,
    notifyHint,
    notifyAuthorized,
    noteCanFold,
    noteExpanded,
  } = toRefs(state);
  function patchState(patch: Partial<typeof state>, done?: () => void) {
    Object.assign(state, patch);
    if (done) void nextTick(done);
  }
  function syncTeamId(options: PageQuery) {
    const teamId = resolveTeamId(options || state.options || {}, readLaunchExtras());
    if (teamId !== state.teamId) {
      state.detailRequest += 1;
      state.coverRequest += 1;
      patchState({
        teamId,
        team: null,
        role: null,
        joinSuccess: false,
        changeNotice: '',
        notifyAuthorized: false,
        members: [],
        seats: [],
        shareCoverPath: '',
        noteExpanded: false,
        noteCanFold: false,
      });
    }
    return teamId;
  }
  function buildShare() {
    return teamShare(state.team, state.teamId);
  }
  async function prepareShareCover() {
    const team = state.team;
    const requestId = (state.coverRequest || 0) + 1;
    state.coverRequest = requestId;
    state.shareCoverPath = '';
    if (!team) return;
    let path = '';
    try {
      const canvas = await waitForCanvasNode(3);
      if (requestId !== state.coverRequest) return;
      path = await renderTeamCover(canvas, team, pixelRatio());
    } catch (error) {
      path = '';
    }
    if (requestId !== state.coverRequest) return;
    state.shareCoverPath = path;
    return path;
  }
  async function loadDetail() {
    if (isSinglePage()) return;
    const teamId = usableTeamId(state.teamId);
    if (!teamId) {
      patchState({ loading: false, team: null, teamId: '' });
      return;
    }
    const requestId = (state.detailRequest || 0) + 1;
    state.detailRequest = requestId;
    patchState({ loading: true, detailError: '', detailNotFound: false });
    try {
      const res = await callTeam('getTeam', { teamId });
      if (requestId !== state.detailRequest) return;
      const role = res.role;
      try {
        rememberGame(res.team.gameName);
      } catch {
        // Local history is optional; a successful team response must remain visible.
      }
      const fields: Record<string, string> = {
        startAt: '开始时间',
        endAt: '结束时间',
        platform: '平台',
        server: '区服',
        roomNo: '车头联系方式',
        roomPwd: '密码',
      };
      let seenAt = 0;
      try {
        seenAt = Number(hostPlatform.getStorageSync('team-seen:' + teamId)) || 0;
      } catch {
        /* Optional. */
      }
      const changed = Number(res.team.detailsChangedAt || 0);
      const changeNotice =
        role && changed > seenAt
          ? '车头更新了' +
            (res.team.changedFields || [])
              .map((field) => fields[field])
              .filter(Boolean)
              .join('、') +
            '，请重新核对。'
          : '';
      try {
        hostPlatform.setStorageSync('team-seen:' + teamId, Math.max(changed, seenAt));
      } catch {
        /* Optional. */
      }
      if (state.trackedTeamId !== teamId) {
        state.trackedTeamId = teamId;
        void callTeam('trackTeamEvent', {
          teamId,
          kind: state.entryOptions.from === 'share' ? 'share_view' : 'detail_view',
        }).catch(() => {});
      }
      const note = (res.team && res.team.note) || '';
      const noteCanFold = shouldFoldNote(note);
      patchState(
        {
          team: decorateTeam(res.team),
          noteCanFold,
          noteExpanded: false,
          members: res.members || [],
          seats: Array.from(
            {
              length:
                Number.isInteger(res.team.capacity) && res.team.capacity >= 2 && res.team.capacity <= 20
                  ? res.team.capacity
                  : 0,
            },
            (_, i) => ({
              key: i,
              member: (res.members || [])[i] || null,
            }),
          ),
          role,
          changeNotice,
          loading: false,
        },
        // 回调里 canvas 节点才渲染出来，此时才画得了封面
        () => prepareShareCover(),
      );
      hostPlatform.setNavigationBarTitle({
        title: (res.team && res.team.gameName) || '组队详情',
      });
    } catch (error) {
      const e: Error & { code?: string } = error instanceof Error ? error : new Error(String(error));
      if (requestId !== state.detailRequest) return;
      patchState({
        team: null,
        role: null,
        members: [],
        seats: [],
        loading: false,
        detailError: e.message || '暂时无法加载队伍',
        detailNotFound: e.code === 'NOT_FOUND' || /不存在|已删除/.test(e.message),
      });
      // 数据没取到，别让分享还用着上一趟车的封面
      prepareShareCover();
      showError(e);
    }
  }
  function toggleNoteExpand() {
    patchState({ noteExpanded: !state.noteExpanded });
  }
  function onMemberProfile(input: string) {
    const memberId = input;
    if (!memberId) return;
    patchState({ showMemberProfile: true, selectedMemberId: memberId, memberProfile: null });
    loadMemberProfile();
  }
  async function loadMemberProfile() {
    const requestId = (state.memberProfileRequest || 0) + 1;
    state.memberProfileRequest = requestId;
    patchState({ memberProfileLoading: true, memberProfileError: '' });
    try {
      const res = await callTeam('getPublicProfile', {
        teamId: state.teamId,
        memberId: state.selectedMemberId,
      });
      if (requestId !== state.memberProfileRequest) return;
      patchState({ memberProfile: res.profile, memberProfileLoading: false });
    } catch (err) {
      if (requestId !== state.memberProfileRequest) return;
      patchState({
        memberProfileLoading: false,
        memberProfileError: err instanceof Error ? err.message : '资料加载失败',
      });
    }
  }
  function closeMemberProfile() {
    state.memberProfileRequest = (state.memberProfileRequest || 0) + 1;
    patchState({ showMemberProfile: false, memberProfile: null, selectedMemberId: '' });
  }
  function copyRoom() {
    const no = state.team && state.team.roomNo;
    if (!no) return;
    hostPlatform.setClipboardData({
      data: String(no),
      success: () => {
        void callTeam('trackTeamEvent', { teamId: state.teamId, kind: 'copy_room' }).catch(() => {});
      },
    });
  }
  function copyPwd() {
    const pwd = state.team && state.team.roomPwd;
    if (!pwd) return;
    hostPlatform.setClipboardData({ data: String(pwd) });
  }
  async function onEnableNotify() {
    if (!capabilities.wechatSubscription) {
      toast.show('当前平台暂不支持开打提醒');
      return;
    }
    if (state.requestingNotify || state.notifyAuthorized) return;
    state.requestingNotify = true;
    const ok = await requestTeamNotify();
    state.requestingNotify = false;
    patchState({
      notifyAuthorized: ok,
      notifyHint: ok
        ? '已获得本次授权，实际送达取决于微信订阅状态与发送结果。'
        : '未获得通知授权，可再次点击重试或检查微信订阅设置',
    });
  }
  async function onJoin() {
    if (state.joining) return;
    if (state.team?.pendingHost) {
      hostPlatform.navigateTo({ url: `/pages/publish/claim?teamId=${encodeURIComponent(state.teamId)}` });
      return;
    }
    state.joining = true;
    try {
      let conflicts = [] as Team[];
      try {
        const mine = await callTeam('myTeams');
        conflicts = overlappingTeams([...mine.hosted, ...mine.joined], state.team || {});
      } catch {
        /* Optional schedule lookup. */
      }
      if (conflicts.length) {
        try {
          await dialog.confirm({
            title: '开局时间有重叠',
            msg: `与「${conflicts[0].gameName}」等 ${conflicts.length} 个队伍重叠，仍要加入吗？`,
            confirmButtonText: '继续加入',
            cancelButtonText: '再看看',
          });
        } catch {
          return;
        }
      }
      toast.loading('上车中');
      await callTeam('joinTeam', { teamId: state.teamId });
      toast.close();
      state.joinSuccess = true;
      toast.success('已加入，复制加入方式进入游戏');
      await loadDetail();
    } catch (error) {
      const e: Error & { code?: string } = error instanceof Error ? error : new Error(String(error));
      toast.close();
      if (e.code === 'NEED_PROFILE') {
        patchState({ showProfile: true, pendingAction: 'join' });
      } else {
        showError(e);
        await loadDetail();
      }
    } finally {
      state.joining = false;
    }
  }
  function onLeave() {
    if (state.mutating) return;
    state.mutating = true;
    void dialog
      .confirm({
        title: '离开这趟队伍？',
        msg: '下车后会释放你的位置。',
        confirmButtonText: '确认下车',
        cancelButtonText: '继续组队',
      })
      .then(async () => {
        toast.loading('下车中');
        try {
          await callTeam('leaveTeam', { teamId: state.teamId });
          toast.success('已下车');
          await loadDetail();
        } catch (error) {
          const e: Error & { code?: string } = error instanceof Error ? error : new Error(String(error));
          toast.close();
          showError(e);
        }
      })
      .catch(() => {})
      .finally(() => {
        state.mutating = false;
      });
  }
  function onManage() {
    if (state.role !== 'host') return;
    patchState({ showManage: true });
  }
  function closeManage() {
    patchState({ showManage: false });
  }
  function stopManageTouch() {}
  function onManageAction(input: string) {
    if (state.role !== 'host') return;
    const action = input;
    closeManage();
    if (action === 'edit') onEdit();
    else if (action === 'cancel') onCancel();
  }
  function onEdit() {
    const app = useAppStore();
    app.editingTeamId = state.teamId;
    hostPlatform.switchTab({ url: '/pages/publish/publish' });
  }
  function onRepublish() {
    const team = state.team;
    if (!team) return;
    const app = useAppStore();
    app.republishTeam = {
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
    hostPlatform.switchTab({ url: '/pages/publish/publish' });
  }
  function onCancel() {
    if (state.mutating) return;
    state.mutating = true;
    void dialog
      .confirm({
        title: '关闭这趟队伍？',
        msg: '将关闭整局并释放所有位置。已授权且有可用订阅额度的队友会收到散局提醒。',
        confirmButtonText: '关闭队伍',
        cancelButtonText: '继续组队',
        confirmButtonProps: { type: 'danger' },
      })
      .then(async () => {
        toast.loading('处理中');
        try {
          await callTeam('cancelTeam', { teamId: state.teamId });
          toast.success('已散');
          await loadDetail();
        } catch (error) {
          const e: Error & { code?: string } = error instanceof Error ? error : new Error(String(error));
          toast.close();
          showError(e);
        }
      })
      .catch(() => {})
      .finally(() => {
        state.mutating = false;
      });
  }
  function goPlaza() {
    hostPlatform.switchTab({ url: '/pages/index/index' });
  }
  function copyRecruitment() {
    if (!state.team || state.role !== 'host' || !presentTeam(state.team, state.role).ongoing) return;
    hostPlatform.setClipboardData({
      data: recruitmentText(state.team),
      success: () => toast.success('已复制，请配合队伍卡片发到群里'),
    });
  }
  function browseSameGame() {
    if (state.team)
      hostPlatform.navigateTo({ url: `/pages/game/game?game=${encodeURIComponent(state.team.gameName)}` });
  }
  function onReport() {
    const team = state.team;
    if (!team) return;
    const name = encodeURIComponent(team.gameName || '');
    hostPlatform.navigateTo({
      url: `/pages/report/report?teamId=${state.teamId}&name=${name}`,
    });
  }
  function onProfileClose() {
    patchState({ showProfile: false, pendingAction: '' });
  }
  function onProfileDone() {
    patchState({ showProfile: false });
    if (state.pendingAction === 'join') {
      patchState({ pendingAction: '' });
      onJoin();
    }
  }
  onLoad((options = {}) => {
    state.entryOptions = options || {};
    const teamId = syncTeamId(state.entryOptions);
    const rawName = options && (options.name || options.gameName);
    if (rawName) {
      let name = String(rawName);
      try {
        name = decodeURIComponent(name);
      } catch (error) {
        // 已经是明文
      }
      hostPlatform.setNavigationBarTitle({ title: name.slice(0, 40) });
    }
    if (!teamId) patchState({ loading: false, team: null });
  });
  onPullDownRefresh(() => {
    return loadDetail().finally(() => hostPlatform.stopPullDownRefresh());
  });
  onShow(() => {
    const singlePage = isSinglePage();
    patchState({ singlePage });
    if (singlePage) return;
    bindCopyUrl(hostPlatform, () => ({
      query: teamShareQuery(state.teamId),
      title: (state.team && state.team.gameName) || '开黑星球',
    }));
    const teamId = syncTeamId(state.entryOptions || state.options);
    if (teamId) {
      loadDetail();
    } else {
      patchState({ loading: false, team: null, teamId: '' });
    }
  });
  onHide(() => {
    unbindCopyUrl(hostPlatform);
  });
  onUnload(() => {
    state.detailRequest += 1;
    state.coverRequest += 1;
    state.memberProfileRequest += 1;
    unbindCopyUrl(hostPlatform);
  });
  function shareAppMessage() {
    const share = buildShare();
    const payload = shareToFriend(share, state.shareCoverPath);
    if (state.shareCoverPath) return payload;
    return {
      ...payload,
      promise: prepareShareCover().then((imageUrl) => shareToFriend(share, imageUrl)),
    };
  }
  function shareTimeline() {
    return shareToTimeline(buildShare(), state.shareCoverPath);
  }
  return {
    shareAppMessage,
    shareTimeline,
    queryCanvasNode,
    waitForCanvasNode,
    pixelRatio,
    readLaunchExtras,
    shouldFoldNote,
    state,
    singlePage,
    wechatSubscription,
    teamId,
    team,
    members,
    seats,
    showManage,
    showMemberProfile,
    memberProfileLoading,
    memberProfile,
    memberProfileError,
    selectedMemberId,
    role,
    loading,
    showProfile,
    pendingAction,
    notifyHint,
    notifyAuthorized,
    noteCanFold,
    noteExpanded,
    patchState,
    syncTeamId,
    buildShare,
    prepareShareCover,
    loadDetail,
    toggleNoteExpand,
    onMemberProfile,
    loadMemberProfile,
    closeMemberProfile,
    copyRoom,
    copyPwd,
    onEnableNotify,
    onJoin,
    onLeave,
    onManage,
    closeManage,
    stopManageTouch,
    onManageAction,
    onEdit,
    onRepublish,
    onCancel,
    goPlaza,
    copyRecruitment,
    browseSameGame,
    onReport,
    onProfileClose,
    onProfileDone,
  };
}
