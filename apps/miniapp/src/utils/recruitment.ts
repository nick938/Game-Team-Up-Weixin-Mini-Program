import type { Team } from '../types/domain';
import { presentTeam } from './team-presentation';
export function recruitmentText(team: Team) {
  const view = presentTeam(team, 'host');
  const requirements = [team.platform, team.server, team.rankReq, team.voice]
    .filter((value) => value && value !== '不限')
    .join(' · ');
  return [
    `${team.gameName}，一起开黑！`,
    `${team.timeText || '开局时间请查看队伍卡片'} · 还缺 ${view.needCount} 人`,
    requirements,
    '点击小程序队伍卡片加入，进房方式在队伍里查看。',
  ]
    .filter(Boolean)
    .join('\n');
}
