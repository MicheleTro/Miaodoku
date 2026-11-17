import { describe, expect, it } from 'vitest';
import { computePoints, compareResults, levelFromXp, xpNeed, updateStreak, visibleStreak, earnedMedals, unlockedAccessories, rankFor } from '../src/index.js';

describe('punteggio', () => {
  it('Medio 8×8, metà tempo, pulito, senza suggerimenti: la velocità vale metà della difficoltà', () => {
    const r = computePoints({ rating: { score: 41, steps: 20 }, durationMs: 150_000, hints: 0, clean: true });
    expect(r.parMs).toBe(300_000);
    expect(r.speedPoints).toBe(21);
    expect(r.points).toBe(112); // (41 + 21) × 1,2 × 1,5
  });
  it('nelle partite difficili la velocità conta doppio', () => {
    const normal = computePoints({ rating: { score: 40, steps: 20 }, durationMs: 225_000, hints: 0, clean: false });
    const hard = computePoints({ rating: { score: 40, steps: 20 }, durationMs: 225_000, hints: 0, clean: false, hard: true });
    expect(normal.timeFactor).toBe(0.5);
    expect(hard.speedPoints).toBe(2 * normal.speedPoints);
    expect(hard.points).toBeGreaterThan(normal.points);
  });
  it('il tempo non toglie mai punti', () => {
    const slow = computePoints({ rating: { score: 40, steps: 10 }, durationMs: 10 ** 9, hints: 0, clean: false });
    expect(slow.points).toBe(60);
  });
  it('i suggerimenti riducono fino a 0,4', () => {
    expect(computePoints({ rating: { score: 100, steps: 10 }, durationMs: 10 ** 9, hints: 2, clean: false }).points).toBe(100);
    expect(computePoints({ rating: { score: 100, steps: 10 }, durationMs: 10 ** 9, hints: 20, clean: false }).points).toBe(40);
  });
  it('parità: meno suggerimenti, poi meno tempo', () => {
    expect(compareResults({ points: 50, hints: 0, durationMs: 9 }, { points: 50, hints: 1, durationMs: 1 })).toBeGreaterThan(0);
    expect(compareResults({ points: 50, hints: 0, durationMs: 9 }, { points: 50, hints: 0, durationMs: 1 })).toBeLessThan(0);
  });
});

describe('progressione', () => {
  it('curva XP del Paroliere', () => {
    expect(xpNeed(1)).toBe(60);
    expect(levelFromXp(0)).toEqual({ level: 1, xpInto: 0, need: 60 });
    expect(levelFromXp(60).level).toBe(2);
    expect(rankFor(5).name).toBe('Ramo');
  });
  it('serie: 2 Lumi ogni 10 giorni, azzerata se salti', () => {
    let s = { streak: 0, lastPlayDay: null as string | null, cycles: 0 };
    let lumi = 0;
    for (let d = 1; d <= 10; d++) {
      const r = updateStreak(s, `2026-11-${String(d).padStart(2, '0')}`);
      lumi += r.lumiGained;
      s = r;
    }
    expect(s.streak).toBe(10);
    expect(lumi).toBe(2);
    expect(updateStreak(s, '2026-11-10').firstToday).toBe(false);
    expect(updateStreak(s, '2026-11-12').streak).toBe(1);
    expect(visibleStreak(10, '2026-11-10', '2026-11-12')).toBe(0);
  });
});

describe('medaglie e collezione', () => {
  const base = { solved: 1, noHintSolved: 0, level: 1, cycles: 0, challengesPlayed: 0, challengesWon: 0, winStreak: 0, rematchWins: 0 };
  it('tecniche solo senza suggerimenti', () => {
    const rating = { tier: 3, counts: { single: 3, confine1: 1, attack: 2, confine2: 1, confine3: 0, confine4: 0, contradiction: 0 } };
    const g = { n: 8, rating, hints: 0, lumi: false, clean: true, durationMs: 1000, parMs: 100_000 };
    expect(earnedMedals(base, g)).toEqual(expect.arrayContaining(['prima-partita', 'buon-vicino', 'coppia', 'lampo']));
    expect(earnedMedals(base, { ...g, hints: 1 })).not.toContain('coppia');
  });
  it('accessori per livello e medaglie', () => {
    expect(unlockedAccessories(5, ['coppia'])).toEqual(expect.arrayContaining(['foglia', 'fiore', 'berretto', 'sciarpa']));
    expect(unlockedAccessories(1, [])).not.toContain('fiore');
  });
});
