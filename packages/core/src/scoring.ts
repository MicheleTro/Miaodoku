/**
 * Punteggio di una partita:
 *   Punti = round(D × (1 + 0,3·T) × (1 + 0,2·E) × A)
 * D = punteggio di difficoltà dell'engine, T = bonus tempo (0..1), E = partita pulita (0/1),
 * A = suggerimenti (1,5 senza; poi −0,25 ciascuno, minimo 0,4).
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
}
export interface ScoreBreakdown {
  base: number;
  parMs: number;
  timeFactor: number;
  timeMult: number;
  cleanMult: number;
  hintMult: number;
  points: number;
}

export const hintMultiplier = (hints: number): number => (hints <= 0 ? 1.5 : Math.max(0.4, 1.5 - 0.25 * hints));

export function computePoints({ rating, durationMs, hints, clean }: ScoreInput): ScoreBreakdown {
  const parMs = parTimeMs(rating);
  const timeFactor = Math.min(1, Math.max(0, (parMs - durationMs) / (parMs / 2)));
  const timeMult = 1 + 0.3 * timeFactor;
  const cleanMult = clean ? 1.2 : 1;
  const hintMult = hintMultiplier(hints);
  const base = rating.score;
  const points = Math.max(1, Math.round(base * timeMult * cleanMult * hintMult));
  return { base, parMs, timeFactor: Math.round(timeFactor * 100) / 100, timeMult, cleanMult, hintMult, points };
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
