import type { CategoryId, TechniqueId } from '@bradoku/core';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const TOKEN_KEY = 'bradoku.token';

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

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = storage.get(TOKEN_KEY);
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'Server non raggiungibile. Controlla la connessione e riprova.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? 'Qualcosa è andato storto');
  return data as T;
}

export const setToken = (t: string | null) => storage.set(TOKEN_KEY, t);
export const hasToken = () => !!storage.get(TOKEN_KEY);

// ---- tipi delle risposte

export interface Profile {
  id: number;
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
  stats: { solved: number; noHintSolved: number; challengesPlayed: number; challengesWon: number; winStreak: number; cycles: number };
  challengesToPlay: number;
}

export interface PublicLevel {
  n: number;
  seed: number;
  regions: number[];
  rating: { category: CategoryId; categoryName: string; score: number; steps: number; counts: Record<TechniqueId, number>; hardestTechnique: TechniqueId };
  parMs: number;
}

export interface GameStart {
  gameId: number;
  challengeId: number | null;
  startedAt: string;
  serverNow: string;
  level: PublicLevel;
  introduce: TechniqueId | null;
  lumiAvailable: number;
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
  iCreated: boolean;
  n: number;
  difficulty: CategoryId;
  categoryName: string;
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
  score: { base: number; parMs: number; timeFactor: number; timeMult: number; cleanMult: number; hintMult: number; points: number; durationMs: number };
  xp: { before: number; after: number; levelBefore: number; levelAfter: number; xpInto: number; xpNeed: number; rank: string };
  streak: { value: number; firstToday: boolean; lumiGained: number };
  lumi: number;
  newMedals: string[];
  newAccessories: string[];
  challenge: ChallengeView | null;
  level: { n: number; seed: number; category: CategoryId; categoryName: string };
  gameId: number;
}

export interface Friend {
  username: string;
  wins: number;
  losses: number;
  draws: number;
}
