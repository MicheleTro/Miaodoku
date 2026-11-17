import { describe, expect, it } from 'vitest';
import { pathStep, pathLevel, isHard, matchesWant, generateWanted, levelFromSeed, MIN_SIZE, MAX_SIZE, maxSizeAt } from '../src/index.js';

describe('percorso', () => {
  it('ogni quadro è deterministico e ha griglia tra 8 e 12', () => {
    for (let k = 1; k <= 200; k++) {
      const s = pathStep(k);
      expect(pathStep(k)).toEqual(s);
      expect(s.n).toBeGreaterThanOrEqual(MIN_SIZE);
      expect(s.n).toBeLessThanOrEqual(Math.min(MAX_SIZE, maxSizeAt(k)));
    }
  });

  it('avvio graduale, poi un difficile ogni 6–7 quadri misti', () => {
    const hard: number[] = [];
    for (let k = 1; k <= 300; k++) if (pathStep(k).want === 'difficile+') hard.push(k);
    expect(hard[0]).toBe(10);
    expect([1, 2, 3].map((k) => pathStep(k).want)).toEqual(['facile', 'facile', 'medio']);
    for (let i = 1; i < hard.length; i++) expect([7, 8]).toContain(hard[i]! - hard[i - 1]!);
    expect(new Set(Array.from({ length: 300 }, (_, i) => pathStep(i + 1).n))).toEqual(new Set([8, 9, 10, 11, 12]));
  });

  it('i quadri si riproducono dal seme e rispettano la difficoltà chiesta', () => {
    const first = pathLevel(1);
    expect(first.n).toBe(8);
    expect(first.rating.category).toBe('facile');
    expect(levelFromSeed(first.n, first.seed)).toEqual(first);
    expect(isHard(pathLevel(10).rating.category)).toBe(true);
  });

  it('«normale» e «difficile+»', () => {
    expect(matchesWant({ category: 'difficile' }, 'normale')).toBe(true);
    expect(matchesWant({ category: 'esperto' }, 'normale')).toBe(false);
    expect(matchesWant({ category: 'diabolico' }, 'difficile+')).toBe(true);
    expect(isHard(generateWanted(8, 3, 'difficile+').rating.category)).toBe(true);
  });
});
