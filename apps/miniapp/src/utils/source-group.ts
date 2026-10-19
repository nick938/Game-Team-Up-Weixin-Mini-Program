import type { Team } from '../types/domain';
export function normalizeSourceGroup(value: unknown): string {
  return typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g, ' ') : '';
}
export function sourceGroupOptions(teams: Partial<Team>[], selected = '') {
  const names = [...new Set(teams.map((team) => normalizeSourceGroup(team.sourceGroup)).filter(Boolean))];
  const chosen = selected.startsWith('group:') ? selected.slice(6) : '';
  if (chosen && !names.includes(chosen)) names.unshift(chosen);
  return [
    { label: '全部群', value: '' },
    { label: '未标注群', value: '__ungrouped__' },
    ...names.map((name) => ({ label: name, value: 'group:' + name })),
  ];
}
export function matchSourceGroup(team: Partial<Team>, filter: string) {
  if (!filter) return true;
  const name = normalizeSourceGroup(team.sourceGroup);
  return filter === '__ungrouped__' ? !name : filter === 'group:' + name;
}
