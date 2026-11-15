import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { findSolutions } from '@bradoku/core';
import { openDatabase } from '../src/db/index.js';
import { buildApp } from '../src/app.js';

let app: FastifyInstance;
let close: () => Promise<void>;

beforeAll(async () => {
  const opened = await openDatabase();
  close = opened.close;
  app = await buildApp({ db: opened.db, jwtSecret: 'test' });
});
afterAll(async () => {
  await app.close();
  await close();
});

async function call(method: 'GET' | 'POST' | 'PUT', url: string, token?: string, payload?: unknown) {
  const res = await app.inject({ method, url, payload: payload as object, headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { status: res.statusCode, body: res.json() };
}
async function register(username: string) {
  const r = await call('POST', '/api/auth/register', undefined, { username, password: 'segreto1' });
  expect(r.status).toBe(200);
  return r.body.token as string;
}
const solve = (level: { n: number; regions: number[] }) => findSolutions(level.n, level.regions, 1)[0]!;

describe('API Bradoku', () => {
  let anna: string;
  let bruno: string;

  it('registrazione, login e profilo', async () => {
    anna = await register('anna');
    bruno = await register('bruno');
    expect((await call('POST', '/api/auth/register', undefined, { username: 'Anna', password: 'segreto1' })).status).toBe(409);
    expect((await call('POST', '/api/auth/login', undefined, { username: 'anna', password: 'sbagliata' })).status).toBe(401);
    const me = await call('GET', '/api/me', anna);
    expect(me.body).toMatchObject({ username: 'anna', level: 1, xp: 0, streak: 0, lumi: 0 });
    expect((await call('GET', '/api/me')).status).toBe(401);
  });

  it('partita libera: soluzione sbagliata rifiutata, giusta premiata', async () => {
    const start = await call('POST', '/api/games', anna, { n: 6, difficulty: 'facile' });
    expect(start.status).toBe(200);
    expect(start.body.level.rating.category).toBe('facile');
    const id = start.body.gameId;
    expect((await call('POST', `/api/games/${id}/finish`, anna, { pieces: [0, 1, 2, 3, 4, 5], hints: 0, clean: true })).status).toBe(400);
    const fin = await call('POST', `/api/games/${id}/finish`, anna, { pieces: solve(start.body.level), hints: 0, clean: true });
    expect(fin.status).toBe(200);
    expect(fin.body.score.points).toBeGreaterThan(0);
    expect(fin.body.xp.after).toBe(fin.body.score.points);
    expect(fin.body.streak).toMatchObject({ value: 1, firstToday: true });
    expect(fin.body.newMedals).toContain('prima-partita');
    expect((await call('POST', `/api/games/${id}/finish`, anna, { pieces: solve(start.body.level), hints: 0, clean: true })).status).toBe(409);
  });

  it('sfida dal livello appena risolto: vince chi fa più punti', async () => {
    const start = await call('POST', '/api/games', anna, { n: 6, difficulty: 'medio' });
    const pieces = solve(start.body.level);
    await call('POST', `/api/games/${start.body.gameId}/finish`, anna, { pieces, hints: 0, clean: true });
    const ch = await call('POST', '/api/challenges', anna, { opponent: 'bruno', fromGameId: start.body.gameId });
    expect(ch.status).toBe(200);
    expect(ch.body).toMatchObject({ opponent: 'bruno', myTurn: false, status: 'open' });

    const list = await call('GET', '/api/challenges', bruno);
    expect(list.body[0]).toMatchObject({ opponent: 'anna', myTurn: true });
    expect(list.body[0].them.points).toBeUndefined();
    expect((await call('GET', '/api/me', bruno)).body.challengesToPlay).toBe(1);

    const play = await call('POST', `/api/challenges/${ch.body.id}/play`, bruno);
    expect(play.body.level.regions).toEqual(start.body.level.regions);
    expect(play.body.lumiAvailable).toBe(0);
    expect((await call('POST', `/api/games/${play.body.gameId}/finish`, bruno, { pieces, hints: 0, lumi: true, clean: true })).status).toBe(400);
    const fin = await call('POST', `/api/games/${play.body.gameId}/finish`, bruno, { pieces, hints: 5, clean: false });
    expect(fin.body.challenge).toMatchObject({ status: 'completed', outcome: 'loss' });

    const annaView = await call('GET', `/api/challenges/${ch.body.id}`, anna);
    expect(annaView.body.outcome).toBe('win');
    expect((await call('GET', '/api/me', anna)).body.medals).toEqual(expect.arrayContaining(['prima-sfida', 'prima-vittoria']));
    expect((await call('GET', '/api/friends', bruno)).body).toEqual([{ username: 'anna', wins: 0, losses: 1, draws: 0 }]);

    const re = await call('POST', `/api/challenges/${ch.body.id}/rematch`, bruno);
    expect(re.body).toMatchObject({ opponent: 'anna', myTurn: true, rematchOf: ch.body.id });
  });

  it('accessori: solo quelli sbloccati', async () => {
    expect((await call('PUT', '/api/me/accessory', anna, { accessory: 'corona' })).status).toBe(403);
    expect((await call('PUT', '/api/me/accessory', anna, { accessory: 'nessuno' })).body.accessory).toBe('nessuno');
  });

  it('ricerca giocatori', async () => {
    expect((await call('GET', '/api/users?q=br', anna)).body).toEqual(['bruno']);
  });
});
