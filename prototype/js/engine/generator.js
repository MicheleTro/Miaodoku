// Generatore di livelli.
//
// Strategia ("prima la soluzione, poi le regioni"):
//  1. Si sceglie a caso una disposizione valida di N gatti (uno per riga e colonna, mai vicini).
//  2. Ogni gatto è il "seme" di una regione; le regioni crescono a caso fino a coprire la griglia.
//     Così la soluzione scelta è valida per costruzione.
//  3. Riparazione dell'unicità: il risolutore esatto cerca una seconda soluzione; se esiste,
//     si sposta una casella di quella soluzione alternativa in una regione confinante.
//     La soluzione alternativa diventa invalida (una regione ora ha 2 gatti, un'altra 0),
//     quella originale resta valida. Si ripete finché la soluzione è unica.
//  4. Il livello viene valutato dal risolutore "umano" (logic.js / difficulty.js).

import { mulberry32, randInt, shuffle } from './rng.js';
import { findSolutions } from './solver.js';
import { createBoard } from './board.js';
import { rateBoard } from './difficulty.js';

/** Disposizione casuale di n gatti: permutazione con colonne consecutive che differiscono di almeno 2. */
export function randomSolution(n, rng) {
  const pos = new Array(n);
  const used = new Uint8Array(n);
  function rec(r) {
    if (r === n) return true;
    const cols = shuffle(rng, [...Array(n).keys()]);
    for (const c of cols) {
      if (used[c]) continue;
      if (r > 0 && Math.abs(c - pos[r - 1]) <= 1) continue;
      used[c] = 1;
      pos[r] = c;
      if (rec(r + 1)) return true;
      used[c] = 0;
    }
    return false;
  }
  if (!rec(0)) throw new Error(`Nessuna disposizione possibile per n=${n}`);
  return pos.map((c, r) => r * n + c);
}

function neighbors4(n, i) {
  const r = Math.floor(i / n);
  const c = i % n;
  const out = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
}

/**
 * Fa crescere le regioni a partire dai semi.
 * - `weights`: ogni regione ha un "appetito" casuale → regioni di dimensioni diverse.
 * - `compactness` (0..1): alto = regioni a blocchetto, basso = regioni a serpente.
 */
