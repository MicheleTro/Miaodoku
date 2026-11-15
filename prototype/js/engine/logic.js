// Risolutore "umano": risolve il livello solo con deduzioni che una persona può fare,
// in ordine di difficoltà. È il cuore sia dei suggerimenti sia della stima della difficoltà.
//
// Stato: per ogni cella UNKNOWN (libera), CROSS (esclusa) o CAT (gatto).
//
// Tecniche (dalla più facile alla più difficile):
//  1. single      Ultima casella: una riga/colonna/regione ha una sola casella libera → gatto.
//  2. confine1    Allineamento: le caselle libere di un'unità stanno tutte in un'altra unità
//                 (es. regione tutta in una riga) → il resto di quella riga va escluso.
//  3. attack      Vicinato: un gatto in X escluderebbe tutte le caselle libere di un'altra unità
//                 → X va esclusa.
//  4. confine2    Coppia: 2 unità (es. 2 regioni) con caselle libere tutte dentro 2 righe
//                 → il resto di quelle 2 righe va escluso.
//  5. confine3    Terna (come sopra con 3 unità).
//  6. confine4    Quaterna o più (4+ unità).
//  7. contradiction  Ipotesi: provando un gatto in X e applicando solo le tecniche 1–2
//                 si arriva a un'unità senza caselle libere → X va esclusa.

import { UNKNOWN, CROSS, CAT } from './board.js';

export const TECHNIQUES = [
  { id: 'single', name: 'Ultima casella', weight: 1 },
  { id: 'confine1', name: 'Allineamento', weight: 2 },
  { id: 'attack', name: 'Vicinato', weight: 3 },
  { id: 'confine2', name: 'Coppia', weight: 6 },
  { id: 'confine3', name: 'Terna', weight: 10 },
  { id: 'confine4', name: 'Quaterna+', weight: 14 },
  { id: 'contradiction', name: 'Ipotesi', weight: 20 },
];
export const TIER = Object.fromEntries(TECHNIQUES.map((t, i) => [t.id, i]));

// ---------------------------------------------------------------- stato

export function emptyState(board) {
  return new Uint8Array(board.size);
}

/** Informazioni per unità: caselle libere e numero di gatti. */
export function unitInfo(board, st) {
  return board.units.map((u) => {
    const cand = [];
    let cats = 0;
    for (const i of u.cells) {
      if (st[i] === UNKNOWN) cand.push(i);
      else if (st[i] === CAT) cats++;
    }
    return { cand, cats };
  });
}

/** Mette un gatto ed esclude tutte le caselle che "vede". Restituisce le caselle escluse. */
export function placeCat(board, st, i) {
  st[i] = CAT;
  const elim = [];
  for (const j of board.sees[i]) {
    if (st[j] === UNKNOWN) {
      st[j] = CROSS;
      elim.push(j);
    }
  }
  return elim;
}

export function applyDeduction(board, st, d) {
  if (d.place !== undefined) placeCat(board, st, d.place);
  for (const i of d.eliminate) if (st[i] === UNKNOWN) st[i] = CROSS;
}

/** Restituisce l'unità in contraddizione (senza gatti né caselle libere, o con 2+ gatti), oppure -1. */
export function findContradiction(board, st, info = unitInfo(board, st)) {
  for (let u = 0; u < info.length; u++) {
    if (info[u].cats > 1) return u;
    if (info[u].cats === 0 && info[u].cand.length === 0) return u;
  }
  for (let i = 0; i < board.size; i++) {
    if (st[i] !== CAT) continue;
    for (const j of board.neigh8[i]) if (st[j] === CAT) return board.cellUnits[i][0];
  }
  return -1;
}

export function isSolved(board, st) {
  let cats = 0;
  for (let i = 0; i < board.size; i++) if (st[i] === CAT) cats++;
  return cats === board.n && findContradiction(board, st) === -1;
}

// ---------------------------------------------------------------- tecniche

function* findSingles(board, st, info) {
  const seen = new Set();
  for (let u = 0; u < info.length; u++) {
    const { cand, cats } = info[u];
    if (cats === 0 && cand.length === 1 && !seen.has(cand[0])) {
      seen.add(cand[0]);
      yield { tech: 'single', place: cand[0], eliminate: [], units: [u], focus: [cand[0]] };
    }
  }
}

const PAIRS = [
  ['region', 'row'],
  ['region', 'col'],
  ['row', 'region'],
  ['col', 'region'],
  ['row', 'col'],
  ['col', 'row'],
];

function unitIdOf(board, type, index) {
  const { n } = board;
  return type === 'row' ? index : type === 'col' ? n + index : 2 * n + index;
}
function typeIndexOfCell(board, type, i) {
  return type === 'row' ? board.row(i) : type === 'col' ? board.col(i) : board.regions[i];
}

function* combinations(arr, k, start = 0, acc = []) {
  if (acc.length === k) {
    yield acc.slice();
    return;
  }
  for (let i = start; i <= arr.length - (k - acc.length); i++) {
    acc.push(arr[i]);
    yield* combinations(arr, k, i + 1, acc);
    acc.pop();
  }
}

/**
 * Confinamento di ordine k: k unità di tipo A le cui caselle libere stanno tutte
 * in esattamente k unità di tipo B. Quei k gatti "occupano" le k unità B,
 * quindi tutte le altre caselle libere delle unità B vanno escluse.
 */
