/** Shared business payloads. Display fields are added by the view formatters. */
export interface User {
  userId?: string; _id?: string; nickName?: string; avatarUrl?: string;
  avatarFileID?: string; avatarBase64?: string; bio?: string;
}
export type TeamRole = 'host' | 'member';
export interface Team {
  _id: string; id?: string; gameName: string; startAt: number; endAt?: number;
  expireAt?: number; createdAt?: number; capacity: number; memberCount: number;
  roomNo?: string; roomPwd?: string; hasPwd?: boolean; platform: string;
  server?: string; voice?: string; rankReq?: string; note?: string;
  status?: string; displayStatus?: string; statusText?: string; timeText?: string;
  needCount?: number; started?: boolean; soon?: boolean; ongoing?: boolean; mark?: string; proxyNickName?: string;
}
export type TeamDraft = Pick<Team, 'gameName' | 'capacity' | 'platform'> & Partial<Team>;
export interface Member extends User { _id: string; role?: TeamRole }
export interface Seat { key: string | number; member?: Member | null }
export interface Game {
  slug: string; name: string; platform: string; tags: string[];
  seoKey?: string; entryLabel?: string; aliases?: string[];
}
export interface SharePayload { title: string; path?: string; query?: string }
export type PageQuery = Record<string, string | undefined>;
export interface PageEvent<T = string> {
  detail: { value: T; id?: string; gameName?: string; user?: User };
  currentTarget: { dataset: {
    key: string; name: string; id: string; tab: string; phase: string; type: string;
    slug: string; hours: number | string; host?: User; memberid: string;
    action: string; on: boolean | string; handled: boolean | string;
  } };
}
export interface LegalSection { heading: string; body: string }
export interface AdminRow extends Partial<Team>, User {
  _id: string; openid?: string; banned?: boolean; banReason?: string;
  isOrganizer?: boolean; envOrganizer?: boolean; hosted?: number; joined?: number;
  createdAt?: number; status?: string; reason?: string; page?: string; kind?: string;
  handled?: boolean; tag?: string; content?: string; errorMsg?: string;
  targetName?: string; hostOpenid?: string; hostNickName?: string; version?: string; systemInfo?: string;
}
export interface AdminStats {
  teams: { total: number; active: number; recruiting: number; full: number };
  users: { total: number }; members: { total: number };
  reports: { open: number }; feedback: { open: number };
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
