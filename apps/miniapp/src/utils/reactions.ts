export const REACTIONS = [
  { id: 'like', icon: 'thumb-up', activeIcon: 'thumb-up-fill', label: '赞', group: 'attitude' },
  { id: 'dislike', icon: 'thumb-down', activeIcon: 'thumb-down-fill', label: '踩', group: 'attitude' },
  { id: 'love', icon: 'heart', activeIcon: 'heart-fill', label: '喜欢', group: 'love' },
  {
    id: 'next',
    icon: 'face-smile-fill',
    activeIcon: 'face-smile-fill',
    label: '下次一定',
    group: 'schedule',
  },
] as const;
export type ReactionId =
  (typeof REACTIONS)[number]['id'] | 'fire' | 'laugh' | 'watch' | 'game' | 'busy' | 'time';
export const REACTION_IDS: ReactionId[] = [
  'next',
  'like',
  'dislike',
  'love',
  'busy',
  'time',
  'fire',
  'laugh',
  'watch',
  'game',
];
export interface ReactionSummary {
  counts: Partial<Record<ReactionId, number>>;
  mine: ReactionId | '';
  selected?: ReactionId[];
}
export function emptyReactions(): ReactionSummary {
  return { counts: Object.fromEntries(REACTION_IDS.map((id) => [id, 0])), mine: '', selected: [] };
}
export function normalizeReactions(summary?: ReactionSummary): ReactionSummary {
  const selected = summary?.selected || (summary?.mine ? [summary.mine] : []);
  return {
    counts: { ...emptyReactions().counts, ...summary?.counts },
    mine: summary?.mine || '',
    selected: [...selected],
  };
}
export function toggleReaction(summary: ReactionSummary, reaction: ReactionId) {
  const previous = normalizeReactions(summary);
  const selected = previous.selected || [];
  const enabled = !selected.includes(reaction);
  const group = REACTIONS.find((item) => item.id === reaction)?.group;
  const conflicts: ReactionId[] = REACTIONS.filter(
    (item) => item.group === group && item.id !== reaction,
  ).map((item) => item.id as ReactionId);
  if (reaction === 'next') conflicts.push('busy', 'time');
  const next = enabled
    ? [...selected.filter((id) => !conflicts.includes(id) && id !== reaction), reaction]
    : selected.filter((id) => id !== reaction);
  const counts = { ...previous.counts };
  for (const id of REACTION_IDS)
    counts[id] = Math.max(0, (counts[id] || 0) + Number(next.includes(id)) - Number(selected.includes(id)));
  return {
    enabled,
    summary: { counts, selected: next, mine: next[next.length - 1] || '' } as ReactionSummary,
  };
}
