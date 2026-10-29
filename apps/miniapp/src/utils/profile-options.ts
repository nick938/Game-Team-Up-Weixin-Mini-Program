// Developer-maintained options shared with the deployed cloud function. Keep IDs stable.
import { groups, playTimes } from '../../../../cloudfunctions/team/lib/profile-options.json';
import { profileStringList } from './profile-data';
export const GROUP_OPTIONS = groups;
export const PLAY_TIME_OPTIONS = playTimes;
export function groupLabels(ids: unknown = []) {
  const values = profileStringList(ids);
  return GROUP_OPTIONS.filter((option) => values.includes(option.value)).map((option) => option.label);
}
export function playTimeLabels(ids: unknown = []) {
  const values = profileStringList(ids);
  return PLAY_TIME_OPTIONS.filter((option) => values.includes(option.value)).map((option) => option.label);
}
