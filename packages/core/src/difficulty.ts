/**
 * Stima della difficoltà dal percorso del risolutore logico.
 * Categoria = tecnica più difficile necessaria. Punteggio = Σ peso × (1 + 1/opzioni).
 */
import type { Board } from './board.js';
import { TECHNIQUES, TIER, solveLogically, type TechniqueId } from './logic.js';

export const CATEGORIES = [
  { id: 'facile', name: 'Facile', maxTier: TIER.confine1 },
  { id: 'medio', name: 'Medio', maxTier: TIER.attack },
  { id: 'difficile', name: 'Difficile', maxTier: TIER.confine2 },
  { id: 'esperto', name: 'Esperto', maxTier: TIER.confine4 },
  { id: 'diabolico', name: 'Diabolico', maxTier: TIER.contradiction },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]['id'];
export const isCategory = (x: unknown): x is CategoryId => CATEGORIES.some((c) => c.id === x);

export interface Rating {
  category: CategoryId;
  categoryName: string;
  tier: number;
  hardestTechnique: TechniqueId;
  score: number;
  steps: number;
  bottlenecks: number;
  counts: Record<TechniqueId, number>;
}

export function categoryForTier(tier: number): (typeof CATEGORIES)[number] & { tier: number } {
  const idx = CATEGORIES.findIndex((c) => tier <= c.maxTier);
  return { ...CATEGORIES[idx]!, tier: idx };
}

export function rateBoard(board: Board): Rating | null {
  const res = solveLogically(board);
  if (!res.solved) return null;
  const counts = Object.fromEntries(TECHNIQUES.map((t) => [t.id, 0])) as Record<TechniqueId, number>;
  let maxTier = 0;
  let score = 0;
  let bottlenecks = 0;
  for (const s of res.steps) {
    const t = TECHNIQUES[s.tier]!;
    counts[t.id]++;
    maxTier = Math.max(maxTier, s.tier);
    score += t.weight * (1 + 1 / s.options);
    if (s.tier >= TIER.attack && s.options === 1) bottlenecks++;
  }
  const cat = categoryForTier(maxTier);
  return {
    category: cat.id,
    categoryName: cat.name,
    tier: cat.tier,
    hardestTechnique: TECHNIQUES[maxTier]!.id,
    score: Math.round(score * 10) / 10,
    steps: res.steps.length,
    bottlenecks,
    counts,
  };
}
