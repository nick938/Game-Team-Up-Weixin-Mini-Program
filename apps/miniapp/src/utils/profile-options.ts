// Developer-maintained options shared with the deployed cloud function. Keep IDs stable.
import { groups, playTimes } from '../../../../cloudfunctions/team/lib/profile-options.json';
export const GROUP_OPTIONS = groups;
export const PLAY_TIME_OPTIONS = playTimes;
export function groupLabels(ids: string[] = []) {
  return GROUP_OPTIONS.filter((option) => ids.includes(option.value)).map((option) => option.label);
}
export function playTimeLabels(ids: string[] = []) {
  return PLAY_TIME_OPTIONS.filter((option) => ids.includes(option.value)).map((option) => option.label);
}
