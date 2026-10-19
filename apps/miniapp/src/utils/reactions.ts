export const REACTIONS = [
  { id: 'like', icon: 'thumb-up', activeIcon: 'thumb-up-fill', label: '赞一个' },
  { id: 'fire', icon: 'lightning-circle-fill', activeIcon: 'lightning-circle-fill', label: '火热' },
  { id: 'laugh', icon: 'face-smile-fill', activeIcon: 'face-smile-fill', label: '有意思' },
  { id: 'love', icon: 'heart', activeIcon: 'heart-fill', label: '喜欢' },
  { id: 'watch', icon: 'eye', activeIcon: 'eye-fill', label: '围观' },
  { id: 'game', icon: 'play-circle', activeIcon: 'play-circle-fill', label: '想玩' },
] as const;
export type ReactionId = (typeof REACTIONS)[number]['id'];
export interface ReactionSummary {
  counts: Record<ReactionId, number>;
  mine: ReactionId | '';
}
export function emptyReactions(): ReactionSummary {
  return { counts: { like: 0, fire: 0, laugh: 0, love: 0, watch: 0, game: 0 }, mine: '' };
}
