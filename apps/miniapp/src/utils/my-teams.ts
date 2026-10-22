import type { Team } from '../types/domain';

/** One record per team; hosting takes precedence if both API lists include it. */
export function uniqueMyTeams(hosted: Team[], joined: Team[]) {
  return [...new Map([...joined, ...hosted].map((team) => [team.id || team._id, team])).values()];
}

export function myTeamsPath(tab: 'hosted' | 'joined' | 'all') {
  return `/pages/mine/teams?tab=${tab}&phase=Ongoing`;
}
