/**
 * Punteggio di una partita:
 *   Velocità V = round(D × T × R)        R = 0,5, oppure 1 nelle partite difficili (conta doppio)
 *   Punti      = round((D + V) × (1 + 0,2·E) × A)
 * D = punteggio di difficoltà dell'engine, T = rapidità (0 al tempo di riferimento, 1 a metà o meno),
 * E = partita pulita (0/1), A = suggerimenti (1,5 senza; poi −0,25 ciascuno, minimo 0,4).
 */
import type { Rating } from './difficulty.js';

export const MS_PER_STEP = 15_000;

/** Tempo di riferimento: 15 secondi per passo del risolutore, almeno 45 secondi. */
export const parTimeMs = (rating: Pick<Rating, 'steps'>): number => Math.max(45_000, rating.steps * MS_PER_STEP);

export interface ScoreInput {
  rating: Pick<Rating, 'score' | 'steps'>;
  durationMs: number;
  /** suggerimenti con penalità (i Lumi non contano) */
  hints: number;
  /** nessun bradipo messo in una casella sbagliata */
  clean: boolean;
  /** partita difficile (Esperto o Diabolico): la velocità vale doppio */
  hard?: boolean;
}
export interface ScoreBreakdown {
  base: number;
  parMs: number;
  /** rapidità 0..1 */
  timeFactor: number;
  /** punti guadagnati con la velocità */
  speedPoints: number;
  /** 0,5 di norma, 1 nelle partite difficili */
  speedRate: number;
  hard: boolean;
  cleanMult: number;
  hintMult: number;
  points: number;
}

export const hintMultiplier = (hints: number): number => (hints <= 0 ? 1.5 : Math.max(0.4, 1.5 - 0.25 * hints));

export const SPEED_RATE = 0.5;

export function computePoints({ rating, durationMs, hints, clean, hard = false }: ScoreInput): ScoreBreakdown {
  const parMs = parTimeMs(rating);
  const timeFactor = Math.min(1, Math.max(0, (parMs - durationMs) / (parMs / 2)));
  const speedRate = hard ? SPEED_RATE * 2 : SPEED_RATE;
  const base = rating.score;
  const speedPoints = Math.round(base * timeFactor * speedRate);
  const cleanMult = clean ? 1.2 : 1;
  const hintMult = hintMultiplier(hints);
  const points = Math.max(1, Math.round((base + speedPoints) * cleanMult * hintMult));
  return { base, parMs, timeFactor: Math.round(timeFactor * 100) / 100, speedPoints, speedRate, hard, cleanMult, hintMult, points };
}

/** Confronto tra due risultati di sfida: >0 se vince a, <0 se vince b, 0 pari. */
export function compareResults(
  a: { points: number; hints: number; durationMs: number },
  b: { points: number; hints: number; durationMs: number },
): number {
  if (a.points !== b.points) return a.points - b.points;
  if (a.hints !== b.hints) return b.hints - a.hints;
  return b.durationMs - a.durationMs;
}
