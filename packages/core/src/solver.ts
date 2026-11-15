/** Risolutore esatto (backtracking): serve a garantire che ogni livello abbia una sola soluzione. */
export function findSolutions(n: number, regions: ArrayLike<number>, limit = 2): number[][] {
  const sols: number[][] = [];
  const pos = new Array<number>(n).fill(0);
  const lastRow = new Array<number>(n).fill(-1);
  for (let i = 0; i < n * n; i++) lastRow[regions[i]!] = Math.floor(i / n);
  const endingAt = new Array<number>(n).fill(0);
  for (let g = 0; g < n; g++) endingAt[lastRow[g]!] = endingAt[lastRow[g]!]! | (1 << g);

  function rec(r: number, colMask: number, regMask: number): void {
    if (r === n) {
      sols.push(pos.map((c, row) => row * n + c));
      return;
    }
    const prev = r > 0 ? pos[r - 1]! : -10;
    for (let c = 0; c < n; c++) {
      if ((colMask >> c) & 1) continue;
      if (c >= prev - 1 && c <= prev + 1) continue;
      const g = regions[r * n + c]!;
      if ((regMask >> g) & 1) continue;
      const next = regMask | (1 << g);
      const must = endingAt[r]!;
      if ((must & next) !== must) continue;
      pos[r] = c;
      rec(r + 1, colMask | (1 << c), next);
      if (sols.length >= limit) return;
    }
  }
  rec(0, 0, 0);
  return sols;
}
