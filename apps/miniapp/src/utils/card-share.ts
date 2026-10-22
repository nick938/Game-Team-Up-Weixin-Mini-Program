import type { Team } from '../types/domain';
import { teamDetailPath, usableTeamId } from './team-entry';
import { formatTimeRange } from './format';
import { shareToFriend } from './share';
import { renderCardShareCover } from './card-share-cover';

let nextButtonId = 0;
type Share = ReturnType<typeof shareToFriend>;
const cards = new Map<string, () => (Share & { promise: Promise<Share> }) | null>();

export function registerCardShare(getTeam: () => Partial<Team>, getFallbackId: () => string = () => '') {
  // Each mounted card owns its source, even when the same team appears twice.
  const buttonId = `team-forward-${++nextButtonId}`;
  cards.set(buttonId, () => {
    const team = { ...getTeam() };
    const id = usableTeamId(getFallbackId() || team.id || team._id);
    if (!id) return null;
    // Read current public fields only; never expose room numbers or passwords.
    const share = shareToFriend({
      title: `${team.gameName || '一起开黑'}｜${team.timeText || formatTimeRange(team.startAt || 0, team.endAt)}｜${team.memberCount || 0}/${team.capacity || 0}人`,
      path: teamDetailPath(id, { gameName: team.gameName }) + '&from=share',
    });
    // The native share promise supplies the generated image without changing
    // this card's captured title/path. Drawing failure keeps the safe fallback.
    return {
      ...share,
      promise: renderCardShareCover(team)
        .then((imageUrl) => shareToFriend(share, imageUrl))
        .catch(() => share),
    };
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
