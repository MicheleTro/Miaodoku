/**
 * Risolutore "umano": solo deduzioni che una persona può fare, in ordine di difficoltà.
 * Base di suggerimenti, valutazione della difficoltà e medaglie delle tecniche.
 */
import { type Board, UNKNOWN, CROSS, PIECE, rowOf, colOf, type UnitType } from './board.js';

export const TECHNIQUES = [
  { id: 'single', name: 'Ultima casella', weight: 1, short: 'Una riga, colonna o regione ha una sola casella libera: il bradipo va lì.' },
  { id: 'confine1', name: 'Allineamento', weight: 2, short: 'Le caselle libere di una regione stanno tutte in una riga (o colonna): il resto di quella riga si esclude.' },
  { id: 'attack', name: 'Vicinato', weight: 3, short: 'Un bradipo in quella casella lascerebbe un\'altra regione senza posto: quindi lì non può stare.' },
  { id: 'confine2', name: 'Coppia', weight: 6, short: 'Due regioni chiuse dentro due righe: quelle righe sono "prenotate", il resto si esclude.' },
  { id: 'confine3', name: 'Terna', weight: 10, short: 'Come la Coppia, con tre regioni chiuse dentro tre righe o colonne.' },
  { id: 'confine4', name: 'Quaterna', weight: 14, short: 'Come la Terna, con quattro o più regioni.' },
  { id: 'contradiction', name: 'Ipotesi', weight: 20, short: 'Provi un bradipo in una casella: seguendo le deduzioni semplici si arriva a un assurdo, quindi lì non va.' },
] as const;
export type TechniqueId = (typeof TECHNIQUES)[number]['id'];
export const TIER: Record<TechniqueId, number> = Object.fromEntries(TECHNIQUES.map((t, i) => [t.id, i])) as Record<TechniqueId, number>;

export interface Deduction {
  tech: TechniqueId;
  tier?: number;
  place?: number;
  eliminate: number[];
  units: number[];
  targets?: number[];
  k?: number;
  cell?: number;
  chain?: number;
  focus: number[];
}
export interface Step extends Deduction {
  tier: number;
  options: number;
}
interface UnitInfo {
  cand: number[];
  pieces: number;
}

export const emptyState = (b: Board): Uint8Array => new Uint8Array(b.size);

export function unitInfo(b: Board, st: Uint8Array): UnitInfo[] {
  return b.units.map((u) => {
    const cand: number[] = [];
    let pieces = 0;
    for (const i of u.cells) {
      if (st[i] === UNKNOWN) cand.push(i);
      else if (st[i] === PIECE) pieces++;
    }
    return { cand, pieces };
  });
}

export function placePiece(b: Board, st: Uint8Array, i: number): void {
  st[i] = PIECE;
  for (const j of b.sees[i]!) if (st[j] === UNKNOWN) st[j] = CROSS;
}

export function applyDeduction(b: Board, st: Uint8Array, d: Deduction): void {
  if (d.place !== undefined) placePiece(b, st, d.place);
  for (const i of d.eliminate) if (st[i] === UNKNOWN) st[i] = CROSS;
}

export function findContradiction(b: Board, st: Uint8Array, info = unitInfo(b, st)): number {
  for (let u = 0; u < info.length; u++) {
    const x = info[u]!;
    if (x.pieces > 1 || (x.pieces === 0 && x.cand.length === 0)) return u;
  }
  for (let i = 0; i < b.size; i++) {
    if (st[i] !== PIECE) continue;
    for (const j of b.neigh8[i]!) if (st[j] === PIECE) return b.cellUnits[i]![0]!;
  }
  return -1;
}

export function isSolved(b: Board, st: Uint8Array): boolean {
  let p = 0;
  for (let i = 0; i < b.size; i++) if (st[i] === PIECE) p++;
  return p === b.n && findContradiction(b, st) === -1;
}

function* singles(_b: Board, _st: Uint8Array, info: UnitInfo[]): Generator<Deduction> {
  const seen = new Set<number>();
  for (let u = 0; u < info.length; u++) {
    const { cand, pieces } = info[u]!;
    const c = cand[0];
    if (pieces === 0 && cand.length === 1 && c !== undefined && !seen.has(c)) {
      seen.add(c);
      yield { tech: 'single', place: c, eliminate: [], units: [u], focus: [c] };
    }
  }
}

const PAIRS: [UnitType, UnitType][] = [
  ['region', 'row'], ['region', 'col'], ['row', 'region'], ['col', 'region'], ['row', 'col'], ['col', 'row'],
];
const unitId = (b: Board, t: UnitType, idx: number): number => (t === 'row' ? idx : t === 'col' ? b.n + idx : 2 * b.n + idx);
const indexOfCell = (b: Board, t: UnitType, i: number): number => (t === 'row' ? rowOf(b, i) : t === 'col' ? colOf(b, i) : b.regions[i]!);

function* combinations<T>(arr: T[], k: number, start = 0, acc: T[] = []): Generator<T[]> {
  if (acc.length === k) {
    yield acc.slice();
    return;
  }
  for (let i = start; i <= arr.length - (k - acc.length); i++) {
    acc.push(arr[i]!);
    yield* combinations(arr, k, i + 1, acc);
    acc.pop();
  }
}

