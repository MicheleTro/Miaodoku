// Stima della difficoltà.
//
// Il livello viene risolto dal risolutore "umano" (logic.js), che usa sempre la tecnica
// più semplice disponibile. Dal percorso di soluzione ricaviamo:
//
//  - CATEGORIA: dipende dalla tecnica più difficile che è stata NECESSARIA almeno una volta
//    (come nei classificatori di Sudoku): se serve una "Coppia", il livello non è risolvibile
//    da chi conosce solo le tecniche più semplici.
//
//  - PUNTEGGIO (per ordinare i livelli dentro una categoria):
//        somma su ogni passo di   peso(tecnica) × scarsità
//    dove scarsità = 1 + 1/opzioni: se in quel momento esisteva una sola deduzione possibile
//    di quel livello, il passo è più difficile da trovare (×2) rispetto a quando ce n'erano tante (≈×1).
//
//  - COLLI DI BOTTIGLIA: passi in cui non c'era nessuna deduzione facile (tecnica ≥ Vicinato)
//    e una sola opzione. Sono i momenti in cui il giocatore "si blocca".
//
// I pesi e le soglie sono parametri da tarare con dati reali (tempi dei giocatori).

import { TECHNIQUES, TIER, solveLogically } from './logic.js';

export const CATEGORIES = [
  { id: 'facile', name: 'Facile', maxTier: TIER.confine1 },
  { id: 'medio', name: 'Medio', maxTier: TIER.attack },
  { id: 'difficile', name: 'Difficile', maxTier: TIER.confine2 },
  { id: 'esperto', name: 'Esperto', maxTier: TIER.confine4 },
  { id: 'diabolico', name: 'Diabolico', maxTier: TIER.contradiction },
];

export function categoryForTier(tier) {
  const idx = CATEGORIES.findIndex((c) => tier <= c.maxTier);
  return { ...CATEGORIES[idx], tier: idx };
}

export function rateBoard(board) {
  const res = solveLogically(board);
  if (!res.solved) {
    return { solvable: false, reason: res.stuck ? 'Serve una tecnica non ancora implementata' : 'Contraddizione' };
  }
  const counts = Object.fromEntries(TECHNIQUES.map((t) => [t.id, 0]));
  let maxTier = 0;
  let score = 0;
  let bottlenecks = 0;
  for (const s of res.steps) {
    counts[TECHNIQUES[s.tier].id]++;
    maxTier = Math.max(maxTier, s.tier);
    score += TECHNIQUES[s.tier].weight * (1 + 1 / s.options);
    if (s.tier >= TIER.attack && s.options === 1) bottlenecks++;
  }
  const cat = categoryForTier(maxTier);
  return {
    solvable: true,
    category: cat.id,
    categoryName: cat.name,
    tier: cat.tier,
    hardestTechnique: TECHNIQUES[maxTier].id,
    score: Math.round(score * 10) / 10,
    steps: res.steps.length,
    bottlenecks,
    counts,
  };
}
