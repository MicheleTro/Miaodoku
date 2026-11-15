/**
 * Modello della griglia: N×N celle, N regioni.
 * Le "unità" sono righe (0..N-1), colonne (N..2N-1) e regioni (2N..3N-1):
 * ognuna deve contenere esattamente un bradipo.
 */
export const UNKNOWN = 0;
export const CROSS = 1;
export const PIECE = 2;
export type CellState = typeof UNKNOWN | typeof CROSS | typeof PIECE;

export type UnitType = 'row' | 'col' | 'region';
export interface Unit {
  type: UnitType;
  index: number;
  cells: number[];
}

export interface Board {
  n: number;
  size: number;
  regions: number[];
  units: Unit[];
  /** [riga, colonna, regione] come id di unità */
  cellUnits: number[][];
  neigh8: number[][];
  neigh4: number[][];
  /** celle escluse da un bradipo in quella cella */
  sees: number[][];
}

export const rowOf = (b: Board, i: number): number => Math.floor(i / b.n);
export const colOf = (b: Board, i: number): number => i % b.n;

export function createBoard(n: number, regions: ArrayLike<number>): Board {
  const size = n * n;
  const units: Unit[] = [];
  for (let r = 0; r < n; r++) units.push({ type: 'row', index: r, cells: [] });
  for (let c = 0; c < n; c++) units.push({ type: 'col', index: c, cells: [] });
  for (let g = 0; g < n; g++) units.push({ type: 'region', index: g, cells: [] });

  const cellUnits: number[][] = [];
  const neigh8: number[][] = [];
  const neigh4: number[][] = [];
  for (let i = 0; i < size; i++) {
    const r = Math.floor(i / n);
    const c = i % n;
    const g = regions[i]!;
    if (g < 0 || g >= n) throw new Error(`Regione non valida ${g} nella cella ${i}`);
    units[r]!.cells.push(i);
    units[n + c]!.cells.push(i);
    units[2 * n + g]!.cells.push(i);
    cellUnits.push([r, n + c, 2 * n + g]);
    const n8: number[] = [];
    const n4: number[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
        n8.push(rr * n + cc);
        if (!dr || !dc) n4.push(rr * n + cc);
      }
    }
    neigh8.push(n8);
    neigh4.push(n4);
  }
  for (let g = 0; g < n; g++) if (units[2 * n + g]!.cells.length === 0) throw new Error(`Regione ${g} vuota`);

  const sees: number[][] = [];
  for (let i = 0; i < size; i++) {
    const set = new Set<number>();
    for (const u of cellUnits[i]!) for (const j of units[u]!.cells) set.add(j);
    for (const j of neigh8[i]!) set.add(j);
    set.delete(i);
    sees.push([...set]);
  }
  return { n, size, regions: Array.from(regions), units, cellUnits, neigh8, neigh4, sees };
}

/** Ogni regione è connessa (adiacenza ortogonale) e ci sono esattamente n regioni. */
export function regionsAreContiguous(n: number, regions: ArrayLike<number>): boolean {
  const size = n * n;
  const seen = new Uint8Array(size);
  const found = new Set<number>();
  for (let s = 0; s < size; s++) {
    if (seen[s]) continue;
    const g = regions[s]!;
    if (found.has(g)) return false;
    found.add(g);
    const stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const r = Math.floor(i / n);
      const c = i % n;
      const near: [number, number][] = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
      for (const [rr, cc] of near) {
        if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
        const j = rr * n + cc;
        if (!seen[j] && regions[j] === g) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
  }
  return found.size === n;
}

/** Verifica una soluzione completa (lista delle celle con un bradipo). */
export function isValidSolution(board: Board, pieces: number[]): boolean {
  const { n } = board;
  if (pieces.length !== n) return false;
  const rows = new Set<number>();
  const cols = new Set<number>();
  const regs = new Set<number>();
  for (const i of pieces) {
    if (!Number.isInteger(i) || i < 0 || i >= board.size) return false;
    rows.add(rowOf(board, i));
    cols.add(colOf(board, i));
    regs.add(board.regions[i]!);
  }
  if (rows.size !== n || cols.size !== n || regs.size !== n) return false;
  const set = new Set(pieces);
  for (const i of pieces) for (const j of board.neigh8[i]!) if (set.has(j)) return false;
  return true;
}