function* confinements(b: Board, _st: Uint8Array, info: UnitInfo[], k: number, kMax = k): Generator<Deduction> {
  for (const [A, B] of PAIRS) {
    const open: { u: number; span: Set<number> }[] = [];
    for (let idx = 0; idx < b.n; idx++) {
      const u = unitId(b, A, idx);
      const x = info[u]!;
      if (x.pieces > 0 || x.cand.length === 0) continue;
      const span = new Set(x.cand.map((i) => indexOfCell(b, B, i)));
      if (span.size <= kMax) open.push({ u, span });
    }
    for (let size = k; size <= kMax; size++) {
      for (const combo of combinations(open, size)) {
        const union = new Set<number>();
        for (const { span } of combo) for (const v of span) union.add(v);
        if (union.size !== size) continue;
        const aUnits = new Set(combo.map((c) => c.u));
        const bUnits = [...union].map((v) => unitId(b, B, v));
        const eliminate: number[] = [];
        for (const bu of bUnits) for (const i of info[bu]!.cand) if (!b.cellUnits[i]!.some((u) => aUnits.has(u))) eliminate.push(i);
        if (!eliminate.length) continue;
        const tech: TechniqueId = size === 1 ? 'confine1' : size === 2 ? 'confine2' : size === 3 ? 'confine3' : 'confine4';
        yield { tech, k: size, eliminate, units: [...aUnits], targets: bUnits, focus: [...aUnits].flatMap((u) => info[u]!.cand) };
      }
    }
  }
}

function* attacks(b: Board, st: Uint8Array, info: UnitInfo[]): Generator<Deduction> {
  for (let i = 0; i < b.size; i++) {
    if (st[i] !== UNKNOWN) continue;
    const seen = new Set(b.sees[i]);
    const own = b.cellUnits[i]!;
    for (let u = 0; u < info.length; u++) {
      const x = info[u]!;
      if (own.includes(u) || x.pieces > 0) continue;
      if (x.cand.length > 0 && x.cand.every((j) => seen.has(j))) {
        yield { tech: 'attack', eliminate: [i], units: [u], cell: i, focus: x.cand };
        break;
      }
    }
  }
}

function propagateSimple(b: Board, st: Uint8Array, maxSteps = 60): { contradiction: number; steps: number } {
  for (let steps = 0; steps <= maxSteps; steps++) {
    const info = unitInfo(b, st);
    const bad = findContradiction(b, st, info);
    if (bad !== -1) return { contradiction: bad, steps };
    const d = singles(b, st, info).next().value ?? confinements(b, st, info, 1).next().value;
    if (!d) return { contradiction: -1, steps };
    applyDeduction(b, st, d);
  }
  return { contradiction: -1, steps: maxSteps };
}

function* contradictions(b: Board, st: Uint8Array): Generator<Deduction> {
  const found: Deduction[] = [];
  for (let i = 0; i < b.size; i++) {
    if (st[i] !== UNKNOWN) continue;
    const copy = st.slice();
    placePiece(b, copy, i);
    const { contradiction, steps } = propagateSimple(b, copy);
    if (contradiction !== -1) found.push({ tech: 'contradiction', eliminate: [i], cell: i, units: [contradiction], chain: steps + 1, focus: [i] });
  }
  found.sort((x, y) => (x.chain ?? 0) - (y.chain ?? 0));
  yield* found;
}

export function* deductionsOfTier(b: Board, st: Uint8Array, tier: number, info = unitInfo(b, st)): Generator<Deduction> {
  switch (TECHNIQUES[tier]?.id) {
    case 'single': yield* singles(b, st, info); break;
    case 'confine1': yield* confinements(b, st, info, 1); break;
    case 'attack': yield* attacks(b, st, info); break;
    case 'confine2': yield* confinements(b, st, info, 2); break;
    case 'confine3': yield* confinements(b, st, info, 3); break;
    case 'confine4': yield* confinements(b, st, info, 4, Math.floor(b.n / 2)); break;
    case 'contradiction': yield* contradictions(b, st); break;
  }
}

export function nextDeduction(b: Board, st: Uint8Array): (Deduction & { tier: number }) | null {
  const info = unitInfo(b, st);
  for (let t = 0; t < TECHNIQUES.length; t++) {
    const d = deductionsOfTier(b, st, t, info).next().value;
    if (d) return { ...d, tier: t };
  }
  return null;
}

export interface LogicResult {
  solved: boolean;
  steps: Step[];
  state: Uint8Array;
}

export function solveLogically(b: Board, start: Uint8Array = emptyState(b)): LogicResult {
  const st = start.slice();
  const steps: Step[] = [];
  for (let guard = 0; guard < b.size * 4; guard++) {
    if (isSolved(b, st)) return { solved: true, steps, state: st };
    const info = unitInfo(b, st);
    if (findContradiction(b, st, info) !== -1) return { solved: false, steps, state: st };
    let applied = false;
    for (let t = 0; t < TECHNIQUES.length && !applied; t++) {
      const gen = deductionsOfTier(b, st, t, info);
      const first = gen.next().value;
      if (!first) continue;
      let options = 1;
      for (let x = gen.next(); !x.done; x = gen.next()) if (++options >= 20) break;
      steps.push({ ...first, tier: t, options });
      applyDeduction(b, st, first);
      applied = true;
    }
    if (!applied) return { solved: false, steps, state: st };
  }
  return { solved: false, steps, state: st };
}
