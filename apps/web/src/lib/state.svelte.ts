import { api, storage, type Profile, type GameStart, type FinishResult } from './api.js';
import { logout as leave } from './auth.svelte.js';

export type Screen = 'loading' | 'login' | 'home' | 'play' | 'result' | 'challenges' | 'profile';

export const ui = $state({
  screen: 'loading' as Screen,
  profile: null as Profile | null,
  game: null as GameStart | null,
  result: null as FinishResult | null,
  /** si sta preparando il prossimo livello del Percorso */
  pathBusy: false,
  challengeFrom: null as { gameId?: number } | null,
  toast: '' as string,
});

const CURRENT_GAME = 'bradoku.currentGame';
export const currentGameId = (): number | null => Number(storage.get(CURRENT_GAME)) || null;
export const setCurrentGame = (id: number | null) => storage.set(CURRENT_GAME, id === null ? null : String(id));


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
  setCurrentGame(g.gameId);
  go('play');
}

/** Gioca il prossimo livello del Percorso (o riprende quello in corso). */
export async function playPath(): Promise<void> {
  if (ui.pathBusy) return;
  ui.pathBusy = true;
  try {
    startPlaying(await api<GameStart>('POST', '/path/play'));
  } catch (e) {
    toast((e as Error).message);
  } finally {
    ui.pathBusy = false;
  }
}

/** Esce dal gioco e torna al portale whoru. */
export async function logout(): Promise<void> {
  setCurrentGame(null);
  ui.profile = null;
  await leave();
}
