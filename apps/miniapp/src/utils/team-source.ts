import type { Team } from '../types/domain';
export function officialTeamLabel(team: Partial<Team>): string {
  if (team.fixedPlanId) return '每日固定车';
  if (!team.dailyNightId) return '';
  return team.officialSource === 'random' ? '官方 · 随机车' : '官方 · 冠军车';
}
