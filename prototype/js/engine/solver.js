// Risolutore esatto (backtracking): conta le soluzioni fino a un limite.
// Serve al generatore per garantire che ogni livello abbia UNA sola soluzione.
// Non è il modo in cui ragiona una persona: per quello vedi logic.js.

/**
 * @param {number} n
 * @param {ArrayLike<number>} regions  regione di ogni cella (n*n)
 * @param {number} limit  si ferma dopo aver trovato `limit` soluzioni
 * @returns {number[][]} soluzioni, ognuna come lista di celle (una per riga)
 */
export function findSolutions(n, regions, limit = 2) {
  const sols = [];
  const pos = new Array(n);

  // Ultima riga in cui compare ogni regione: se superiamo quella riga senza
  // aver usato la regione, il ramo è morto (potatura economica ma efficace).
  const lastRow = new Array(n).fill(-1);
  for (let i = 0; i < n * n; i++) lastRow[regions[i]] = Math.floor(i / n);
  const regionsEndingAt = Array.from({ length: n }, () => 0);
  for (let g = 0; g < n; g++) regionsEndingAt[lastRow[g]] |= 1 << g;

  function rec(r, colMask, regMask) {
    if (r === n) {
      sols.push(pos.map((c, row) => row * n + c));
      return;
    }
    const prev = r > 0 ? pos[r - 1] : -10;
    for (let c = 0; c < n; c++) {
      if ((colMask >> c) & 1) continue;
      if (c >= prev - 1 && c <= prev + 1) continue;
      const g = regions[r * n + c];
      if ((regMask >> g) & 1) continue;
      const nextReg = regMask | (1 << g);
      // Tutte le regioni che finiscono in questa riga devono essere state usate.
      if ((regionsEndingAt[r] & nextReg) !== regionsEndingAt[r]) continue;
      pos[r] = c;
      rec(r + 1, colMask | (1 << c), nextReg);
      if (sols.length >= limit) return;
    }
  }

  rec(0, 0, 0);
  return sols;
}

export function countSolutions(n, regions, limit = 2) {
  return findSolutions(n, regions, limit).length;
}
