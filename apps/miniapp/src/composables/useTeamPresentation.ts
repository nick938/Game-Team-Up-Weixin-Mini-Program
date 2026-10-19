import { computed, onMounted, onUnmounted, ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import type { Team, TeamRole } from '../types/domain';
import { presentTeam } from '../utils/team-presentation';

/** Re-evaluate cached views at the next meaningful time boundary, without polling. */
export function useTeamPresentation(
  team: MaybeRefOrGetter<Partial<Team>>,
  role: MaybeRefOrGetter<TeamRole | null> = null,
  onBoundary?: () => void,
) {
  const now = ref(Date.now());
  let mounted = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function schedule() {
    clearTimeout(timer);
    if (!mounted) return;
    now.value = Date.now();
    const value = toValue(team);
    if (!presentTeam(value, toValue(role), now.value).ongoing) return;
    const start = Number(value.startAt);
    const end = Number(value.endAt || value.expireAt || value.startAt);
    const next = [start - 3600000, start, end]
      .filter((time) => Number.isFinite(time) && time > now.value)
      .sort((a, b) => a - b)[0];
    if (next === undefined) return;
    timer = setTimeout(
      () => {
        schedule();
        onBoundary?.();
      },
      Math.min(next - now.value + 20, 2147483647),
    );
  }
  watch(() => toValue(team), schedule);
  onMounted(() => {
    mounted = true;
    schedule();
  });
  onUnmounted(() => {
    mounted = false;
    clearTimeout(timer);
  });
  return computed(() => presentTeam(toValue(team), toValue(role), now.value));
}
