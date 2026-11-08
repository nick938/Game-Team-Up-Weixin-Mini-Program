import { computed, ref } from 'vue';
import { callTeam } from '../api/team';
import type { GroupCatalog, GroupOption } from '../types/domain';
// Bundled seeds remain available during startup and network failures.
import { groups, playTimes } from '../../../../cloudfunctions/team/lib/profile-options.json';
import { profileStringList } from './profile-data';
export const ALL_GROUP_OPTIONS = ref<GroupOption[]>(groups.map((group) => ({ ...group, enabled: true })));
export const GROUP_OPTIONS = computed(() => ALL_GROUP_OPTIONS.value.filter((group) => group.enabled));
let revision = -1;
let loadedAt = 0;
let pending: Promise<void> | undefined;
export function applyGroupCatalog(catalog: GroupCatalog) {
  if (!Array.isArray(catalog.groups) || !Number.isInteger(catalog.revision) || catalog.revision < revision)
    return;
  ALL_GROUP_OPTIONS.value = catalog.groups;
  revision = catalog.revision;
  loadedAt = Date.now();
}
export function loadGroupOptions(force = false): Promise<void> {
  if (pending) return pending;
  if (!force && Date.now() - loadedAt < 30000) return Promise.resolve();
  pending = callTeam('getGroupOptions')
    .then(applyGroupCatalog)
    .finally(() => {
      pending = undefined;
    });
  return pending;
}
export const PLAY_TIME_OPTIONS = playTimes;
export function groupLabels(ids: unknown = []) {
  const values = profileStringList(ids);
  return ALL_GROUP_OPTIONS.value
    .filter((option) => values.includes(option.value))
    .map((option) => option.label);
}
export function playTimeLabels(ids: unknown = []) {
  const values = profileStringList(ids);
  return PLAY_TIME_OPTIONS.filter((option) => values.includes(option.value)).map((option) => option.label);
}
