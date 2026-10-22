import { platform } from '../platform/host';
import { findGame, GAME_CATALOG } from './games';
const KEY = 'recent-games-v1';
export function recentGames(): string[] {
  try {
    const value = platform.getStorageSync(KEY);
    return Array.isArray(value)
      ? value.filter((name): name is string => typeof name === 'string').slice(0, 6)
      : [];
  } catch {
    return [];
  }
}
export function rememberGame(name: string) {
  const normalized = name.trim();
  if (!normalized) return;
  try {
    platform.setStorageSync(
      KEY,
      [normalized, ...recentGames().filter((item) => item !== normalized)].slice(0, 6),
    );
  } catch {
    /* Storage is optional. */
  }
}
export function gameSuggestions(keyword: string) {
  const names = [...new Set([...recentGames(), ...GAME_CATALOG.map((game) => game.name)])];
  const match = findGame(keyword);
  const key = keyword.trim().toLowerCase();
  return names.filter((name) => !key || name.toLowerCase().includes(key) || name === match?.name).slice(0, 8);
}
