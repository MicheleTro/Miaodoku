import { describe, expect, it } from 'vitest';
import {
  createBoard, regionsAreContiguous, isValidSolution, findSolutions, generatePuzzle, generateRated, levelFromSeed,
  nextDeduction, applyDeduction, emptyState, solveLogically, PIECE,
} from '../src/index.js';

const SIZES = [5, 6, 7, 8, 9, 10];

describe('generatore', () => {
  it('ogni livello ha regioni connesse e una sola soluzione', () => {
    for (const n of SIZES) {
      for (let s = 1; s <= 15; s++) {
        const p = generatePuzzle(n, s);
        expect(regionsAreContiguous(n, p.regions)).toBe(true);
        expect(isValidSolution(createBoard(n, p.regions), p.solution)).toBe(true);
        const sols = findSolutions(n, p.regions, 2);
        expect(sols.length).toBe(1);
        expect([...sols[0]!].sort((a, b) => a - b)).toEqual([...p.solution].sort((a, b) => a - b));
      }
    }
  });
  it('lo stesso seme produce lo stesso livello', () => {
    expect(generatePuzzle(8, 42)).toEqual(generatePuzzle(8, 42));
  });
  it('il seme restituito da generateRated riproduce il livello', () => {
    const lv = generateRated(8, 7, 'difficile');
    expect(lv.rating.category).toBe('difficile');
    expect(levelFromSeed(8, lv.seed)).toEqual(lv);
  });
});

describe('risolutore logico', () => {
  it('non sbaglia mai e trova la soluzione', () => {
    for (const n of SIZES) {
      for (let s = 1; s <= 15; s++) {
        const p = generatePuzzle(n, s);
        const b = createBoard(n, p.regions);
        const sol = new Set(p.solution);
        const st = emptyState(b);
        for (let g = 0; g < 500; g++) {
          const d = nextDeduction(b, st);
          if (!d) break;
          if (d.place !== undefined) expect(sol.has(d.place)).toBe(true);
          for (const i of d.eliminate) expect(sol.has(i)).toBe(false);
          applyDeduction(b, st, d);
        }
        const res = solveLogically(b);
        if (res.solved) {
          const pieces = [...res.state.keys()].filter((i) => res.state[i] === PIECE);
          expect(pieces.sort((a, b2) => a - b2)).toEqual([...p.solution].sort((a, b2) => a - b2));
        }
      }
    }
  });
});
