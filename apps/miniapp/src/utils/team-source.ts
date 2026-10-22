import type { Team } from '../types/domain';
export function officialTeamLabel(team: Partial<Team>): string {
  if (!team.dailyNightId) return '';
  return team.officialSource === 'random' ? '官方 · 随机车' : '官方 · 冠军车';
}
