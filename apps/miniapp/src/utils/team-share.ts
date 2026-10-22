import type { Team } from '../types/domain';
import { formatStartAt } from './format';
import { presentTeam } from './team-presentation';
import { teamShareQuery } from './team-entry';

/** Identical vehicle invitation title and destination from lists and detail. */
export function teamShare(team: Partial<Team> | null, teamId: unknown) {
  const query = teamShareQuery(teamId);
  const path = query ? `/pages/team/detail?${query}&from=share` : '/pages/index/index';
  let title = '开黑星球';
  if (team) {
    const view = presentTeam(team);
    const time = formatStartAt(team.startAt).replace(/今天 |今晚 |明天 /, '');
    title += `｜${team.gameName || '开黑'}`;
    if (view.recruitment === 'open') title += ` 还差 ${view.needCount} 人 · ${time}`;
    else if (view.recruitment === 'full') title += ' 已满员';
    else if (view.lifecycle === 'cancelled') title += ' 已散';
    else if (view.lifecycle === 'ended') title += ' 已结束';
    else title += ' 状态待确认';
  }
  return { title, path, query: query ? query + '&from=share' : query };
}