export function growRegions(n, seeds, rng, { compactness = 0.5, sizeVariance = 0.8 } = {}) {
  const size = n * n;
  const regions = new Int8Array(size).fill(-1);
  seeds.forEach((cell, g) => (regions[cell] = g));
  const weights = seeds.map(() => Math.max(0.05, 1 + (rng() * 2 - 1) * sizeVariance));
  let remaining = size - n;

  while (remaining > 0) {
    // Celle di frontiera per ogni regione.
    const frontier = seeds.map(() => []);
    for (let i = 0; i < size; i++) {
      if (regions[i] !== -1) continue;
      for (const j of neighbors4(n, i)) {
        const g = regions[j];
        if (g !== -1 && !frontier[g].includes(i)) frontier[g].push(i);
      }
    }
    // Scegli la regione che cresce (pesata per appetito).
    let total = 0;
    for (let g = 0; g < n; g++) if (frontier[g].length) total += weights[g];
    let x = rng() * total;
    let g = 0;
    for (; g < n; g++) {
      if (!frontier[g].length) continue;
      x -= weights[g];
      if (x <= 0) break;
    }
    if (g >= n) g = frontier.findIndex((f) => f.length);

    // Scegli la cella: con compattezza alta si preferiscono celle con più vicini della stessa regione.
    const cells = frontier[g];
    let best = cells[randInt(rng, cells.length)];
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

/** Celle della regione g non più collegate al suo seme. */
function detachedPart(n, regions, g, seed) {
  const seen = new Set([seed]);
  const stack = [seed];
  while (stack.length) {
    const i = stack.pop();
    for (const j of neighbors4(n, i)) {
      if (seen.has(j) || regions[j] !== g) continue;
      seen.add(j);
      stack.push(j);
    }
  }
  const out = [];
  for (let i = 0; i < n * n; i++) if (regions[i] === g && !seen.has(i)) out.push(i);
  return out;
}

/**
 * Per spostare la casella `cell` in un'altra regione serve che le sia "collegata":
 * se `cell` è interna alla sua regione, si sposta anche il percorso più corto (dentro la
 * regione, senza toccare il seme) fino al bordo con ciascuna regione confinante.
 * Restituisce una mappa regione-destinazione → percorso di celle da spostare.
 */
function pathsToOtherRegions(n, regions, cell, seed) {
  const g = regions[cell];
  const prev = new Map([[cell, -1]]);
  const queue = [cell];
  const result = new Map();
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    for (const j of neighbors4(n, i)) {
      const h = regions[j];
      if (h !== g) {
        if (!result.has(h)) {
          const path = [];
          for (let k = i; k !== -1; k = prev.get(k)) path.push(k);
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

/**
 * Modifica le regioni finché la soluzione è unica. Restituisce il numero di modifiche fatte,
 * oppure -1 se non ci riesce.
 */
export function enforceUniqueness(n, regions, solution, rng, maxIter = 200) {
  const solSet = new Set(solution);
  const seedOf = new Array(n);
  for (const cell of solution) seedOf[regions[cell]] = cell;

  for (let iter = 0; iter < maxIter; iter++) {
    const sols = findSolutions(n, regions, 2);
    if (sols.length === 1) return iter;
    const alt = sols.find((s) => s.some((cell) => !solSet.has(cell)));
    const candidates = shuffle(rng, alt.filter((cell) => !solSet.has(cell)));
    // Valuta alcune modifiche possibili e applica quella che lascia meno soluzioni
    // (discesa "golosa"). Ogni modifica sposta una casella della soluzione alternativa in una
    // regione confinante; se la regione d'origine si spezza, anche il pezzo staccato dal seme
    // passa alla nuova regione, così tutte le regioni restano connesse.
    const options = [];
    for (const cell of candidates) {
      const from = regions[cell];
      for (const [to, path] of pathsToOtherRegions(n, regions, cell, seedOf[from])) options.push({ from, to, path });
    }
    if (!options.length) return -1;
    shuffle(rng, options);
    options.sort((a, b) => a.path.length - b.path.length); // prima le modifiche più piccole
    let best = null;
    for (const o of options.slice(0, 16)) {
      const trial = regions.slice();
      for (const j of o.path) trial[j] = o.to;
      // il pezzo della regione d'origine rimasto staccato dal seme passa anch'esso alla nuova regione
      for (const j of detachedPart(n, trial, o.from, seedOf[o.from])) trial[j] = o.to;
      const count = findSolutions(n, trial, 300).length;
      if (!best || count < best.count) best = { count, trial };
      if (count === 1) break;
    }
    regions.set(best.trial);
  }
  return -1;
}

/**
 * Genera un livello con soluzione unica (senza valutarne la difficoltà).
 * @returns {{n:number, seed:number, regions:number[], solution:number[], repairs:number, attempts:number}}
 */
export function generatePuzzle(n, seed, opts = {}) {
  const rng = mulberry32(seed);
  for (let attempt = 1; attempt <= 50; attempt++) {
    const solution = randomSolution(n, rng);
    const shape = {
      compactness: opts.compactness ?? rng(),
      sizeVariance: opts.sizeVariance ?? 0.4 + rng() * 0.6,
    };
    const regions = growRegions(n, solution, rng, shape);
    const repairs = enforceUniqueness(n, regions, solution, rng);
    if (repairs >= 0) {
      return { n, seed, regions: Array.from(regions), solution, repairs, attempts: attempt, shape };
    }
  }
  throw new Error('Generazione fallita');
}

/**
 * Genera un livello e lo valuta. Se `difficulty` è indicata, riprova con semi successivi
 * finché trova un livello di quella categoria (entro `maxTries`).
 */
export function generateRated(n, seed, { difficulty = null, maxTries = 300, ...opts } = {}) {
  let best = null;
  for (let t = 0; t < maxTries; t++) {
    const s = (seed + t * 7919) >>> 0;
    const p = generatePuzzle(n, s, opts);
    const rating = rateBoard(createBoard(n, p.regions));
    if (!rating.solvable) continue; // serve un ragionamento oltre le tecniche note: scartato
    const level = { ...p, seed: s, rating, tries: t + 1 };
    if (!difficulty || rating.category === difficulty) return level;
    // Ricorda il più vicino alla categoria cercata, come ripiego.
    if (!best || Math.abs(rating.tier - tierOf(difficulty)) < Math.abs(best.rating.tier - tierOf(difficulty))) best = level;
  }
  return best ? { ...best, fallback: true } : null;
}

import { CATEGORIES } from './difficulty.js';
function tierOf(cat) {
  return CATEGORIES.findIndex((c) => c.id === cat);
}
