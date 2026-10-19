import type { Team, TeamRole } from '../types/domain';
export type Lifecycle = 'scheduled' | 'active' | 'ended' | 'cancelled';
export type Recruitment = 'open' | 'full' | 'closed';
export type ViewerRole = 'visitor' | 'member' | 'host';
export type TeamAction = 'join' | 'share' | 'room' | 'manage' | 'leave' | 'browse' | 'republish';
export interface TeamPresentation {
  lifecycle: Lifecycle | null;
  recruitment: Recruitment | null;
  viewerRole: ViewerRole;
  confirmed: boolean;
  ongoing: boolean;
  canJoin: boolean;
  canViewPassword: boolean;
  needCount: number;
  statusLabel: string;
  timeLabel: string;
  tone: 'open' | 'full' | 'closed' | 'unknown';
  primaryAction: TeamAction;
  secondaryActions: TeamAction[];
}

/** A view projection only. Server authorization and mutation rules remain authoritative. */
export function presentTeam(
  team: Partial<Team>,
  role: TeamRole | null = null,
  now = Date.now(),
): TeamPresentation {
  const viewerRole: ViewerRole = role || 'visitor';
  const base: TeamPresentation = {
    lifecycle: null,
    recruitment: null,
    viewerRole,
    confirmed: false,
    ongoing: false,
    canJoin: false,
    canViewPassword: false,
    needCount: 0,
    statusLabel: '状态待确认',
    timeLabel: '',
    tone: 'unknown',
    primaryAction: 'browse',
    secondaryActions: [],
  };
  const capacity = Number(team.capacity);
  const count = Number(team.memberCount);
  const start = Number(team.startAt);
  const end = Number(team.endAt || team.expireAt || team.startAt);
  const raw = team.displayStatus || team.status;
  const countsValid =
    Number.isInteger(capacity) &&
    capacity >= 2 &&
    capacity <= 20 &&
    Number.isInteger(count) &&
    count >= 1 &&
    count <= capacity;
  const timesValid = Number.isFinite(start) && start > 0 && Number.isFinite(end) && end >= start;
  if (
    !countsValid ||
    !timesValid ||
    (raw && !['recruiting', 'full', 'cancelled', 'expired', 'ended'].includes(raw))
  )
    return base;
  // Cancellation survives the end-time boundary; locally expired snapshots never enable joining.
  const lifecycle: Lifecycle =
    raw === 'cancelled'
      ? 'cancelled'
      : raw === 'expired' || raw === 'ended' || now >= end
        ? 'ended'
        : now >= start
          ? 'active'
          : 'scheduled';
  const ongoing = lifecycle === 'active' || lifecycle === 'scheduled';
  const full = raw === 'full' || count >= capacity;
  const recruitment: Recruitment = !ongoing ? 'closed' : full ? 'full' : 'open';
  const needCount = Math.max(0, capacity - count);
  const primaryAction: TeamAction =
    !ongoing || (full && viewerRole === 'visitor')
      ? 'browse'
      : full
        ? 'room'
        : viewerRole === 'visitor'
          ? 'join'
          : 'share';
  const secondaryActions: TeamAction[] = !ongoing
    ? viewerRole === 'host'
      ? ['republish']
      : []
    : viewerRole === 'visitor'
      ? ['share']
      : viewerRole === 'host'
        ? ['manage']
        : ['leave'];
  // The API strips unauthorized fields. A role alone never creates password permission.
  const canViewPassword =
    Object.prototype.hasOwnProperty.call(team, 'roomPwd') &&
    (viewerRole === 'host' || (viewerRole === 'member' && lifecycle !== 'cancelled'));
  return {
    lifecycle,
    recruitment,
    viewerRole,
    confirmed: true,
    ongoing,
    canJoin: ongoing && !full && viewerRole === 'visitor',
    canViewPassword,
    needCount,
    statusLabel:
      lifecycle === 'cancelled'
        ? '已散'
        : lifecycle === 'ended'
          ? '已结束'
          : full
            ? '已满员'
            : `还差 ${needCount} 人`,
    timeLabel: !ongoing ? '' : lifecycle === 'active' ? '进行中' : start - now <= 3600000 ? '即将开始' : '',
    tone: !ongoing ? 'closed' : full ? 'full' : 'open',
    primaryAction,
    secondaryActions,
  };
}
