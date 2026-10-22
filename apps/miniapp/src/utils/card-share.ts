import type { Team } from '../types/domain';
import { teamDetailPath, usableTeamId } from './team-entry';
import { formatTimeRange } from './format';
import { shareToFriend } from './share';

let nextButtonId = 0;
const cards = new Map<string, () => ReturnType<typeof shareToFriend> | null>();

export function registerCardShare(getTeam: () => Partial<Team>, getFallbackId: () => string = () => '') {
  // Each mounted card owns its source, even when the same team appears twice.
  const buttonId = `team-forward-${++nextButtonId}`;
  cards.set(buttonId, () => {
    const team = getTeam();
    const id = usableTeamId(getFallbackId() || team.id || team._id);
    if (!id) return null;
    // Read current public fields only; never expose room numbers or passwords.
    return shareToFriend({
      title: `${team.gameName || '一起开黑'}｜${team.timeText || formatTimeRange(team.startAt || 0, team.endAt)}｜${team.memberCount || 0}/${team.capacity || 0}人`,
      path: teamDetailPath(id, { gameName: team.gameName }) + '&from=share',
    });
  });
  return { buttonId, dispose: () => cards.delete(buttonId) };
}

export function cardShareFromEvent(event: unknown) {
  const input = event as { from?: string; target?: { id?: string } } | undefined;
  if (input?.from !== 'button' || !input.target?.id) return null;
  // Native sharing can run before the component click callback. Resolve from the
  // rendered button instead of relying on a pending selection set by that click.
  return cards.get(input.target.id)?.() || null;
}
