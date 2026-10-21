import { gameSuggestions, rememberGame } from '../utils/recent-games';
import { overlappingTeams } from '../utils/team-schedule';
import { usePageFeedback } from './usePageFeedback';
import { reactive, toRefs, nextTick, computed, watch } from 'vue';
import { onShow, onHide, onUnload, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import type { Team, TeamDraft, User } from '../types/domain';
import { platform as hostPlatform } from '../platform/host';
import { useAppStore } from '../stores/app';
import { loadMyProfile } from '../utils/my-profile';
import { isSinglePage } from '../utils/runtime';
import { PLATFORMS, VOICES, MAX_TEAM_HOURS } from '../utils/constants';
import { dateParts, combineDateTime, defaultStartAt, defaultEndAt } from '../utils/format';
import { callTeam } from '../api/team';
import { plazaShare, bindCopyUrl, unbindCopyUrl, shareToFriend, shareToTimeline } from '../utils/share';
import { teamDetailPath } from '../utils/team-entry';
import { GAME_CATALOG, findGame } from '../utils/games';
import {
  START_PRESETS,
  DURATION_PRESETS,
  sortPlatforms,
  moreSettingsHint,
  tonightStartAt,
  mergeLegacyNote,
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
  const { toast, dialog, showError } = usePageFeedback();
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
      weeklyId: '',
      weeklyStartAt: 0,
      weeklyGameName: '',
      minimumCapacity: 2,
      editLoadError: '',
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
      capacity: 4,
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
      selectedHistoryId: '',
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
    recentLaunches: [] as Team[],
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
    state.editLoadError = '';
    toast.loading('加载中');
    try {
      const res = await callTeam('getTeam', { teamId: id });
      const team = res.team;
      if (res.role !== 'host') throw new Error('只有车头可以编辑');
      const startAt = team.startAt;
      const endAt = team.endAt || team.expireAt || team.startAt;
      const start = dateParts(startAt);
      const end = dateParts(endAt);
      const voice = team.voice === 'Discord' ? 'KOOK' : team.voice;
      const platform = PLATFORMS.indexOf(team.platform) >= 0 ? team.platform : 'Steam';
      const extras = {
        roomNo: team.roomNo || '',
        roomPwd: team.roomPwd || '',
        server: '',
        voice: VOICES.indexOf(voice || '') >= 0 ? voice : 'KOOK',
        rankReq: '',
        note: mergeLegacyNote(team),
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
        minimumCapacity: Math.max(2, team.memberCount),
        showMore: !!extras.roomPwd || extras.voice !== '不限',
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
      state.editingId = id;
      state.editLoadError = e.message;
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
      roomNo: readGameSettings(draft.gameName)?.contact || '',
      roomPwd: '',
      server: '',
      voice: VOICES.indexOf(voice || '') >= 0 ? voice : 'KOOK',
      rankReq: '',
      note: mergeLegacyNote(draft),
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
      showMore: !!extras.roomPwd || extras.voice !== '不限',
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
      capacity: draft.capacity || 4,
      platform,
      platforms: sortPlatforms(platform, PLATFORMS),
      ...extras,
      moreHint: moreSettingsHint(extras),
    });
  }
  let historyLoadedAt = 0;
  async function loadRecentLaunches() {
    if (historyLoadedAt && Date.now() - historyLoadedAt < 60000) return;
    try {
      const res = await callTeam('myTeams');
      const now = Date.now();
      const seen = new Set<string>();
      state.recentLaunches = (res.hosted || [])
        .sort((a, b) => Number(b.createdAt || b.startAt) - Number(a.createdAt || a.startAt))
        .filter((team) => {
          const name = team.gameName?.trim().toLowerCase();
          if (!name || seen.has(name)) return false;
          seen.add(name);
          return true;
        })
        .slice(0, 3);
      historyLoadedAt = now;
    } catch {
      // History is optional: entering a game and publishing must still work.
    }
  }
  function historyTime(team: Partial<Team>) {
    return dateParts(Number(team.startAt)).time;
  }
  function reuseLaunch(team: Team) {
    if (state.editingId || state.submitting) return;
    const now = Date.now();
    const previous = new Date(team.startAt);
    let startAt = team.startAt;
    if (startAt <= now) {
      const next = new Date(now);
      next.setHours(previous.getHours(), previous.getMinutes(), 0, 0);
      if (next.getTime() <= now) next.setDate(next.getDate() + 1);
      startAt = next.getTime();
    }
    const proxyMode = state.proxyMode;
    const proxyHost = state.proxyHost;
    applyDraft(team);
    changeStart(startAt);
    const minutes = detectDurationMinutes(team.startAt, team.endAt || team.expireAt || 0);
    if (minutes) changeDuration(minutes);
    patchState({
      roomNo: proxyMode ? '' : team.roomNo || '',
      selectedHistoryId: team._id,
      proxyMode,
      proxyHost,
    });
  }
  const DRAFT_KEY = 'publish-draft-v2';
  let draftRestored = false;
  function readLocal(key: string) {
    try {
      return hostPlatform.getStorageSync(key);
    } catch {
      return null;
    }
  }
  function writeLocal(key: string, value: unknown) {
    try {
      hostPlatform.setStorageSync(key, value);
    } catch {
      // Local convenience must never block publishing.
    }
  }
  function readGameSettings(name: string) {
    const value = readLocal('publish-game-v2:' + name.trim());
    if (!value || typeof value !== 'object') return null;
    return value as { contact?: string; capacity?: number; durationMinutes?: number };
  }
  function applyGameSettings(name: string) {
    if (state.editingId) return;
    const settings = readGameSettings(name);
    if (!settings) return;
    const patch: Partial<typeof state> = {};
    if (Number.isInteger(settings.capacity) && settings.capacity! >= 2 && settings.capacity! <= 20)
      patch.capacity = settings.capacity;
    if (!state.proxyMode && typeof settings.contact === 'string') patch.roomNo = settings.contact;
    patchState(patch);
    if (settings.durationMinutes) changeDuration(settings.durationMinutes);
  }
  function rememberSettings() {
    if (state.proxyMode) return;
    writeLocal('publish-game-v2:' + state.gameName.trim(), {
      contact: state.roomNo.trim(),
      capacity: state.capacity,
      durationMinutes: state.durationMinutes,
    });
  }
  function saveDraft() {
    if (state.singlePage || state.editingId || state.proxyMode || state.submitting) return;
    if (!state.gameName.trim() && !state.roomNo.trim() && !state.note.trim()) {
      writeLocal(DRAFT_KEY, null);
      return;
    }
    writeLocal(DRAFT_KEY, { ...buildTeam(), roomPwd: '', weeklyId: state.weeklyId });
  }
  function restoreDraft() {
    if (draftRestored) return;
    draftRestored = true;
    const draft = readLocal(DRAFT_KEY);
    if (!draft || typeof draft !== 'object' || typeof draft.gameName !== 'string') return;
    // Expired start times are renewed; unfinished future dates remain intact.
    applyDraft(draft);
    if (Number(draft.startAt) > Date.now()) changeStart(Number(draft.startAt));
    const minutes = detectDurationMinutes(draft.startAt, draft.endAt);
    if (minutes) changeDuration(minutes);
    patchState({
      roomNo: draft.roomNo || '',
      fromLast: false,
      ...(draft.weeklyId && Number(draft.startAt) > Date.now()
        ? { weeklyId: draft.weeklyId, weeklyStartAt: draft.startAt, weeklyGameName: draft.gameName }
        : {}),
    });
  }
  function startNew() {
    writeLocal(DRAFT_KEY, null);
    patchState(emptyForm());
    void loadProxyAccess();
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
    if (!gameName.trim() && !state.editingId && (state.selectedHistoryId || state.fromLast)) {
      const { proxyMode, proxyHost, proxyKeyword, submitting } = state;
      patchState({ ...emptyForm(), proxyMode, proxyHost, proxyKeyword, submitting });
      writeLocal(DRAFT_KEY, null);
      return;
    }
    const patch: Partial<typeof state> = { gameName, selectedHistoryId: '', fromLast: false };
    const game = findGame(gameName);
    if (game && game.platform) {
      patch.platform = game.platform;
      patch.platforms = sortPlatforms(game.platform, PLATFORMS);
    }
    patchState(patch);
    if (game) applyGameSettings(game.name);
  }
  function pickSuggestedGame(input: string) {
    const game = findGame(input);
    const patch: Partial<typeof state> = {
      gameName: game?.name || input,
      selectedHistoryId: '',
      fromLast: false,
    };
    if (game && PLATFORMS.indexOf(game.platform) >= 0) {
      patch.platform = game.platform;
      patch.platforms = sortPlatforms(game.platform, PLATFORMS);
    }
    patchState(patch);
    applyGameSettings(game?.name || input);
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
    if (state.capacity <= state.minimumCapacity) return;
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
      const profile = await loadMyProfile();
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
  let ownContactBeforeProxy = '';
  function toggleProxy(input: boolean) {
    if (state.editingId || !state.canProxy) return;
    cancelProxySearch();
    const proxyMode = Boolean(input);
    if (proxyMode === state.proxyMode) return;
    if (proxyMode) ownContactBeforeProxy = state.roomNo;
    patchState({
      roomNo: proxyMode ? '' : ownContactBeforeProxy,
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
      roomNo: state.proxyHost?.userId === host.userId ? state.roomNo : '',
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
      ...(state.weeklyId &&
      state.weeklyGameName === state.gameName.trim() &&
      state.weeklyStartAt === combineDateTime(state.startDate, state.startTime)
        ? { weeklyId: state.weeklyId }
        : {}),
      gameName: (state.gameName || '').trim(),
      startAt: combineDateTime(state.startDate, state.startTime),
      endAt: combineDateTime(state.endDate, state.endTime),
      capacity: state.capacity,
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
  function rememberPublishedGame(name: string) {
    try {
      rememberGame(name);
    } catch {
      // Optional local history must never turn a successful server write into a publish error.
    }
  }
  async function onSubmit() {
    if (state.submitting || state.editLoadError) return;
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
      // A schedule conflict is advisory; it never silently prevents participation.
      let conflicts = [] as import('../types/domain').Team[];
      try {
        const mine = await callTeam('myTeams');
        conflicts = overlappingTeams([...mine.hosted, ...mine.joined], { ...team, _id: editingId });
      } catch {
        /* Schedule lookup is optional; publish still works when it fails. */
      }
      if (conflicts.length && !state.proxyMode) {
        try {
          await dialog.confirm({
            title: '和你参加的局时间重叠',
            msg: `与「${conflicts[0].gameName}」等 ${conflicts.length} 个队伍重叠，仍要发布吗？`,
            confirmButtonText: '继续发布',
            cancelButtonText: '返回调整',
          });
        } catch {
          return;
        }
      }
      if (editingId) {
        await callTeam('updateTeam', { teamId: editingId, team });
        rememberPublishedGame(team.gameName);
        rememberSettings();
        historyLoadedAt = 0;
        writeLocal(DRAFT_KEY, null);
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
        rememberPublishedGame(team.gameName);
        rememberSettings();
        historyLoadedAt = 0;
        writeLocal(DRAFT_KEY, null);
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
      if (state.editingId === editingId && !state.editLoadError) return;
      await loadEdit(editingId);
      return;
    }
    if (draft) {
      app.republishTeam = null;
      app.prefillGame = null;
      applyDraft(draft);
    } else if (prefill) {
      app.prefillGame = null;
      patchState(emptyForm());
      const patch: Partial<typeof state> = { gameName: prefill.name || '' };
      if (prefill.startAt && prefill.weeklyId) {
        const start = dateParts(prefill.startAt);
        const end = dateParts(prefill.startAt + 2 * 3600000);
        Object.assign(patch, {
          weeklyId: prefill.weeklyId,
          weeklyStartAt: prefill.startAt,
          weeklyGameName: prefill.name,
          startDate: start.date,
          startTime: start.time,
          endDate: end.date,
          endTime: end.time,
          startPreset: 'custom',
        });
      }
      if (prefill.platform && PLATFORMS.indexOf(prefill.platform) >= 0) {
        patch.platform = prefill.platform;
        patch.platforms = sortPlatforms(prefill.platform, PLATFORMS);
      }
      patchState(withTimeSummary(patch));
      applyGameSettings(prefill.name || '');
    } else {
      restoreDraft();
    }
    await Promise.all([loadProxyAccess(), loadRecentLaunches()]);
  });
  onHide(() => {
    saveDraft();
    unbindCopyUrl(hostPlatform);
  });
  onUnload(() => {
    saveDraft();
    cancelProxySearch();
    unbindCopyUrl(hostPlatform);
  });
  onShareAppMessage(() => {
    return shareToFriend(plazaShare('开黑星球｜发起组队开黑'));
  });
  onShareTimeline(() => {
    return shareToTimeline(plazaShare('开黑星球｜发起组队开黑'));
  });
  const visibleSuggestions = computed(() => gameSuggestions(state.gameName));
  const roomPlaceholder = computed(() => 'Steam 好友码 / 游戏 ID / 微信号');
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
    if (index >= 0) {
      pickCustomDuration(index);
      patchState({ durationHours: durationPresetHoursFromMinutes(minutes) });
    }
  }
  return {
    loadRecentLaunches,
    reuseLaunch,
    historyTime,
    visibleSuggestions,
    roomPlaceholder,
    startNew,
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
