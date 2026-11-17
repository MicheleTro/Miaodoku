/**
 * Il Percorso: una sequenza di quadri uguale per tutti. Griglia (da 8×8 a 12×12), difficoltà e seme
 * di ogni quadro dipendono solo dal suo numero. Prima un avvio graduale, poi a ondate: 6–7 quadri
 * misti e uno difficile.
 */
import { CATEGORIES, type CategoryId, type Rating } from './difficulty.js';
import { levelFromSeed, type RatedLevel } from './generator.js';
import { hashString, mulberry32, randInt, type Rng } from './rng.js';

export const MIN_SIZE = 8;
export const MAX_SIZE = 12;
export const SIZES = [8, 9, 10, 11, 12] as const;

/** Si mostra «Difficile» solo per Esperto e Diabolico; le altre categorie non hanno etichetta. */
export const HARD_CATEGORIES: readonly CategoryId[] = ['esperto', 'diabolico'];
export const isHard = (category: CategoryId): boolean => HARD_CATEGORIES.includes(category);

/** Cosa si chiede al generatore: una categoria precisa, oppure «normale» (non difficile) o «difficile». */
export type Want = CategoryId | 'normale' | 'difficile+';
export const WANTS: readonly Want[] = [...CATEGORIES.map((c) => c.id), 'normale', 'difficile+'];
export const isWant = (x: unknown): x is Want => WANTS.includes(x as Want);

export function matchesWant(rating: Pick<Rating, 'category'>, want: Want): boolean {
  if (want === 'difficile+') return isHard(rating.category);
  if (want === 'normale') return !isHard(rating.category);
  return rating.category === want;
}

/**
 * Cerca, a partire da `seed`, il primo seme che produce un livello come richiesto.
 * Deterministico: lo stesso (n, seed, want) dà sempre lo stesso livello.
 * Se non lo trova entro `maxTries`, restituisce il più vicino (`fallback`).
 */
export function generateWanted(n: number, seed: number, want: Want, maxTries = 600): RatedLevel & { fallback?: true } {
  const target = want === 'difficile+' ? 3 : want === 'normale' ? 1 : CATEGORIES.findIndex((c) => c.id === want);
  let best: RatedLevel | null = null;
  for (let t = 0; t < maxTries; t++) {
    const lv = levelFromSeed(n, (seed + t * 7919) >>> 0);
    if (!lv) continue;
    if (matchesWant(lv.rating, want)) return lv;
    if (!best || Math.abs(lv.rating.tier - target) < Math.abs(best.rating.tier - target)) best = lv;
  }
  if (!best) throw new Error('Nessun livello trovato');
  return { ...best, fallback: true };
}

export interface PathStep {
  /** numero del quadro, da 1 */
  k: number;
  n: number;
  want: Want;
  /** seme di partenza della ricerca (il seme del livello è quello trovato da generateWanted) */
  startSeed: number;
}

/** I primi quadri: difficoltà che sale piano, fino al primo difficile. */
const INTRO: [number, Want][] = [
  [8, 'facile'], [8, 'facile'], [8, 'medio'], [9, 'facile'], [8, 'medio'],
  [9, 'medio'], [10, 'medio'], [9, 'difficile'], [10, 'difficile'], [8, 'difficile+'],
];

/** Griglia più grande ammessa al quadro k: il 12×12 arriva con l'esperienza. */
export const maxSizeAt = (k: number): number => (k <= 25 ? 10 : k <= 45 ? 11 : MAX_SIZE);

const pathRng = (label: string): Rng => mulberry32(hashString(`bradoku-percorso:${label}`));

/** Lunghezza dell'ondata c (0, 1, …): 6 o 7 quadri misti più quello difficile. */
const waveLength = (c: number): number => 7 + randInt(pathRng(`onda-${c}`), 2);

export function pathStep(k: number): PathStep {
  if (!Number.isInteger(k) || k < 1) throw new Error('Quadro non valido');
  const startSeed = hashString(`bradoku-percorso:quadro-${k}`);
  if (k <= INTRO.length) {
    const [n, want] = INTRO[k - 1]!;
    return { k, n, want, startSeed };
  }
  // posizione nell'ondata
  let first = INTRO.length + 1;
  let c = 0;
  while (first + waveLength(c) <= k) first += waveLength(c++);
  const last = first + waveLength(c) - 1;
  const rng = pathRng(`quadro-${k}`);
  const n = MIN_SIZE + randInt(rng, maxSizeAt(k) - MIN_SIZE + 1);
  if (k === last) return { k, n, want: 'difficile+', startSeed };
  const r = rng();
  const want: Want = r < 0.25 ? 'facile' : r < 0.65 ? 'medio' : 'difficile';
  return { k, n, want, startSeed };
}

/** Il livello del quadro k (può richiedere qualche secondo per i 12×12 difficili). */
export function pathLevel(k: number): RatedLevel {
  const s = pathStep(k);
  return generateWanted(s.n, s.startSeed, s.want);
}
