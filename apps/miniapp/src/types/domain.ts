import type { ReactionId, ReactionSummary } from '../utils/reactions';
export interface DailyOption {
  id: string;
  gameName: string;
  platform: string;
  createdAt: number;
  votes: number;
  mine: boolean;
}
export interface DailyBoard {
  dayId: string;
  serverNow: number;
  settleAt: number;
  startAt: number;
  endAt: number;
  votingClosed: boolean;
  settledAt: number;
  winnerId: string;
  teamId: string;
  unavailableReason: string;
  source: 'vote' | 'history' | '';
  selectedGame: { gameName: string; platform: string; capacity: number } | null;
  team: {
    id: string;
    gameName: string;
    platform: string;
    memberCount: number;
    capacity: number;
    status: string;
    pendingHost: boolean;
    hostNickName: string;
    endAt: number;
  } | null;
  options: DailyOption[];
}
/** Shared business payloads. Display fields are added by the view formatters. */
export interface User {
  userId?: string;
  _id?: string;
  nickName?: string;
  avatarUrl?: string;
  avatarFileID?: string;
  avatarBase64?: string;
  bio?: string;
}
export type TeamRole = 'host' | 'member';
export interface RankingUser {
  bio?: string;
  userKey: string;
  nickName: string;
  avatarUrl: string;
  count: number;
}
export interface Team {
  pendingHost?: boolean;
  dailyNightId?: string;
  officialSource?: 'champion' | 'random';
  weeklyId?: string;
  reactions?: ReactionSummary;
  viewCount?: number;
  _id: string;
  id?: string;
  gameName: string;
  startAt: number;
  endAt?: number;
  expireAt?: number;
  createdAt?: number;
  updatedAt?: number;
  detailsChangedAt?: number;
  changedFields?: string[];
  hostNickName?: string;
  hostAvatarUrl?: string;
  capacity: number;
  memberCount: number;
  roomNo?: string;
  roomPwd?: string;
  hasPwd?: boolean;
  platform: string;
  server?: string;
  voice?: string;
  rankReq?: string;
  note?: string;
  status?: string;
  displayStatus?: string;
  statusText?: string;
  timeText?: string;
  needCount?: number;
  started?: boolean;
  soon?: boolean;
  ongoing?: boolean;
  mark?: string;
  proxyNickName?: string;
}
export type TeamDraft = Pick<Team, 'gameName' | 'capacity' | 'platform'> & Partial<Team>;
export interface Member extends User {
  _id: string;
  role?: TeamRole;
}
export interface Seat {
  key: string | number;
  member?: Member | null;
}
export interface Game {
  slug: string;
  name: string;
  platform: string;
  tags: string[];
  seoKey?: string;
  entryLabel?: string;
  aliases?: string[];
  navTitle?: string;
  headline?: string;
  blurb?: string;
  shareTitle?: string;
  featured?: boolean;
}
export interface SharePayload {
  title: string;
  path?: string;
  query?: string;
}
export type PageQuery = Record<string, string | undefined>;
export interface LegalSection {
  heading: string;
  body: string;
}
export interface AdminRow extends Partial<Team>, User {
  _id: string;
  openid?: string;
  banned?: boolean;
  banReason?: string;
  isOrganizer?: boolean;
  envOrganizer?: boolean;
  hosted?: number;
  joined?: number;
  createdAt?: number;
  status?: string;
  reason?: string;
  page?: string;
  kind?: string;
  handled?: boolean;
  tag?: string;
  content?: string;
  errorMsg?: string;
  targetName?: string;
  hostOpenid?: string;
  hostNickName?: string;
  version?: string;
  systemInfo?: string;
}
export interface TeamSearch {
  weeklyId?: string;
  offset?: number;
  limit?: number;
  keyword?: string;
  gameName?: string;
  gameNames?: string[];
  platform?: string;
  server?: string;
  voice?: string;
  availableOnly?: boolean;
  time?: string;
  sortMode?: string;
}
export interface AdminStats {
  funnel?: {
    published: number;
    withMembers: number;
    full: number;
    shareVisitors: number;
    shareJoined: number;
    roomCopies: number;
  };
  teams: { total: number; active: number; recruiting: number; full: number };
  users: { total: number };
  members: { total: number };
  reports: { open: number };
  feedback: { open: number };
  topGames: { gameName: string; active: number; teams: number; score: number; pct?: number }[];
  trend: { date: string; count: number; pct?: number }[];
  platforms: { platform: string; count: number; pct?: number }[];
}
export interface TeamResults {
  getUserRankings: { hosted: RankingUser[]; joined: RankingUser[]; generatedAt: number };
  getDailyPlay: { board: DailyBoard };
  createPlayOption: { board: DailyBoard | null };
  votePlayOption: { board: DailyBoard | null; teamId: string };
  getProfile: { user?: User; isAdmin?: boolean; isOrganizer?: boolean };
  getTeam: { team: Team; members: Member[]; role: TeamRole | null; reactions?: ReactionSummary };
  getPublicProfile: { profile: User };
  setReaction: { reactions: ReactionSummary };
  listTeams: {
    list: Team[];
    total?: number;
    nextOffset?: number;
    hasMore?: boolean;
    games?: string[];
  };
  myTeams: { hosted: Team[]; joined: Team[] };
  searchProxyUsers: { list: User[] };
  submitFeedback: { mailed?: boolean; mailError?: string };
  createTeam: { teamId: string };
  saveProfile: { user: User };
  adminOverview: { stats: AdminStats };
  adminTeams: { list: AdminRow[] };
  adminUsers: { list: AdminRow[]; total: number };
  adminReports: { list: AdminRow[] };
  adminFeedback: { list: AdminRow[] };
}

