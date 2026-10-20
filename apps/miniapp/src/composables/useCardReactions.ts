import { reactive, watch, onUnmounted } from 'vue';
import { onHide } from '@dcloudio/uni-app';
import type { Team } from '../types/domain';
import { callTeam } from '../api/team';
import { normalizeReactions, toggleReaction, REACTIONS, type ReactionId } from '../utils/reactions';
import { usableTeamId } from '../utils/team-entry';
import { usePageFeedback } from './usePageFeedback';

export function useCardReactions(team: () => Partial<Team>) {
  const { showError } = usePageFeedback();
  const state = reactive({
    summary: normalizeReactions(team().reactions),
    pending: false,
    pulse: '' as ReactionId | '',
    cancelPulse: '' as ReactionId | '',
    effectId: 0,
  });
  let revision = 0;
  let effectTimer: ReturnType<typeof setTimeout> | undefined;
  function stopEffect() {
    clearTimeout(effectTimer);
    state.pulse = '';
    state.cancelPulse = '';
  }
  function playEffect(reaction: ReactionId, enabled: boolean) {
    stopEffect();
    state.effectId++;
    state.pulse = enabled ? reaction : '';
    state.cancelPulse = enabled ? '' : reaction;
    const duration = enabled
      ? { like: 550, dislike: 300, love: 500, next: 750 }[reaction as 'like' | 'dislike' | 'love' | 'next'] ||
        200
      : 180;
    effectTimer = setTimeout(stopEffect, duration);
  }
  onHide(stopEffect);
  onUnmounted(() => {
    revision++;
    stopEffect();
  });
  watch(
    () => [team()._id || team().id, team().reactions] as const,
    () => {
      revision++;
      state.summary = normalizeReactions(team().reactions);
      state.pending = false;
      stopEffect();
    },
  );
  async function react(reaction: ReactionId) {
    const id = usableTeamId(team()._id || team().id);
    if (!id || state.pending || !REACTIONS.some((item) => item.id === reaction)) return;
    const previous = normalizeReactions(state.summary);
    const { enabled, summary } = toggleReaction(previous, reaction);
    state.pending = true;
    state.summary = summary;
    playEffect(reaction, enabled);
    const request = revision;
    try {
      const res = await callTeam('setReaction', {
        teamId: id,
        reaction,
        enabled,
      });
      if (request === revision) {
        state.summary = normalizeReactions(res.reactions);
      }
    } catch (error) {
      if (request === revision) {
        state.summary = previous;
        stopEffect();
        showError(error);
      }
    } finally {
      if (request === revision) state.pending = false;
    }
  }
  return { state, react, REACTIONS };
}
