import type { Team } from '../types/domain';
export function officialTeamLabel(team: Partial<Team>): string {
  if (team.fixedPlanId) return '每日固定车';
  if (!team.dailyNightId) return '';
  if (__BUILD_TARGET__ === 'mp-weixin') return '官方推荐车';
  return team.officialSource === 'random' ? '官方 · 随机车' : '官方 · 冠军车';
}
