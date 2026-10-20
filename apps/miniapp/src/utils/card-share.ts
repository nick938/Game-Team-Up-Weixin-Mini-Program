import type { Team } from '../types/domain';
import { teamDetailPath, usableTeamId } from './team-entry';
import { formatTimeRange } from './format';
import { shareToFriend } from './share';
let pending: { id: string; title: string; path: string; at: number } | undefined;
export function prepareCardShare(team: Partial<Team>, fallbackId = '') {
  const id = usableTeamId(fallbackId || team.id || team._id);
  if (!id) {
    pending = undefined;
    return;
  }
  // Capture only public fields; never serialize room information into native button data.
  pending = {
    id,
    title: `${team.gameName || '一起开黑'}｜${team.timeText || formatTimeRange(team.startAt || 0, team.endAt)}｜${team.memberCount || 0}/${team.capacity || 0}人`,
    path: teamDetailPath(id, { gameName: team.gameName }) + '&from=share',
    at: Date.now(),
  };
}
export function cardShareFromEvent(event: unknown) {
  const input = event as { from?: string; target?: { id?: string } } | undefined;
  const selected = pending;
  pending = undefined;
  if (
    !selected ||
    input?.from !== 'button' ||
    input.target?.id !== `team-forward-${selected.id}` ||
    Date.now() - selected.at > 30000
  )
    return null;
  return shareToFriend({ title: selected.title, path: selected.path });
}
