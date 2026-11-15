/**
 * Generatore di livelli: soluzione casuale → crescita delle regioni dai semi →
 * riparazione dell'unicità (discesa golosa) → valutazione.
 */
import { mulberry32, randInt, shuffle, type Rng } from './rng.js';
import { findSolutions } from './solver.js';
import { createBoard } from './board.js';
import { rateBoard, CATEGORIES, type CategoryId, type Rating } from './difficulty.js';

export function randomSolution(n: number, rng: Rng): number[] {
  const pos = new Array<number>(n).fill(0);
  const used = new Uint8Array(n);
  const rec = (r: number): boolean => {
    if (r === n) return true;
    for (const c of shuffle(rng, [...Array(n).keys()])) {
      if (used[c]) continue;
      if (r > 0 && Math.abs(c - pos[r - 1]!) <= 1) continue;
      used[c] = 1;
      pos[r] = c;
      if (rec(r + 1)) return true;
      used[c] = 0;
    }
    return false;
  };
  if (!rec(0)) throw new Error(`Nessuna disposizione possibile per n=${n}`);
  return pos.map((c, r) => r * n + c);
}

function neighbors4(n: number, i: number): number[] {
  const r = Math.floor(i / n);
  const c = i % n;
  const out: number[] = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
}

export function growRegions(n: number, seeds: number[], rng: Rng, compactness = 0.5, sizeVariance = 0.8): Int8Array {
  const size = n * n;
  const regions = new Int8Array(size).fill(-1);
  seeds.forEach((cell, g) => (regions[cell] = g));
  const weights = seeds.map(() => Math.max(0.05, 1 + (rng() * 2 - 1) * sizeVariance));
  let remaining = size - n;
  while (remaining > 0) {
    const frontier: number[][] = seeds.map(() => []);
    for (let i = 0; i < size; i++) {
      if (regions[i] !== -1) continue;
      for (const j of neighbors4(n, i)) {
        const g = regions[j]!;
        if (g !== -1 && !frontier[g]!.includes(i)) frontier[g]!.push(i);
      }
    }
    let total = 0;
    for (let g = 0; g < n; g++) if (frontier[g]!.length) total += weights[g]!;
    let x = rng() * total;
    let g = 0;
    for (; g < n; g++) {
      if (!frontier[g]!.length) continue;
      x -= weights[g]!;
      if (x <= 0) break;
    }
    if (g >= n) g = frontier.findIndex((f) => f.length);
    const cells = frontier[g]!;
    let best = cells[randInt(rng, cells.length)]!;
    if (rng() < compactness) {
      let bestScore = -1;
      for (const i of shuffle(rng, cells.slice())) {
        const s = neighbors4(n, i).filter((j) => regions[j] === g).length;
        if (s > bestScore) {
          bestScore = s;
          best = i;
        }
      }
    }
    regions[best] = g;
    remaining--;
  }
  return regions;
}

function detachedPart(n: number, regions: Int8Array, g: number, seed: number): number[] {
  const seen = new Set([seed]);
  const stack = [seed];
  while (stack.length) {
    const i = stack.pop()!;
    for (const j of neighbors4(n, i)) {
      if (seen.has(j) || regions[j] !== g) continue;
      seen.add(j);
      stack.push(j);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n * n; i++) if (regions[i] === g && !seen.has(i)) out.push(i);
  return out;
}

function pathsToOtherRegions(n: number, regions: Int8Array, cell: number, seed: number): Map<number, number[]> {
  const g = regions[cell];
  const prev = new Map<number, number>([[cell, -1]]);
  const queue = [cell];
  const result = new Map<number, number[]>();
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]!;
    for (const j of neighbors4(n, i)) {
      const h = regions[j]!;
      if (h !== g) {
        if (!result.has(h)) {
          const path: number[] = [];
          for (let k = i; k !== -1; k = prev.get(k)!) path.push(k);
          result.set(h, path);
        }
      } else if (j !== seed && !prev.has(j)) {
        prev.set(j, i);
        queue.push(j);
      }
    }
  }
  return result;
}

export function enforceUniqueness(n: number, regions: Int8Array, solution: number[], rng: Rng, maxIter = 200): number {
  const solSet = new Set(solution);
  const seedOf = new Array<number>(n);
  for (const cell of solution) seedOf[regions[cell]!] = cell;
  for (let iter = 0; iter < maxIter; iter++) {
    const sols = findSolutions(n, regions, 2);
    if (sols.length === 1) return iter;
    const alt = sols.find((s) => s.some((c) => !solSet.has(c)))!;
    const candidates = shuffle(rng, alt.filter((c) => !solSet.has(c)));
    const options: { from: number; to: number; path: number[] }[] = [];
    for (const cell of candidates) {
      const from = regions[cell]!;
      for (const [to, path] of pathsToOtherRegions(n, regions, cell, seedOf[from]!)) options.push({ from, to, path });
    }
    if (!options.length) return -1;
    shuffle(rng, options);
    options.sort((a, b) => a.path.length - b.path.length);
    let best: { count: number; trial: Int8Array } | null = null;
    for (const o of options.slice(0, 16)) {
      const trial = regions.slice();
      for (const j of o.path) trial[j] = o.to;
      for (const j of detachedPart(n, trial, o.from, seedOf[o.from]!)) trial[j] = o.to;
      const count = findSolutions(n, trial, 300).length;
      if (!best || count < best.count) best = { count, trial };
      if (count === 1) break;
    }
    regions.set(best!.trial);
  }
  return -1;
}

export interface Level {
  n: number;
  seed: number;
  regions: number[];
  solution: number[];
}
export interface RatedLevel extends Level {
  rating: Rating;
}

export function generatePuzzle(n: number, seed: number): Level {
  const rng = mulberry32(seed);
  for (let attempt = 1; attempt <= 50; attempt++) {
    const solution = randomSolution(n, rng);
    const regions = growRegions(n, solution, rng, rng(), 0.4 + rng() * 0.6);
    if (enforceUniqueness(n, regions, solution, rng) >= 0) return { n, seed, regions: Array.from(regions), solution };
  }
  throw new Error('Generazione fallita');
}

/** Il livello del seme dato, valutato (null se il risolutore logico non lo risolve). */
export function levelFromSeed(n: number, seed: number): RatedLevel | null {
  const p = generatePuzzle(n, seed);
  const rating = rateBoard(createBoard(n, p.regions));
  return rating ? { ...p, rating } : null;
}

/**
 * Cerca, a partire da `seed`, il primo seme che produce un livello della categoria voluta.
 * Restituisce il livello e il seme trovato (riproducibile con levelFromSeed).
 */
export function generateRated(n: number, seed: number, difficulty: CategoryId | null = null, maxTries = 400): RatedLevel {
  let best: RatedLevel | null = null;
  const want = difficulty ? CATEGORIES.findIndex((c) => c.id === difficulty) : -1;
  for (let t = 0; t < maxTries; t++) {
    const s = (seed + t * 7919) >>> 0;
    const lv = levelFromSeed(n, s);
    if (!lv) continue;
    if (!difficulty || lv.rating.category === difficulty) return lv;
    if (!best || Math.abs(lv.rating.tier - want) < Math.abs(best.rating.tier - want)) best = lv;
  }
  if (!best) throw new Error('Nessun livello trovato');
  return best;
}
