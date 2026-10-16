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
export interface Team {
  _id: string;
  id?: string;
  gameName: string;
  startAt: number;
  endAt?: number;
  expireAt?: number;
  createdAt?: number;
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
export interface AdminStats {
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
  getProfile: { user?: User; isAdmin?: boolean; isOrganizer?: boolean };
  getTeam: { team: Team; members: Member[]; role: TeamRole | null };
  getPublicProfile: { profile: User };
  listTeams: { list: Team[]; nextOffset?: number; hasMore?: boolean };
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
  getProfile: undefined;
  getTeam: { teamId: string };
  getPublicProfile: { teamId: string; memberId: string };
  listTeams: { offset?: number; limit?: number };
  myTeams: undefined;
  searchProxyUsers: { keyword: string };
  createTeam: { team: TeamInput; hostOpenid?: string };
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
