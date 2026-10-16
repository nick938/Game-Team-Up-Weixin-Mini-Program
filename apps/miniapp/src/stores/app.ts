import { defineStore } from 'pinia';
import type { Session } from '../api/client';
export interface User { nickName?: string; avatarUrl?: string; avatarFileID?: string; avatarBase64?: string; bio?: string }
export const useAppStore = defineStore('application', {
  state: () => ({
    env: 'cloud1-d9gniyjzh4e2ffb1c',
    user: null as User | null,
    session: null as Session | null,
    isAdmin: false, isOrganizer: false,
    editingTeamId: null as string | null,
    republishTeam: null as Record<string, unknown> | null,
    prefillGame: null as Record<string, unknown> | string | null,
    lastError: '',
  }),
});
let profileReady: Promise<void> = Promise.resolve();
export function setProfileReady(value: Promise<void>) { profileReady = value; }
export function getApplication() { return { globalData: useAppStore(), get profileReady() { return profileReady; } }; }
