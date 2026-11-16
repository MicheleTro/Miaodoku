import { api, storage, type Profile, type GameStart, type FinishResult } from './api.js';
import { logout as leave } from './auth.svelte.js';

export type Screen = 'loading' | 'login' | 'home' | 'play' | 'result' | 'challenges' | 'profile';

export const ui = $state({
  screen: 'loading' as Screen,
  profile: null as Profile | null,
  game: null as GameStart | null,
  result: null as FinishResult | null,
  newGameOpen: false,
  challengeFrom: null as { gameId?: number } | null,
  toast: '' as string,
});

const CURRENT_GAME = 'bradoku.currentGame';
export const currentGameId = (): number | null => Number(storage.get(CURRENT_GAME)) || null;
export const setCurrentGame = (id: number | null) => storage.set(CURRENT_GAME, id === null ? null : String(id));

export const LAST_SETUP = 'bradoku.lastSetup';

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string): void {
  ui.toast = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (ui.toast = ''), 2600);
}

export function go(screen: Screen): void {
  ui.screen = screen;
  window.scrollTo({ top: 0 });
}

export async function refreshProfile(): Promise<void> {
  ui.profile = await api<Profile>('GET', '/me');
}

export function startPlaying(g: GameStart): void {
  ui.game = g;
  ui.newGameOpen = false;
  setCurrentGame(g.gameId);
  go('play');
}

/** Esce dal gioco e torna al portale whoru. */
export async function logout(): Promise<void> {
  setCurrentGame(null);
  ui.profile = null;
  await leave();
}
