import { reactive, watch, onUnmounted } from 'vue';
import { onShow, onHide } from '@dcloudio/uni-app';
import type { Team } from '../types/domain';
import { callTeam } from '../api/team';
import {
  normalizeReactions,
  toggleReaction,
  REACTIONS,
  type ReactionId,
  type ReactionSummary,
} from '../utils/reactions';
import { usableTeamId } from '../utils/team-entry';
import { usePageFeedback } from './usePageFeedback';

const DEBOUNCE_MS = 500;
interface ReactionSync {
  id: string;
  confirmed: ReactionSummary;
  desired: ReactionId | '';
  version: number;
  inFlight: boolean;
  ready: boolean;
  attached: boolean;
  visible: boolean;
  timer?: ReturnType<typeof setTimeout>;
}
export function useCardReactions(team: () => Partial<Team>) {
  const { showError } = usePageFeedback();
  function createSync(): ReactionSync {
    const confirmed = normalizeReactions(team().reactions);
    return {
      id: usableTeamId(team()._id || team().id),
      confirmed,
      desired: confirmed.mine,
      version: 0,
      inFlight: false,
      ready: false,
      attached: true,
      visible: true,
    };
  }
  let sync = createSync();
  const state = reactive({
    summary: normalizeReactions(sync.confirmed),
    pending: false,
    pulse: '' as ReactionId | '',
    cancelPulse: '' as ReactionId | '',
    effectId: 0,
  });
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
  function project(confirmed: ReactionSummary, desired: ReactionId | '') {
    if (confirmed.mine === desired) return normalizeReactions(confirmed);
    if (desired) return toggleReaction(confirmed, desired).summary;
    if (confirmed.mine) return toggleReaction(confirmed, confirmed.mine).summary;
    return normalizeReactions(confirmed);
  }
  async function flush(current: ReactionSync) {
    if (!current.ready || current.inFlight || !current.id) return;
    current.ready = false;
    if (current.desired === current.confirmed.mine) {
      if (current.attached) {
        state.summary = normalizeReactions(current.confirmed);
        state.pending = false;
      }
      return;
    }
    const target = current.desired;
    const version = current.version;
    current.inFlight = true;
    try {
      // Send the final desired single selection, including '' to clear it.
      // Requests for one card are serialized so an older write cannot land last.
      const res = await callTeam('setReaction', { teamId: current.id, reaction: target });
      current.confirmed = normalizeReactions(res.reactions);
      if (version === current.version) current.desired = current.confirmed.mine;
      if (current.attached) state.summary = project(current.confirmed, current.desired);
    } catch (error) {
      if (version === current.version) {
        current.desired = current.confirmed.mine;
        if (current.attached) {
          state.summary = normalizeReactions(current.confirmed);
          stopEffect();
          if (current.visible) showError(error);
        }
      } else if (current.attached) {
        // A failed older write must not undo a newer click.
        state.summary = project(current.confirmed, current.desired);
      }
    } finally {
      current.inFlight = false;
      if (current.attached) state.pending = current.desired !== current.confirmed.mine;
      if (current.ready) void flush(current);
    }
  }
  function flushPending(current: ReactionSync) {
    clearTimeout(current.timer);
    current.timer = undefined;
    current.ready = true;
    void flush(current);
  }
  onShow(() => {
    sync.visible = true;
  });
  onHide(() => {
    sync.visible = false;
    stopEffect();
    flushPending(sync);
  });
  onUnmounted(() => {
    sync.attached = false;
    stopEffect();
    flushPending(sync);
  });
  watch(
    () => [team()._id || team().id, team().reactions] as const,
    ([id]) => {
      if (id === sync.id && (sync.inFlight || sync.timer || state.pending)) return;
      sync.attached = false;
      flushPending(sync);
      sync = createSync();
      state.summary = normalizeReactions(sync.confirmed);
      state.pending = false;
      stopEffect();
    },
  );
  function react(reaction: ReactionId) {
    if (!sync.id || !REACTIONS.some((item) => item.id === reaction)) return;
    const { enabled, summary } = toggleReaction(state.summary, reaction);
    state.summary = summary;
    state.pending = true;
    playEffect(reaction, enabled);
    sync.desired = summary.mine;
    sync.version++;
    sync.ready = false;
    clearTimeout(sync.timer);
    const current = sync;
    current.timer = setTimeout(() => {
      current.timer = undefined;
      current.ready = true;
      void flush(current);
    }, DEBOUNCE_MS);
  }
  return { state, react, REACTIONS };
}
