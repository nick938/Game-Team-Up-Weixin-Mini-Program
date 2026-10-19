import { usePageFeedback } from './usePageFeedback';
import { reactive, toRefs, nextTick, watch, computed } from 'vue';
import {
  onShow,
  onHide,
  onUnload,
  onPullDownRefresh,
  onShareAppMessage,
  onShareTimeline,
} from '@dcloudio/uni-app';
import type { Team, User } from '../types/domain';
import { platform as hostPlatform } from '../platform/host';
import { useAppStore } from '../stores/app';
import { isSinglePage } from '../utils/runtime';
import { decorateTeam } from '../utils/format';
import { loadMyProfile } from '../utils/my-profile';
import { callTeam } from '../api/team';
import { getAppVersion } from '../utils/version';
import { plazaShare, bindCopyUrl, unbindCopyUrl, shareToFriend, shareToTimeline } from '../utils/share';
import { scheduledTeams } from '../utils/team-schedule';
import { teamDetailPath } from '../utils/team-entry';
export function useMine() {
  const { toast, dialog } = usePageFeedback();
  function splitTeams(list: Team[]) {
    const ongoing: Team[] = [];
    const past: Team[] = [];
    (list || []).forEach((t) => {
      if (t.ongoing) ongoing.push(t);
      else past.push(t);
    });
    return { ongoing, past };
  }
  function getProfileHint(user: User | undefined) {
    const bio = ((user && user.bio) || '').trim();
    return bio || '写个签名，把 Steam 好友码放进去，队友加你好友';
  }
  const cachedProfile = useAppStore();
  const state = reactive({
    pendingAction: '',
    loading: false,
    profileError: '',
    listError: '',
    singlePage: false,
    ...{
      user: cachedProfile.user || ({} as User),
      teamTab: 'hosted',
      phase: 'Ongoing',
      visibleTeams: [] as Team[],
      hostedOngoing: [] as Team[],
      hostedPast: [] as Team[],
      joinedOngoing: [] as Team[],
      joinedPast: [] as Team[],
      showProfile: false,
      profileHint: getProfileHint(cachedProfile.user || undefined),
      versionText: '',
      isAdmin: cachedProfile.isAdmin,
      isOrganizer: cachedProfile.isOrganizer,
      hostedCount: 0,
      joinedCount: 0,
    },
  });
  watch(
    () => cachedProfile.user,
    (user) => {
      state.user = user || {};
      state.profileHint = getProfileHint(user || undefined);
    },
  );
  const {
    singlePage,
    user,
    teamTab,
    phase,
    visibleTeams,
    hostedOngoing,
    hostedPast,
    joinedOngoing,
    joinedPast,
    showProfile,
    profileHint,
    versionText,
    isAdmin,
    isOrganizer,
    hostedCount,
    joinedCount,
  } = toRefs(state);
  function patchState(patch: Partial<typeof state>, done?: () => void) {
    Object.assign(state, patch);
    if (done) void nextTick(done);
  }
  async function load(forceProfile = false) {
    if (isSinglePage()) return;
    if (state.loading) return;
    state.loading = true;
    state.profileError = '';
    state.listError = '';
    try {
      const [profileResult, teamsResult] = await Promise.allSettled([
        loadMyProfile(forceProfile),
        callTeam('myTeams'),
      ]);
      if (profileResult.status === 'fulfilled') {
        // Bootstrap helper owns profile freshness; a save can complete while teams are loading.
        const app = useAppStore();
        patchState({
          user: app.user || {},
          profileHint: getProfileHint(app.user || undefined),
          isAdmin: app.isAdmin,
          isOrganizer: app.isOrganizer,
        });
      } else {
        state.profileError = '资料暂时无法加载';
      }
      if (teamsResult.status === 'fulfilled') {
        const hosted = splitTeams((teamsResult.value.hosted || []).map(decorateTeam));
        const joined = splitTeams((teamsResult.value.joined || []).map(decorateTeam));
        patchState({
          hostedOngoing: hosted.ongoing,
          hostedPast: hosted.past,
          joinedOngoing: joined.ongoing,
          joinedPast: joined.past,
          hostedCount: hosted.ongoing.length + hosted.past.length,
          joinedCount: joined.ongoing.length + joined.past.length,
        });
        updateVisibleTeams();
      } else {
        state.listError = '队伍暂时无法加载，请重试';
      }
    } finally {
      state.loading = false;
    }
  }

  function updateVisibleTeams() {
    patchState({
      visibleTeams:
        state.teamTab === 'hosted'
          ? state.phase === 'Past'
            ? state.hostedPast
            : state.hostedOngoing
          : state.phase === 'Past'
            ? state.joinedPast
            : state.joinedOngoing,
    });
  }
  function pickTeamTab(input: string) {
    patchState({ teamTab: input });
    updateVisibleTeams();
  }
  function pickPhase(input: string) {
    patchState({ phase: input });
    updateVisibleTeams();
  }
  function goPlaza() {
    hostPlatform.switchTab({ url: '/pages/index/index' });
  }
  function editProfile() {
    patchState({ showProfile: true });
  }
  function onProfileClose() {
    patchState({ showProfile: false, pendingAction: '' });
  }
  function onProfileDone(input: { user: User }) {
    const user = input.user || {};
    if (user.nickName) {
      patchState({ showProfile: false, user });
    } else {
      patchState({ showProfile: false });
    }
    load(true);
  }
  function onOpen(input: { id?: string; gameName?: string }) {
    const id = input.id;
    const url = teamDetailPath(id, { gameName: input.gameName });
    if (!url) return;
    hostPlatform.navigateTo({ url });
  }
  function openLegal(input: string) {
    const type = input;
    hostPlatform.navigateTo({
      url: `/pages/legal/legal?type=${type}`,
    });
  }
  function openFeedback() {
    hostPlatform.navigateTo({ url: '/pages/feedback/feedback' });
  }
  function openAuthor() {
    void dialog
      .confirm({ title: '联系作者', msg: '作者微信号：Louisville_k', confirmButtonText: '复制微信号' })
      .then(() => {
        hostPlatform.setClipboardData({
          data: 'Louisville_k',
          fail: () => toast.show('复制失败，请重试'),
        });
      })
      .catch(() => {});
  }
  function openBug() {
    const app = useAppStore();
    const errorMsg = encodeURIComponent((app && app.lastError) || '');
    hostPlatform.navigateTo({ url: `/pages/bug/bug?page=我的&errorMsg=${errorMsg}` });
  }
  function openAdmin() {
    hostPlatform.navigateTo({ url: '/pages/admin/admin' });
  }
  function openPublish() {
    hostPlatform.switchTab({ url: '/pages/publish/publish' });
  }
  onShow(() => {
    const singlePage = isSinglePage();
    patchState({ singlePage });
    if (singlePage) return;
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
    return load(true).finally(() => hostPlatform.stopPullDownRefresh());
  });
  onShareAppMessage(() => {
    return shareToFriend(plazaShare());
  });
  onShareTimeline(() => {
    return shareToTimeline(plazaShare());
  });
  const nextTeam = computed(() => scheduledTeams([...state.hostedOngoing, ...state.joinedOngoing])[0]);
  function openHelp() {
    hostPlatform.navigateTo({ url: '/pages/help/help' });
  }
  return {
    nextTeam,
    openHelp,
    splitTeams,
    getProfileHint,
    state,
    singlePage,
    user,
    teamTab,
    phase,
    visibleTeams,
    hostedOngoing,
    hostedPast,
    joinedOngoing,
    joinedPast,
    showProfile,
    profileHint,
    versionText,
    isAdmin,
    isOrganizer,
    hostedCount,
    joinedCount,
    patchState,
    load,
    updateVisibleTeams,
    pickTeamTab,
    pickPhase,
    goPlaza,
    editProfile,
    onProfileClose,
    onProfileDone,
    onOpen,
    openLegal,
    openFeedback,
    openAuthor,
    openBug,
    openAdmin,
    openPublish,
  };
}
