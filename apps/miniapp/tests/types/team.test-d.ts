import { callTeam } from '../../src/api/team';

// Compiled by vue-tsc only; never executed or sent to a server.
async function verifyContracts() {
  const result = await callTeam('getTeam', { teamId: 'team-id' });
  result.team?.gameName.toUpperCase();
  // @ts-expect-error Unknown business actions must not reach the RPC transport.
  await callTeam('deleteEverything');
  // @ts-expect-error Mutations require their typed input.
  await callTeam('joinTeam');
  // @ts-expect-error A team identifier cannot be numeric.
  await callTeam('leaveTeam', { teamId: 123 });
  // @ts-expect-error read-only profile result does not expose a team payload.
  void (await callTeam('getProfile')).team;
}
void verifyContracts;
