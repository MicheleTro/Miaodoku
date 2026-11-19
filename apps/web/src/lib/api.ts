import type { CategoryId, TechniqueId } from '@bradoku/core';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null): void {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* storage non disponibile */
    }
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Chiamata all'API. L'identità viaggia nel cookie di sessione (HttpOnly, impostato dopo l'accesso dal
 * portale whoru): nessun token in JavaScript. Su 401 si torna al portale, che riporta qui dopo l'accesso.
 */
export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      credentials: BASE ? 'include' : 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Server non raggiungibile. Controlla la connessione e riprova.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && (data as { loginUrl?: string }).loginUrl) {
    window.location.assign((data as { loginUrl: string }).loginUrl);
  }
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? 'Qualcosa è andato storto');
  return data as T;
}

/**
 * POST che sopravvive alla chiusura della pagina (keepalive): serve per mettere in pausa la partita
 * quando si esce o l'app va in secondo piano. Nessun redirect al portale.
 */
export function postKeepalive(path: string): Promise<Response> {
  return fetch(`${BASE}/api${path}`, { method: 'POST', credentials: BASE ? 'include' : 'same-origin', keepalive: true });
}

// ---- tipi delle risposte

export interface Profile {
  id: string;
  username: string;
  xp: number;
  level: number;
  xpInto: number;
  xpNeed: number;
  rank: string;
  streak: number;
  playedToday: boolean;
  lumi: number;
  medals: string[];
  techniques: Record<string, number>;
  seenTechniques: string[];
  accessory: string;
  accessories: string[];
  /** livelli del Percorso completati */
  pathDone: number;
  stats: { solved: number; noHintSolved: number; challengesPlayed: number; challengesWon: number; winStreak: number; cycles: number };
  challengesToPlay: number;
}

export interface PublicLevel {
  n: number;
  seed: number;
  regions: number[];
  rating: { category: CategoryId; categoryName: string; hard: boolean; score: number; steps: number; counts: Record<TechniqueId, number>; hardestTechnique: TechniqueId };
  parMs: number;
}

export interface GameStart {
  gameId: number;
  challengeId: number | null;
  /** numero del livello del Percorso (null per le sfide) */
  pathK: number | null;
  startedAt: string;
  serverNow: string;
  /** tempo di gioco già trascorso (nel Percorso, pause escluse) */
  elapsedMs: number;
  paused: boolean;
  level: PublicLevel;
  lumiAvailable: number;
}

export interface PathInfo {
  done: number;
  next: { k: number; n: number; seed: number; hard: boolean };
  playingGameId: number | null;
}

export interface ChallengeResult {
  played: boolean;
  points?: number;
  hints?: number;
  durationMs?: number;
  clean?: boolean;
}

export interface ChallengeView {
  id: number;
  opponent: string;
  opponentId: string;
  iCreated: boolean;
  n: number;
  difficulty: string;
  categoryName: string;
  hard: boolean;
  seed: number;
  techniques: Record<TechniqueId, number>;
  status: 'open' | 'completed';
  myTurn: boolean;
  me: ChallengeResult;
  them: ChallengeResult;
  outcome: 'win' | 'loss' | 'draw' | null;
  rematchOf: number | null;
  createdAt: string;
}

export interface FinishResult {
  score: {
    base: number; parMs: number; timeFactor: number; speedPoints: number; speedRate: number; hard: boolean;
    cleanMult: number; hintMult: number; points: number; durationMs: number;
  };
  xp: { before: number; after: number; levelBefore: number; levelAfter: number; xpInto: number; xpNeed: number; rank: string };
  streak: { value: number; firstToday: boolean; lumiGained: number };
  lumi: number;
  newMedals: string[];
  newAccessories: string[];
  challenge: ChallengeView | null;
  level: { n: number; seed: number; category: CategoryId; categoryName: string; hard: boolean };
  path: { k: number; advanced: boolean; done: number } | null;
  gameId: number;
}

/** Amico del portale whoru, con il bilancio delle sfide giocate insieme. */
export interface Friend {
  id: string;
  username: string;
  wins: number;
  losses: number;
  draws: number;
}
