import type { Team } from '../types/domain';
import { presentTeam } from './team-presentation';
export function scheduledTeams(teams: Team[], now = Date.now()) {
  return [
    ...new Map(
      teams.filter((team) => presentTeam(team, null, now).ongoing).map((team) => [team._id, team]),
    ).values(),
  ].sort((a, b) => {
    const upcomingA = a.startAt > now,
      upcomingB = b.startAt > now;
    return upcomingA !== upcomingB ? (upcomingA ? -1 : 1) : a.startAt - b.startAt;
  });
}
export function overlappingTeams(teams: Team[], target: Partial<Team>, now = Date.now()) {
  const end = Number(target.endAt || target.expireAt);
  return scheduledTeams(teams, now).filter(
    (team) =>
      team._id !== target._id &&
      team.startAt < end &&
      Number(team.endAt || team.expireAt) > Number(target.startAt),
  );
}
