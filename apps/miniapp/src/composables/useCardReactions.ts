import { reactive, watch } from 'vue';
import type { Team } from '../types/domain';
import { callTeam } from '../api/team';
import { emptyReactions, REACTIONS, type ReactionId } from '../utils/reactions';
import { usableTeamId } from '../utils/team-entry';
import { usePageFeedback } from './usePageFeedback';

export function useCardReactions(team: () => Partial<Team>) {
  const { showError } = usePageFeedback();
  const state = reactive({ summary: team().reactions || emptyReactions(), pending: false });
  let revision = 0;
  watch(
    () => [team()._id || team().id, team().reactions] as const,
    () => {
      revision++;
      state.summary = team().reactions || emptyReactions();
      state.pending = false;
    },
  );
  async function react(reaction: ReactionId) {
    const id = usableTeamId(team()._id || team().id);
    if (!id || state.pending || !REACTIONS.some((item) => item.id === reaction)) return;
    state.pending = true;
    const request = revision;
    try {
      const res = await callTeam('setReaction', {
        teamId: id,
        reaction: state.summary.mine === reaction ? '' : reaction,
      });
      if (request === revision) state.summary = res.reactions;
    } catch (error) {
      if (request === revision) showError(error);
    } finally {
      if (request === revision) state.pending = false;
    }
  }
  return { state, react, REACTIONS };
}
