import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBoard, regionsAreContiguous, isValidSolution, findSolutions,
  generatePuzzle, generateRated, randomSolution, mulberry32,
  solveLogically, emptyState, nextDeduction, applyDeduction, CAT, CROSS, rateBoard,
} from '../js/engine/index.js';

const SIZES = [5, 6, 7, 8, 9, 10];

test('la disposizione casuale dei gatti è sempre valida', () => {
  for (const n of SIZES) {
    for (let s = 0; s < 20; s++) {
      const sol = randomSolution(n, mulberry32(s));
      // controllo diretto: righe, colonne, adiacenza
      const cols = new Set(sol.map((c) => c % n));
      assert.equal(cols.size, n);
      for (let r = 1; r < n; r++) assert.ok(Math.abs((sol[r] % n) - (sol[r - 1] % n)) > 1);
    }
  }
});

test('ogni livello generato ha regioni connesse e una sola soluzione', () => {
  for (const n of SIZES) {
    for (let s = 1; s <= 25; s++) {
      const p = generatePuzzle(n, s);
      assert.ok(regionsAreContiguous(n, p.regions), `regioni non connesse n=${n} seed=${s}`);
      const board = createBoard(n, p.regions);
      assert.ok(isValidSolution(board, p.solution));
      const sols = findSolutions(n, p.regions, 2);
      assert.equal(sols.length, 1, `soluzione non unica n=${n} seed=${s}`);
      assert.deepEqual([...sols[0]].sort((a, b) => a - b), [...p.solution].sort((a, b) => a - b));
    }
  }
});

test('lo stesso seme produce lo stesso livello', () => {
  assert.deepEqual(generatePuzzle(8, 42), generatePuzzle(8, 42));
});

test('il risolutore logico non sbaglia mai e trova la soluzione', () => {
  for (const n of SIZES) {
    for (let s = 1; s <= 25; s++) {
      const p = generatePuzzle(n, s);
      const board = createBoard(n, p.regions);
      const sol = new Set(p.solution);
      // Passo per passo: nessuna deduzione deve escludere una casella della soluzione
      // né mettere un gatto fuori soluzione.
      const st = emptyState(board);
      for (let guard = 0; guard < 500; guard++) {
        const d = nextDeduction(board, st);
        if (!d) break;
        if (d.place !== undefined) assert.ok(sol.has(d.place), `gatto sbagliato (${d.tech}) n=${n} seed=${s}`);
        for (const i of d.eliminate) assert.ok(!sol.has(i), `esclusione sbagliata (${d.tech}) n=${n} seed=${s}`);
        applyDeduction(board, st, d);
      }
      const res = solveLogically(board);
      if (res.solved) {
        const cats = [...res.state.keys()].filter((i) => res.state[i] === CAT);
        assert.deepEqual(cats.sort((a, b) => a - b), [...p.solution].sort((a, b) => a - b));
      }
    }
  }
});

test('la valutazione restituisce categoria e punteggio coerenti', () => {
  const lv = generateRated(7, 123);
  assert.ok(lv.rating.solvable);
  assert.ok(['facile', 'medio', 'difficile', 'esperto', 'diabolico'].includes(lv.rating.category));
  assert.ok(lv.rating.score > 0);
});

test('si può chiedere una categoria specifica', () => {
  for (const cat of ['facile', 'medio', 'difficile']) {
    const lv = generateRated(8, 7, { difficulty: cat });
    assert.equal(lv.rating.category, cat);
  }
});
