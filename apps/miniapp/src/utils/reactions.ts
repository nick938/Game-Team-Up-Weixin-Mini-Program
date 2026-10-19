export const REACTIONS = [
  { id: 'like', emoji: '👍', label: '赞一个' },
  { id: 'fire', emoji: '🔥', label: '火热' },
  { id: 'laugh', emoji: '😂', label: '有意思' },
  { id: 'love', emoji: '❤️', label: '喜欢' },
  { id: 'watch', emoji: '👀', label: '围观' },
  { id: 'game', emoji: '🎮', label: '想玩' },
] as const;
export type ReactionId = (typeof REACTIONS)[number]['id'];
export interface ReactionSummary {
  counts: Record<ReactionId, number>;
  mine: ReactionId | '';
}
export function emptyReactions(): ReactionSummary {
  return { counts: { like: 0, fire: 0, laugh: 0, love: 0, watch: 0, game: 0 }, mine: '' };
}