function* findConfinements(board, st, info, k, kMax = k) {
  const { n } = board;
  for (const [A, B] of PAIRS) {
    // Unità A non risolte, con l'insieme delle unità B toccate.
    const open = [];
    for (let idx = 0; idx < n; idx++) {
      const u = unitIdOf(board, A, idx);
      if (info[u].cats > 0 || info[u].cand.length === 0) continue;
      const span = new Set(info[u].cand.map((i) => typeIndexOfCell(board, B, i)));
      if (span.size <= kMax) open.push({ u, span });
    }
    for (let size = k; size <= kMax; size++) {
      for (const combo of combinations(open, size)) {
        const union = new Set();
        for (const { span } of combo) for (const b of span) union.add(b);
        if (union.size !== size) continue;
        const aUnits = new Set(combo.map((c) => c.u));
        const inA = (i) => board.cellUnits[i].some((u) => aUnits.has(u));
        const bUnits = [...union].map((b) => unitIdOf(board, B, b));
        const eliminate = [];
        for (const bu of bUnits) for (const i of info[bu].cand) if (!inA(i)) eliminate.push(i);
        if (!eliminate.length) continue;
        yield {
          tech: size === 1 ? 'confine1' : size === 2 ? 'confine2' : size === 3 ? 'confine3' : 'confine4',
          k: size,
          eliminate,
          units: [...aUnits],
          targets: bUnits,
          focus: [...aUnits].flatMap((u) => info[u].cand),
        };
      }
    }
  }
}

/** Vicinato: un gatto in i svuoterebbe un'altra unità → i va esclusa. */
function* findAttacks(board, st, info) {
  for (let i = 0; i < board.size; i++) {
    if (st[i] !== UNKNOWN) continue;
    const seen = new Set(board.sees[i]);
    const own = board.cellUnits[i];
    for (let u = 0; u < info.length; u++) {
      if (own.includes(u) || info[u].cats > 0) continue;
      const { cand } = info[u];
      if (cand.length > 0 && cand.every((j) => seen.has(j))) {
        yield { tech: 'attack', eliminate: [i], units: [u], cell: i, focus: cand };
        break;
      }
    }
  }
}

/** Propaga con le tecniche base (1 e 2). Restituisce {contradiction: unit|-1, steps}. */
function propagateSimple(board, st, maxSteps = 60) {
  for (let steps = 0; steps <= maxSteps; steps++) {
    const info = unitInfo(board, st);
    const bad = findContradiction(board, st, info);
    if (bad !== -1) return { contradiction: bad, steps };
    const d = findSingles(board, st, info).next().value ?? findConfinements(board, st, info, 1).next().value;
    if (!d) return { contradiction: -1, steps };
    applyDeduction(board, st, d);
  }
  return { contradiction: -1, steps: maxSteps };
}

/** Ipotesi: prova un gatto in ogni casella libera; se porta a contraddizione, la casella va esclusa. */
function* findContradictions(board, st) {
  const found = [];
  for (let i = 0; i < board.size; i++) {
    if (st[i] !== UNKNOWN) continue;
    const copy = st.slice();
    placeCat(board, copy, i);
    const { contradiction, steps } = propagateSimple(board, copy);
    if (contradiction !== -1) {
      found.push({ tech: 'contradiction', eliminate: [i], cell: i, units: [contradiction], chain: steps + 1, focus: [i] });
    }
  }
  found.sort((a, b) => a.chain - b.chain);
  yield* found;
}

/** Tutte le deduzioni disponibili di un certo livello di tecnica. */
export function* deductionsOfTier(board, st, tier, info = unitInfo(board, st)) {
  const { n } = board;
  switch (TECHNIQUES[tier].id) {
    case 'single': yield* findSingles(board, st, info); break;
    case 'confine1': yield* findConfinements(board, st, info, 1); break;
    case 'attack': yield* findAttacks(board, st, info); break;
    case 'confine2': yield* findConfinements(board, st, info, 2); break;
    case 'confine3': yield* findConfinements(board, st, info, 3); break;
    case 'confine4': yield* findConfinements(board, st, info, 4, Math.floor(n / 2)); break;
    case 'contradiction': yield* findContradictions(board, st); break;
  }
}

/** La prossima deduzione più semplice disponibile (o null). */
export function nextDeduction(board, st, { maxTier = TECHNIQUES.length - 1 } = {}) {
  const info = unitInfo(board, st);
  for (let t = 0; t <= maxTier; t++) {
    const d = deductionsOfTier(board, st, t, info).next().value;
    if (d) return { ...d, tier: t };
  }
  return null;
}

/**
 * Risolve il livello applicando sempre la tecnica più semplice disponibile.
 * Per ogni passo registra anche quante deduzioni alternative di quel livello c'erano
 * (meno alternative = passo più difficile da "vedere").
 */
export function solveLogically(board, st = emptyState(board), { maxTier = TECHNIQUES.length - 1, countOptions = true } = {}) {
  st = st.slice();
  const steps = [];
  for (let guard = 0; guard < board.size * 4; guard++) {
    if (isSolved(board, st)) return { solved: true, steps, state: st };
    const info = unitInfo(board, st);
    if (findContradiction(board, st, info) !== -1) return { solved: false, contradiction: true, steps, state: st };
    let applied = false;
    for (let t = 0; t <= maxTier && !applied; t++) {
      const gen = deductionsOfTier(board, st, t, info);
      const first = gen.next().value;
      if (!first) continue;
      let options = 1;
      if (countOptions) for (const _ of gen) if (++options >= 20) break;
      steps.push({ ...first, tier: t, options });
      applyDeduction(board, st, first);
      applied = true;
    }
    if (!applied) return { solved: false, stuck: true, steps, state: st };
  }
  return { solved: false, steps, state: st };
}