export interface TeamInput {
  weeklyId?: string;
  gameName: string;
  startAt: number;
  endAt: number;
  capacity: number;
  roomNo: string;
  platform: string;
  roomPwd?: string;
  server?: string;
  voice?: string;
  rankReq?: string;
  note?: string;
}
export interface VersionInput {
  version: string;
  envVersion: string;
}
export interface TeamRequests {
  getUserRankings: undefined;
  getDailyPlay: undefined;
  createPlayOption: { gameName: string; platform: string; requestId: string };
  votePlayOption: { optionId: string; want: boolean };
  getProfile: undefined;
  getTeam: { teamId: string };
  setReaction: { teamId: string; reaction: ReactionId | ''; enabled?: boolean };
  getPublicProfile: { teamId: string; memberId: string };
  listTeams: TeamSearch;
  trackTeamEvent: { teamId: string; kind: 'detail_view' | 'share_view' | 'copy_room' };
  myTeams: undefined;
  searchProxyUsers: { keyword: string };
  createTeam: { team: TeamInput; hostOpenid?: string; claimTeamId?: string };
  updateTeam: { teamId: string; team: TeamInput };
  joinTeam: { teamId: string };
  leaveTeam: { teamId: string };
  cancelTeam: { teamId: string };
  saveProfile: { nickName: string; bio: string; avatarUrl: string };
  submitFeedback: VersionInput & { kind: string; page: string; content: string };
  submitBug: VersionInput & { page: string; content: string; errorMsg: string; systemInfo: string };
  submitReport: VersionInput & { targetType: 'team'; targetId: string; reason: string; content: string };
  adminOverview: undefined;
  adminTeams: undefined;
  adminUsers: undefined;
  adminFeedback: { status: string };
  adminReports: { kind: string; status: string };
  adminSetBan: { userId: string; banned: boolean; reason: string };
  adminSetOrganizer: { userId: string; enabled: boolean };
  adminCancelTeam: { teamId: string };
  adminHandleFeedback: { feedbackId: string; status: string };
  adminHandleReport: { reportId: string; status: string };
}
export type TeamResponse<K extends keyof TeamRequests> = { ok: true } & (K extends keyof TeamResults
  ? TeamResults[K]
  : Record<never, never>);
