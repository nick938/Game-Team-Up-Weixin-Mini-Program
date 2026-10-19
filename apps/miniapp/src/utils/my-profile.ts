import { callTeam } from '../api/team';
import { useAppStore } from '../stores/app';
import type { TeamResults, User } from '../types/domain';
// Short-lived, per-store bootstrap reuse. Explicit refresh and saving bypass it.
const profiles = new WeakMap<
  object,
  {
    result?: TeamResults['getProfile'];
    user?: User | null;
    at: number;
    pending?: Promise<TeamResults['getProfile']>;
  }
>();
export function loadMyProfile(force = false): Promise<TeamResults['getProfile']> {
  const app = useAppStore();
  const entry = profiles.get(app) || { at: 0 };
  profiles.set(app, entry);
  if (entry.pending) return entry.pending;
  if (force !== true && entry.result && entry.user === app.user && Date.now() - entry.at < 15000)
    return Promise.resolve(entry.result);
  const initialUser = app.user;
  entry.pending = callTeam('getProfile')
    .then((response) => {
      // A profile saved while this request was running wins over the older response.
      const result = app.user !== initialUser && app.user ? { ...response, user: app.user } : response;
      app.user = result.user || null;
      app.isAdmin = !!result.isAdmin;
      app.isOrganizer = !!result.isOrganizer;
      entry.result = result;
      entry.user = app.user;
      entry.at = Date.now();
      return result;
    })
    .finally(() => {
      entry.pending = undefined;
    });
  return entry.pending;
}
