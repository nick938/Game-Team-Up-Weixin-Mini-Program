import { defineStore } from 'pinia';
import type { Session } from '../api/client';
import type { User, TeamDraft, Game } from '../types/domain';
export type { User } from '../types/domain';
export const useAppStore = defineStore('application', {
  state: () => ({
    env: 'cloud1-d9gniyjzh4e2ffb1c',
    user: null as User | null,
    session: null as Session | null,
    isAdmin: false,
    isOrganizer: false,
    editingTeamId: null as string | null,
    republishTeam: null as TeamDraft | null,
    prefillGame: null as (Pick<Game, 'name' | 'platform'> & { startAt?: number; weeklyId?: string }) | null,
    lastError: '',
  }),
});
