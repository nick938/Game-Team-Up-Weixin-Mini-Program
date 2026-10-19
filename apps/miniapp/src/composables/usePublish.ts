import { normalizeSourceGroup } from '../utils/source-group';
import { usePageFeedback } from './usePageFeedback';
import { reactive, toRefs, nextTick, computed, watch } from 'vue';
import { onShow, onHide, onUnload, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import type { TeamDraft, User } from '../types/domain';
import { platform as hostPlatform } from '../platform/host';
import { useAppStore } from '../stores/app';
import { isSinglePage } from '../utils/runtime';
import { PLATFORMS, VOICES, MAX_TEAM_HOURS } from '../utils/constants';
import { dateParts, combineDateTime, defaultStartAt, defaultEndAt } from '../utils/format';
import { callTeam } from '../api/team';
import { requestTeamNotify } from '../utils/subscribe';
import { plazaShare, bindCopyUrl, unbindCopyUrl, shareToFriend, shareToTimeline } from '../utils/share';
import { teamDetailPath } from '../utils/team-entry';
import { GAME_CATALOG, findGame } from '../utils/games';
import {
  START_PRESETS,
  DURATION_PRESETS,
  sortPlatforms,
  hasExtraSettings,
  moreSettingsHint,
  tonightStartAt,
  resolveStartAt,
  resolveEndAtMinutes,
  detectDurationMinutes,
  durationPresetHoursFromMinutes,
  formatDurationLabel,
  buildDurationPicker,
  buildTimeSummary,
  validatePublishTeam,
} from '../utils/publish-form';
export function usePublish() {
  const { toast, showError } = usePageFeedback();
  const MAX_TEAM_MS = MAX_TEAM_HOURS * 60 * 60 * 1000;
  const DURATION_PICKER = buildDurationPicker();
  const DURATION_PICKER_LABELS = DURATION_PICKER.map((item) => item.label);
  function durationPickerIndexFor(minutes: number) {
    const idx = DURATION_PICKER.findIndex((item) => item.minutes === minutes);
    return idx >= 0 ? idx : 0;
  }
  function emptyForm() {
    const startAt = defaultStartAt();
    const endAt = defaultEndAt(startAt);
    const start = dateParts(startAt);
    const end = dateParts(endAt);
    const today = dateParts(Date.now());
    const durationMinutes = detectDurationMinutes(startAt, endAt) || 120;
    const summary = buildTimeSummary({
      startDate: start.date,
      startTime: start.time,
      endDate: end.date,
      endTime: end.time,
      todayDate: today.date,
      startAt,
      endAt,
    });
    return {
      editingId: '',
      platforms: sortPlatforms('Steam', PLATFORMS),
      voices: VOICES,
      gameName: '',
      startDate: start.date,
      startTime: start.time,
      endDate: end.date,
      endTime: end.time,
      minDate: today.date,
      startPreset: 'custom',
      durationHours: durationPresetHoursFromMinutes(durationMinutes),
      durationMinutes,
      durationLabel: formatDurationLabel(durationMinutes),
      durationPickerIndex: durationPickerIndexFor(durationMinutes),
      timeSummaryLine1: summary.line1,
      timeSummaryLine2: summary.line2,
      capacity: 5,
      sourceGroup: '',
      roomNo: '',
      roomPwd: '',
      platform: 'Steam',
      server: '',
      voice: 'KOOK',
      rankReq: '',
      note: '',
      moreHint: moreSettingsHint({}),
      submitting: false,
      validationError: null as { message: string; anchor?: string } | null,
      showProfile: false,
      pendingAction: '',
      fromLast: false,
      showMore: false,
      proxyMode: false,
      proxyKeyword: '',
      proxySearching: false,
      proxyResults: [] as User[],
      proxyHost: null as User | null,
    };
  }
  const state = reactive({
    proxyTimer: null as ReturnType<typeof setTimeout> | null,
    proxySearchToken: 0,
    singlePage: false,
    ...Object.assign(emptyForm(), {
      canProxy: false,
      suggestedGames: GAME_CATALOG,
      startPresets: START_PRESETS,
      durationPresets: DURATION_PRESETS,
      durationPickerLabels: DURATION_PICKER_LABELS,
    }),
  });
  // Clear only the error for the field that the user is correcting.
  watch(
    () => [
      state.gameName,
      state.roomNo,
      state.capacity,
      state.startDate,
      state.startTime,
      state.endDate,
      state.endTime,
      state.platform,
      state.proxyHost,
    ],
    (values, previous) => {
      const anchors = [
        'field-game',
        'field-room',
        'field-capacity',
        'field-start',
        'field-start',
        'field-end',
        'field-end',
        'field-platform',
        'field-proxy',
      ];
      if (
        values.some(
          (value, index) => value !== previous[index] && state.validationError?.anchor === anchors[index],
        )
      )
        state.validationError = null;
    },
    { flush: 'sync' },
  );
  const {
    singlePage,
    editingId,
    platforms,
    voices,
    gameName,
    startDate,
    startTime,
    endDate,
    endTime,
    minDate,
    startPreset,
    durationHours,
    durationLabel,
    durationPickerIndex,
    timeSummaryLine1,
    timeSummaryLine2,
    capacity,
    roomNo,
    roomPwd,
    platform: selectedPlatform,
    server,
    voice,
    rankReq,
    note,
    moreHint,
    submitting,
    showProfile,
    pendingAction,
    fromLast,
    showMore,
    proxyMode,
    proxyKeyword,
    proxySearching,
    proxyResults,
    proxyHost,
    canProxy,
    suggestedGames,
    startPresets,
    durationPresets,
    durationPickerLabels,
  } = toRefs(state);
  function patchState(patch: Partial<typeof state>, done?: () => void) {
    Object.assign(state, patch);
    if (done) void nextTick(done);
  }
  async function loadEdit(id: string) {
    toast.loading('加载中');
    try {
      const res = await callTeam('getTeam', { teamId: id });
      const team = res.team;
      const startAt = team.startAt;
      const endAt = team.endAt || team.expireAt || team.startAt;
      const start = dateParts(startAt);
      const end = dateParts(endAt);
      const voice = team.voice === 'Discord' ? 'KOOK' : team.voice;
      const platform = PLATFORMS.indexOf(team.platform) >= 0 ? team.platform : 'Steam';
      const extras = {
        sourceGroup: team.sourceGroup || '',
        roomNo: team.roomNo || '',
        roomPwd: team.roomPwd || '',
        server: team.server || '',
        voice: VOICES.indexOf(voice || '') >= 0 ? voice : 'KOOK',
        rankReq: team.rankReq || '',
        note: team.note || '',
      };
      const summary = buildTimeSummary({
        startDate: start.date,
        startTime: start.time,
        endDate: end.date,
        endTime: end.time,
        todayDate: dateParts(Date.now()).date,
        startAt,
        endAt,
      });
      const durationMinutes = detectDurationMinutes(startAt, endAt) || 120;
      patchState({
        ...emptyForm(),
        editingId: id,
        showMore: hasExtraSettings(extras),
        gameName: team.gameName || '',
        startDate: start.date,
        startTime: start.time,
        endDate: end.date,
        endTime: end.time,
        startPreset: 'custom',
        durationHours: durationPresetHoursFromMinutes(durationMinutes),
        durationMinutes,
        durationLabel: formatDurationLabel(durationMinutes),
        durationPickerIndex: durationPickerIndexFor(durationMinutes),
        timeSummaryLine1: summary.line1,
        timeSummaryLine2: summary.line2,
        capacity: team.capacity,
        platform,
        platforms: sortPlatforms(platform, PLATFORMS),
        ...extras,
        moreHint: moreSettingsHint(extras),
        canProxy: false,
        proxyMode: false,
      });
    } catch (error) {
      const e: Error & { code?: string } = error instanceof Error ? error : new Error(String(error));
      showError(e);
    } finally {
      toast.close();
    }
  }
  function applyDraft(draft: TeamDraft) {
    const startAt = defaultStartAt();
    const endAt = defaultEndAt(startAt);
    const start = dateParts(startAt);
    const end = dateParts(endAt);
    const today = dateParts(Date.now());
    const voice = draft.voice === 'Discord' ? 'KOOK' : draft.voice;
    const platform = PLATFORMS.indexOf(draft.platform) >= 0 ? draft.platform : 'Steam';
    const extras = {
      sourceGroup: draft.sourceGroup || '',
      roomNo: draft.roomNo || '',
      roomPwd: draft.roomPwd || '',
      server: draft.server || '',
      voice: VOICES.indexOf(voice || '') >= 0 ? voice : 'KOOK',
      rankReq: draft.rankReq || '',
      note: draft.note || '',
    };
    const summary = buildTimeSummary({
      startDate: start.date,
      startTime: start.time,
      endDate: end.date,
      endTime: end.time,
      todayDate: today.date,
      startAt,
      endAt,
    });
    const durationMinutes = detectDurationMinutes(startAt, endAt) || 120;
    patchState({
      ...emptyForm(),
      fromLast: true,
      showMore: hasExtraSettings(extras),
      gameName: draft.gameName || '',
      startDate: start.date,
      startTime: start.time,
      endDate: end.date,
      endTime: end.time,
      minDate: today.date,
      startPreset: 'custom',
      durationHours: durationPresetHoursFromMinutes(durationMinutes),
      durationMinutes,
      durationLabel: formatDurationLabel(durationMinutes),
      durationPickerIndex: durationPickerIndexFor(durationMinutes),
      timeSummaryLine1: summary.line1,
      timeSummaryLine2: summary.line2,
      capacity: draft.capacity || 5,
      platform,
      platforms: sortPlatforms(platform, PLATFORMS),
      ...extras,
      moreHint: moreSettingsHint(extras),
    });
  }
  function toggleMore() {
    patchState({ showMore: !state.showMore });
  }
  function applyDurationTo(patch: Partial<typeof state>) {
    const minutes = patch.durationMinutes != null ? patch.durationMinutes : state.durationMinutes;
    const startDate = patch.startDate || state.startDate;
    const startTime = patch.startTime || state.startTime;
    const endAt = resolveEndAtMinutes(combineDateTime(startDate, startTime), minutes);
    if (!endAt) return patch;
    const end = dateParts(endAt);
    patch.endDate = end.date;
    patch.endTime = end.time;
    return patch;
  }
  function withTimeSummary(patch: Partial<typeof state>) {
    const startDate = patch.startDate || state.startDate;
    const startTime = patch.startTime || state.startTime;
    const endDate = patch.endDate || state.endDate;
    const endTime = patch.endTime || state.endTime;
    const startAt = combineDateTime(startDate, startTime);
    const endAt = combineDateTime(endDate, endTime);
    const summary = buildTimeSummary({
      startDate,
      startTime,
      endDate,
      endTime,
      todayDate: state.minDate,
      startAt,
      endAt,
    });
    patch.timeSummaryLine1 = summary.line1;
    patch.timeSummaryLine2 = summary.line2;
    return patch;
  }
  function pickStartPreset(input: string) {
    const startPreset = input;
    if (!START_PRESETS.some((item) => item.key === startPreset)) return;
    const patch: Partial<typeof state> = { startPreset };
    const startAt = resolveStartAt(startPreset, Date.now(), tonightStartAt(Date.now()));
    if (startAt) {
      const start = dateParts(startAt);
      patch.startDate = start.date;
      patch.startTime = start.time;
      applyDurationTo(patch);
    }
    patchState(withTimeSummary(patch));
  }
  function pickDuration(input: number | string) {
    const durationHours = Number(input);
    if (![1, 2, 3].includes(durationHours)) return;
    const durationMinutes = durationHours * 60;
    const patch: Partial<typeof state> = {
      durationHours,
      durationMinutes,
      durationLabel: formatDurationLabel(durationMinutes),
      durationPickerIndex: durationPickerIndexFor(durationMinutes),
    };
    applyDurationTo(patch);
    patchState(withTimeSummary(patch));
  }
  function pickCustomDuration(input: number | string) {
    const index = Number(input);
    if (!Number.isFinite(index) || index < 0 || index >= DURATION_PICKER.length) return;
    const minutes = DURATION_PICKER[index].minutes;
    const patch: Partial<typeof state> = {
      durationHours: 0,
      durationMinutes: minutes,
      durationLabel: formatDurationLabel(minutes),
      durationPickerIndex: index,
    };
    applyDurationTo(patch);
    patchState(withTimeSummary(patch));
  }
  function onGameName(input: string) {
    const gameName = input;
    const patch: Partial<typeof state> = { gameName };
    const game = findGame(gameName);
    if (game && game.platform) patch.platforms = sortPlatforms(game.platform, PLATFORMS);
    patchState(patch);
  }
  function pickSuggestedGame(input: string) {
    const game = findGame(input);
    if (!game) return;
    const patch: Partial<typeof state> = { gameName: game.name };
    if (PLATFORMS.indexOf(game.platform) >= 0) {
      patch.platform = game.platform;
      patch.platforms = sortPlatforms(game.platform, PLATFORMS);
    }
    patchState(patch);
  }
  function onStartDate(input: string) {
    const patch: Partial<typeof state> = { startDate: input, startPreset: 'custom' };
    applyDurationTo(patch);
    patchState(withTimeSummary(patch));
  }
  function onStartTime(input: string) {
    const patch: Partial<typeof state> = { startTime: input, startPreset: 'custom' };
    applyDurationTo(patch);
    patchState(withTimeSummary(patch));
  }
  function decCap() {
    if (state.capacity <= 2) return;
    patchState({ capacity: state.capacity - 1 });
  }
  function incCap() {
    if (state.capacity >= 20) return;
    patchState({ capacity: state.capacity + 1 });
  }
  function patchExtras(partial: Partial<typeof state>) {
    const extras = {
      roomNo: state.roomNo,
      roomPwd: state.roomPwd,
      server: state.server,
      voice: state.voice,
      rankReq: state.rankReq,
      note: state.note,
      ...partial,
    };
    patchState({ ...extras, moreHint: moreSettingsHint(extras) });
  }
  function onRoomNo(input: string) {
    patchExtras({ roomNo: input });
  }
  function onRoomPwd(input: string) {
    patchExtras({ roomPwd: input });
  }
  function pickPlatform(input: string) {
    patchState({ platform: input });
  }
  function onServer(input: string) {
    patchExtras({ server: input });
  }
  function pickVoice(input: string) {
    patchExtras({ voice: input });
  }
  function onRank(input: string) {
    patchExtras({ rankReq: input });
  }
  function onNote(input: string) {
    patchExtras({ note: input });
  }
  async function loadProxyAccess() {
    if (state.editingId) {
      patchState({ canProxy: false, proxyMode: false });
      return;
    }
    const app = useAppStore();
    const cached = !!(app.isAdmin || app.isOrganizer);
    if (cached) patchState({ canProxy: true });
    try {
      const profile = await callTeam('getProfile');
      const canProxy = !!(profile.isAdmin || profile.isOrganizer);
      app.isAdmin = !!profile.isAdmin;
      app.isOrganizer = !!profile.isOrganizer;
      patchState({ canProxy });
    } catch (error) {
      if (!cached) patchState({ canProxy: false });
    }
  }
  function cancelProxySearch() {
    if (state.proxyTimer) clearTimeout(state.proxyTimer);
    state.proxyTimer = null;
    state.proxySearchToken = (state.proxySearchToken || 0) + 1;
  }
  function toggleProxy(input: boolean) {
    if (state.editingId || !state.canProxy) return;
    cancelProxySearch();
    const proxyMode = Boolean(input);
    patchState({
      proxyMode,
      proxyKeyword: '',
      proxySearching: false,
      proxyResults: [],
      proxyHost: null,
    });
  }
  function onProxyKeyword(input: string) {
    const proxyKeyword = input;
    patchState({ proxyKeyword });
    cancelProxySearch();
    const keyword = String(proxyKeyword || '').trim();
    if (!keyword) {
      patchState({ proxyResults: [], proxySearching: false });
      return;
    }
    patchState({ proxySearching: true, proxyResults: [] });
    state.proxyTimer = setTimeout(() => searchProxyUsers(keyword), 280);
  }
  async function searchProxyUsers(keyword: string) {
    const token = (state.proxySearchToken = (state.proxySearchToken || 0) + 1);
    try {
      const res = await callTeam('searchProxyUsers', { keyword });
      if (token !== state.proxySearchToken) return;
      patchState({ proxyResults: res.list || [], proxySearching: false });
    } catch (error) {
      const e: Error & { code?: string } = error instanceof Error ? error : new Error(String(error));
      if (token !== state.proxySearchToken) return;
      patchState({ proxySearching: false, proxyResults: [] });
      showError(e);
    }
  }
  function pickProxyHost(input: User | undefined) {
    const host = input;
    if (!host || !host.userId) return;
    cancelProxySearch();
    patchState({
      proxyHost: host,
      proxyKeyword: host.nickName || '',
      proxyResults: [],
      proxySearching: false,
    });
  }
  function clearProxyHost() {
    cancelProxySearch();
    patchState({
      proxyHost: null,
      proxyKeyword: '',
      proxyResults: [],
      proxySearching: false,
    });
  }
  function buildTeam() {
    return {
      gameName: (state.gameName || '').trim(),
      startAt: combineDateTime(state.startDate, state.startTime),
      endAt: combineDateTime(state.endDate, state.endTime),
      capacity: state.capacity,
      sourceGroup: normalizeSourceGroup(state.sourceGroup),
      roomNo: (state.roomNo || '').trim(),
      roomPwd: (state.roomPwd || '').trim(),
      platform: state.platform,
      server: (state.server || '').trim(),
      voice: state.voice,
      rankReq: (state.rankReq || '').trim(),
      note: (state.note || '').trim(),
    };
  }
  function scrollToField(id?: string) {
    if (!id || !hostPlatform.createSelectorQuery || !hostPlatform.pageScrollTo) return;
    hostPlatform
      .createSelectorQuery()
      .select(`#${id}`)
      .boundingClientRect()
      .selectViewport()
      .scrollOffset(() => {})
      .exec((res) => {
        const rect = res && res[0];
        const viewport = res && res[1];
        if (!rect || !viewport) return;
        hostPlatform.pageScrollTo({
          scrollTop: Math.max(0, viewport.scrollTop + rect.top - 80),
          duration: 240,
        });
      });
  }
  async function onSubmit() {
    if (state.submitting) return;
    const team = buildTeam();
    const error = validatePublishTeam(team, {
      maxMs: MAX_TEAM_MS,
      maxHours: MAX_TEAM_HOURS,
      now: Date.now(),
      needProxyHost: !state.editingId && state.proxyMode && !(state.proxyHost && state.proxyHost.userId),
    });
    state.validationError = error;
    if (error) {
      toast.show(error.message);
      scrollToField(error.anchor);
      return;
    }
    const editingId = state.editingId;
    state.submitting = true;
    patchState({ submitting: true });
    try {
      if (!editingId) {
        await requestTeamNotify();
      }
      if (editingId) {
        await callTeam('updateTeam', { teamId: editingId, team });
        patchState(emptyForm());
        toast.success('已保存');
        setTimeout(() => {
          const url = teamDetailPath(editingId, { gameName: team.gameName });
          if (url) hostPlatform.navigateTo({ url });
        }, 400);
      } else {
        const payload: { team: ReturnType<typeof buildTeam>; hostOpenid?: string } = { team };
        if (state.proxyMode && state.proxyHost && state.proxyHost.userId) {
          payload.hostOpenid = state.proxyHost.userId;
        }
        const res = await callTeam('createTeam', payload);
        const helped = !!payload.hostOpenid;
        patchState(emptyForm());
        toast.success(helped ? '已帮 TA 发车' : '已发车');
        setTimeout(() => {
          const url = teamDetailPath(res.teamId, { gameName: team.gameName });
          if (url) hostPlatform.navigateTo({ url });
        }, 400);
      }
    } catch (error) {
      const e: Error & { code?: string } = error instanceof Error ? error : new Error(String(error));
      if (e.code === 'NEED_PROFILE') {
        patchState({ showProfile: true, pendingAction: 'submit' });
      } else {
        showError(e);
      }
    } finally {
      state.submitting = false;
      patchState({ submitting: false });
    }
  }
  function onProfileClose() {
    patchState({ showProfile: false, pendingAction: '' });
  }
  function onProfileDone(input: { user: User }) {
    const user = input.user || {};
    if (user.nickName) {
      const app = useAppStore();
      app.user = user;
    }
    patchState({ showProfile: false });
    if (state.pendingAction === 'submit') {
      patchState({ pendingAction: '' });
      onSubmit();
    }
  }
  onShow(async () => {
    const singlePage = isSinglePage();
    patchState({ singlePage });
    if (singlePage) return;
    bindCopyUrl(hostPlatform, () => plazaShare('开黑星球｜发起组队开黑'));
    const app = useAppStore();
    const editingId = app.editingTeamId;
    const draft = app.republishTeam;
    const prefill = app.prefillGame;
    if (editingId) {
      app.editingTeamId = null;
      app.republishTeam = null;
      app.prefillGame = null;
      if (state.editingId === editingId) return;
      await loadEdit(editingId);
      return;
    }
    if (draft) {
      app.republishTeam = null;
      app.prefillGame = null;
      applyDraft(draft);
    } else if (prefill) {
      app.prefillGame = null;
      const patch: Partial<typeof state> = { gameName: prefill.name || '' };
      if (prefill.platform && PLATFORMS.indexOf(prefill.platform) >= 0) {
        patch.platform = prefill.platform;
        patch.platforms = sortPlatforms(prefill.platform, PLATFORMS);
      }
      patchState(patch);
    }
    await loadProxyAccess();
  });
  onHide(() => {
    unbindCopyUrl(hostPlatform);
  });
  onUnload(() => {
    cancelProxySearch();
    unbindCopyUrl(hostPlatform);
  });
  onShareAppMessage(() => {
    return shareToFriend(plazaShare('开黑星球｜发起组队开黑'));
  });
  onShareTimeline(() => {
    return shareToTimeline(plazaShare('开黑星球｜发起组队开黑'));
  });
  const startTimestamp = computed(() => combineDateTime(state.startDate, state.startTime));
  const minTimestamp = new Date().setHours(0, 0, 0, 0);
  const maxTimestamp = Date.now() + 7 * 24 * 3600000;
  const durationOptions = DURATION_PICKER.map((item) => ({ value: item.minutes, label: item.label }));
  function changeStart(timestamp: number) {
    const parts = dateParts(timestamp);
    onStartDate(parts.date);
    onStartTime(parts.time);
  }
  function changeDuration(minutes: number) {
    const index = DURATION_PICKER.findIndex((item) => item.minutes === minutes);
    if (index >= 0) pickCustomDuration(index);
  }
  return {
    startTimestamp,
    minTimestamp,
    maxTimestamp,
    durationOptions,
    changeStart,
    changeDuration,
    MAX_TEAM_MS,
    DURATION_PICKER,
    DURATION_PICKER_LABELS,
    durationPickerIndexFor,
    emptyForm,
    state,
    singlePage,
    editingId,
    platforms,
    voices,
    gameName,
    startDate,
    startTime,
    endDate,
    endTime,
    minDate,
    startPreset,
    durationHours,
    durationLabel,
    durationPickerIndex,
    timeSummaryLine1,
    timeSummaryLine2,
    capacity,
    roomNo,
    roomPwd,
    selectedPlatform,
    server,
    voice,
    rankReq,
    note,
    moreHint,
    submitting,
    showProfile,
    pendingAction,
    fromLast,
    showMore,
    proxyMode,
    proxyKeyword,
    proxySearching,
    proxyResults,
    proxyHost,
    canProxy,
    suggestedGames,
    startPresets,
    durationPresets,
    durationPickerLabels,
    patchState,
    loadEdit,
    applyDraft,
    toggleMore,
    applyDurationTo,
    withTimeSummary,
    pickStartPreset,
    pickDuration,
    pickCustomDuration,
    onGameName,
    pickSuggestedGame,
    onStartDate,
    onStartTime,
    decCap,
    incCap,
    patchExtras,
    onRoomNo,
    onRoomPwd,
    pickPlatform,
    onServer,
    pickVoice,
    onRank,
    onNote,
    loadProxyAccess,
    cancelProxySearch,
    toggleProxy,
    onProxyKeyword,
    searchProxyUsers,
    pickProxyHost,
    clearProxyHost,
    buildTeam,
    scrollToField,
    onSubmit,
    onProfileClose,
    onProfileDone,
  };
}
