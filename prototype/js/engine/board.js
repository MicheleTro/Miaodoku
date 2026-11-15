// Modello della griglia: N×N celle, N regioni colorate.
// Le "unità" sono le righe, le colonne e le regioni: ognuna deve contenere esattamente un gatto.
//   unità 0..N-1      = righe
//   unità N..2N-1     = colonne
//   unità 2N..3N-1    = regioni

export const UNKNOWN = 0;
export const CROSS = 1; // casella esclusa (X)
export const CAT = 2;

export function createBoard(n, regions) {
  const size = n * n;
  const units = [];
  for (let r = 0; r < n; r++) units.push({ type: 'row', index: r, cells: [] });
  for (let c = 0; c < n; c++) units.push({ type: 'col', index: c, cells: [] });
  for (let g = 0; g < n; g++) units.push({ type: 'region', index: g, cells: [] });

  const cellUnits = new Array(size);
  const neigh8 = new Array(size);
  const neigh4 = new Array(size);

  for (let i = 0; i < size; i++) {
    const r = Math.floor(i / n);
    const c = i % n;
    const g = regions[i];
    if (g < 0 || g >= n) throw new Error(`Regione non valida ${g} nella cella ${i}`);
    units[r].cells.push(i);
    units[n + c].cells.push(i);
    units[2 * n + g].cells.push(i);
    cellUnits[i] = [r, n + c, 2 * n + g];

    const n8 = [];
    const n4 = [];
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
    neigh8[i] = n8;
    neigh4[i] = n4;
  }

  for (let g = 0; g < n; g++) {
    if (units[2 * n + g].cells.length === 0) throw new Error(`Regione ${g} vuota`);
  }

  // "Visibilità": tutte le celle che un gatto in i esclude (stessa riga, colonna, regione, o vicine).
  const sees = new Array(size);
  for (let i = 0; i < size; i++) {
    const set = new Set();
    for (const u of cellUnits[i]) for (const j of units[u].cells) set.add(j);
    for (const j of neigh8[i]) set.add(j);
    set.delete(i);
    sees[i] = [...set];
  }

  return {
    n,
    size,
    regions: Array.from(regions),
    units,
    cellUnits,
    neigh8,
    neigh4,
    sees,
    row: (i) => Math.floor(i / n),
    col: (i) => i % n,
  };
}

/** Controlla che ogni regione sia connessa (adiacenza ortogonale). */
export function regionsAreContiguous(n, regions) {
  const size = n * n;
  const seen = new Uint8Array(size);
  const found = new Set();
  for (let s = 0; s < size; s++) {
    if (seen[s]) continue;
    const g = regions[s];
    if (found.has(g)) return false; // seconda componente della stessa regione
    found.add(g);
    const stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop();
      const r = Math.floor(i / n);
      const c = i % n;
      for (const [rr, cc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
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

/** Verifica una soluzione completa: posizioni dei gatti come lista di celle. */
export function isValidSolution(board, cats) {
  const { n } = board;
  if (cats.length !== n) return false;
  const rows = new Set();
  const cols = new Set();
  const regs = new Set();
  for (const i of cats) {
    rows.add(board.row(i));
    cols.add(board.col(i));
    regs.add(board.regions[i]);
  }
  if (rows.size !== n || cols.size !== n || regs.size !== n) return false;
  const set = new Set(cats);
  for (const i of cats) for (const j of board.neigh8[i]) if (set.has(j)) return false;
  return true;
}
