import type { Team } from '../types/domain';
import { usableTeamId } from './team-entry';
import { teamShare } from './team-share';
import { shareToFriend } from './share';
import { renderCardShareCover } from './card-share-cover';
import { callTeam } from '../api/team';

let nextButtonId = 0;
type Share = ReturnType<typeof shareToFriend>;
const cards = new Map<string, () => (Share & { promise: Promise<Share> }) | null>();

export function registerCardShare(
  getTeam: () => Partial<Team>,
  getFallbackId: () => string = () => '',
  onCount?: (id: string, count: number) => void,
) {
  // Each mounted card owns its source, even when the same team appears twice.
  const buttonId = `team-forward-${++nextButtonId}`;
  cards.set(buttonId, () => {
    const team = { ...getTeam() };
    const id = usableTeamId(getFallbackId() || team.id || team._id);
    if (!id) return null;
    void callTeam('trackTeamEvent', { teamId: id, kind: 'share_intent' })
      .then(({ shareCount }) => {
        if (typeof shareCount === 'number' && Number.isSafeInteger(shareCount) && shareCount >= 0)
          onCount?.(id, shareCount);
      })
      .catch(() => {});
    // Read current public fields only; never expose room numbers or passwords.
    const share = shareToFriend(teamShare(team, id));
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
  const input = event as
    { from?: string; target?: { id?: string; dataset?: { cardShareId?: string } } } | undefined;
  if (input?.from !== 'button') return null;
  const buttonId = input.target?.dataset?.cardShareId || input.target?.id;
  if (!buttonId) return null;
  // Native sharing can run before the component click callback. Resolve from the
  // rendered button instead of relying on a pending selection set by that click.
  return cards.get(buttonId)?.() || null;
}
