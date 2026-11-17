import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';
import { findSolutions } from '@bradoku/core';
import { openDatabase } from '../src/db/index.js';
import { buildApp } from '../src/app.js';
import type { Friend, Portal } from '../src/portal.js';

const PORTAL = 'https://portale.test';
const SECRET = 'segreto-di-prova-lungo-almeno-32-caratteri';

// Il portale finto: amicizie in memoria, modificabili dai test.
const people: Record<string, string> = { 'sub-anna': 'anna', 'sub-bruno': 'bruno', 'sub-carla': 'carla' };
const friendships = new Set(['sub-anna|sub-bruno']);
const areFriends = (a: string, b: string) => friendships.has(`${a}|${b}`) || friendships.has(`${b}|${a}`);
const portal: Portal = {
  friends: async (sub) => Object.keys(people).filter((o) => o !== sub && areFriends(sub, o)).map((o): Friend => ({ sub: o, username: people[o]! })),
  check: async (sub, other) => (areFriends(sub, other) ? { sub: other, username: people[other]! } : null),
};

let app: FastifyInstance;
let close: () => Promise<void>;
let privateKey: CryptoKey;

beforeAll(async () => {
  const keys = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  privateKey = keys.privateKey;
  const jwk = { ...(await exportJWK(keys.publicKey)), alg: 'EdDSA', use: 'sig' };
  const opened = await openDatabase();
  close = opened.close;
  app = await buildApp({
    db: opened.db, sessionSecret: SECRET, portalUrl: PORTAL, serviceId: 'bradoku', production: true,
    portalJwks: createLocalJWKSet({ keys: [jwk] }), portal, inlineGeneration: true,
  });
});
afterAll(async () => {
  await app.close();
  await close();
});

/** Token come lo emette il portale (decisione whoru #24): EdDSA, 60 s, aud = id del servizio, jti unico. */
function portalToken(sub: string, opts: { aud?: string; iss?: string; groups?: string[] } = {}) {
  return new SignJWT({ preferred_username: people[sub] ?? sub, groups: opts.groups ?? ['membri'] })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuer(opts.iss ?? PORTAL)
    .setAudience(opts.aud ?? 'bradoku')
    .setSubject(sub)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(privateKey);
}

async function callback(token: string) {
  const res = await app.inject({ method: 'GET', url: `/api/auth/callback?token=${encodeURIComponent(token)}` });
  const cookie = String(res.headers['set-cookie'] ?? '').split(';')[0] ?? '';
  return { status: res.statusCode, location: res.headers.location, cookie, setCookie: String(res.headers['set-cookie'] ?? '') };
}
async function login(sub: string) {
  const r = await callback(await portalToken(sub));
  expect(r.status).toBe(302);
  expect(r.location).toBe('/');
  return r.cookie;
}
async function call(method: 'GET' | 'POST' | 'PUT', url: string, cookie?: string, payload?: unknown) {
  const res = await app.inject({ method, url, payload: payload as object, headers: cookie ? { cookie } : {} });
  return { status: res.statusCode, body: res.body ? res.json() : null };
}
const solve = (level: { n: number; regions: number[] }) => findSolutions(level.n, level.regions, 1)[0]!;

describe('accesso dal portale whoru', () => {
  it('senza sessione: 401 con l’indirizzo del portale', async () => {
    const r = await call('GET', '/api/me');
    expect(r.status).toBe(401);
    expect(r.body.loginUrl).toBe(`${PORTAL}/launch/bradoku`);
  });

  it('token valido: sessione in un cookie HttpOnly __Host-, token usabile una volta sola', async () => {
    const token = await portalToken('sub-anna', { groups: ['admin', 'membri'] });
    const ok = await callback(token);
    expect(ok.status).toBe(302);
    expect(ok.setCookie).toMatch(/^__Host-bradoku_session=.+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=\d+; Secure$/);
    const me = await call('GET', '/api/auth/me', ok.cookie);
    expect(me.body).toMatchObject({ id: 'sub-anna', username: 'anna', isAdmin: true });

    const again = await callback(token);
    expect(again.location).toBe(`${PORTAL}/launch/bradoku`);
    expect(again.setCookie).toBe('');
  });

  it('token per un altro servizio, di un altro emittente o alterato: rifiutato', async () => {
    for (const token of [
      await portalToken('sub-anna', { aud: 'paroliere' }),
      await portalToken('sub-anna', { iss: 'https://altro.test' }),
      (await portalToken('sub-anna')).slice(0, -4) + 'AAAA',
    ]) {
      const r = await callback(token);
      expect(r.location).toBe(`${PORTAL}/launch/bradoku`);
      expect(r.setCookie).toBe('');
    }
  });

  it('niente account propri né accesso di sviluppo in produzione', async () => {
    expect((await call('POST', '/api/auth/register', undefined, { username: 'x', password: 'yyyyyy' })).status).toBe(404);
    expect((await call('POST', '/api/auth/login', undefined, { username: 'x', password: 'yyyyyy' })).status).toBe(404);
    expect((await call('GET', '/api/auth/dev?user=x')).status).toBe(404);
    expect((await call('GET', '/api/users?q=a', await login('sub-anna'))).status).toBe(404);
  });

  it('uscita: il cookie viene cancellato', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/logout' });
    expect(res.statusCode).toBe(204);
    expect(String(res.headers['set-cookie'])).toMatch(/^__Host-bradoku_session=; .*Max-Age=0/);
  });
});

describe('gioco', () => {
  let anna: string;
  let bruno: string;
  let carla: string;

  beforeAll(async () => {
    anna = await login('sub-anna');
    bruno = await login('sub-bruno');
    carla = await login('sub-carla');
  });

  it('profilo con l’identità di whoru', async () => {
    const me = await call('GET', '/api/me', anna);
    expect(me.body).toMatchObject({ id: 'sub-anna', username: 'anna', level: 1, xp: 0, streak: 0, lumi: 0, pathDone: 0 });
  });

  it('niente più partita libera con griglia e difficoltà a scelta', async () => {
    expect((await call('POST', '/api/games', anna, { n: 8, difficulty: 'facile' })).status).toBe(404);
  });

  it('percorso: stesso quadro per tutti, il contatore sale solo risolvendolo', async () => {
    const info = await call('GET', '/api/path', anna);
    expect(info.body).toMatchObject({ done: 0, next: { k: 1, n: 8, hard: false }, playingGameId: null });
    expect((await call('GET', '/api/path', carla)).body.next).toEqual(info.body.next);

    const start = await call('POST', '/api/path/play', anna);
    expect(start.status).toBe(200);
    expect(start.body).toMatchObject({ pathK: 1, level: { n: 8, seed: info.body.next.seed } });
    expect(start.body.introduce).toBeUndefined();
    // di nuovo «gioca»: riprende la stessa partita
    expect((await call('POST', '/api/path/play', anna)).body.gameId).toBe(start.body.gameId);
    expect((await call('GET', '/api/path', anna)).body.playingGameId).toBe(start.body.gameId);

    const id = start.body.gameId;
    expect((await call('POST', `/api/games/${id}/finish`, anna, { pieces: [0, 1, 2, 3, 4, 5, 6, 7], hints: 0, clean: true })).status).toBe(400);
    const fin = await call('POST', `/api/games/${id}/finish`, anna, { pieces: solve(start.body.level), hints: 0, clean: true });
    expect(fin.status).toBe(200);
    expect(fin.body.score.points).toBeGreaterThan(0);
    expect(fin.body.xp.after).toBe(fin.body.score.points);
    expect(fin.body.streak).toMatchObject({ value: 1, firstToday: true });
    expect(fin.body.newMedals).toContain('prima-partita');
    expect(fin.body.path).toEqual({ k: 1, advanced: true, done: 1 });
    expect((await call('POST', `/api/games/${id}/finish`, anna, { pieces: solve(start.body.level), hints: 0, clean: true })).status).toBe(409);
    expect((await call('GET', '/api/me', anna)).body.pathDone).toBe(1);
    expect((await call('GET', '/api/path', anna)).body.next.k).toBe(2);
    // la partita di anna non è di carla
    expect((await call('GET', `/api/games/${id}`, carla)).status).toBe(404);
  });

  it('sfide solo tra amici del portale', async () => {
    expect((await call('POST', '/api/challenges', anna, { opponent: 'sub-carla', n: 8 })).status).toBe(403);
    expect((await call('POST', '/api/challenges', anna, { opponent: 'sub-anna', n: 8 })).status).toBe(400);
    expect((await call('POST', '/api/challenges', anna, { opponent: 'sub-bruno', n: 6 })).status).toBe(400);
    expect((await call('GET', '/api/friends', anna)).body).toEqual([{ id: 'sub-bruno', username: 'bruno', wins: 0, losses: 0, draws: 0 }]);
  });

  it('sfida dal quadro appena risolto: vince chi fa più punti', async () => {
    const start = await call('POST', '/api/path/play', anna);
    const pieces = solve(start.body.level);
    await call('POST', `/api/games/${start.body.gameId}/finish`, anna, { pieces, hints: 0, clean: true });
    const ch = await call('POST', '/api/challenges', anna, { opponent: 'sub-bruno', fromGameId: start.body.gameId });
    expect(ch.status).toBe(200);
    expect(ch.body).toMatchObject({ opponent: 'bruno', opponentId: 'sub-bruno', myTurn: false, status: 'open' });

    const list = await call('GET', '/api/challenges', bruno);
    expect(list.body[0]).toMatchObject({ opponent: 'anna', opponentId: 'sub-anna', myTurn: true });
    expect(list.body[0].them.points).toBeUndefined();
    expect((await call('GET', '/api/me', bruno)).body.challengesToPlay).toBe(1);
    expect((await call('GET', `/api/challenges/${ch.body.id}`, carla)).status).toBe(404);

    const play = await call('POST', `/api/challenges/${ch.body.id}/play`, bruno);
    expect(play.body.level.regions).toEqual(start.body.level.regions);
    expect(play.body.lumiAvailable).toBe(0);
    expect((await call('POST', `/api/games/${play.body.gameId}/finish`, bruno, { pieces, hints: 0, lumi: true, clean: true })).status).toBe(400);
    const fin = await call('POST', `/api/games/${play.body.gameId}/finish`, bruno, { pieces, hints: 5, clean: false });
    expect(fin.body.challenge).toMatchObject({ status: 'completed', outcome: 'loss' });

    const annaView = await call('GET', `/api/challenges/${ch.body.id}`, anna);
    expect(annaView.body.outcome).toBe('win');
    expect((await call('GET', '/api/me', anna)).body.medals).toEqual(expect.arrayContaining(['prima-sfida', 'prima-vittoria']));
    expect((await call('GET', '/api/friends', bruno)).body).toEqual([{ id: 'sub-anna', username: 'anna', wins: 0, losses: 1, draws: 0 }]);

    const re = await call('POST', `/api/challenges/${ch.body.id}/rematch`, bruno);
    expect(re.body).toMatchObject({ opponent: 'anna', myTurn: true, rematchOf: ch.body.id });

    // tolta l'amicizia nel portale: niente più rivincite
    friendships.delete('sub-anna|sub-bruno');
    expect((await call('POST', `/api/challenges/${ch.body.id}/rematch`, bruno)).status).toBe(403);
    friendships.add('sub-anna|sub-bruno');
  });

  it('sfida a un amico che non ha mai aperto Bradoku', async () => {
    people['sub-dario'] = 'dario';
    friendships.add('sub-anna|sub-dario');
    const ch = await call('POST', '/api/challenges', anna, { opponent: 'sub-dario', n: 8, hard: true });
    expect(ch.status).toBe(200);
    expect(ch.body).toMatchObject({ opponent: 'dario', opponentId: 'sub-dario', n: 8, hard: true });
  });

  it('accessori: solo quelli sbloccati', async () => {
    expect((await call('PUT', '/api/me/accessory', anna, { accessory: 'corona' })).status).toBe(403);
    expect((await call('PUT', '/api/me/accessory', anna, { accessory: 'nessuno' })).body.accessory).toBe('nessuno');
  });
});

describe('sviluppo (DEV_LOGIN, fuori produzione)', () => {
  it('accesso senza portale e utenti dev- amici tra loro', async () => {
    const opened = await openDatabase();
    const dev = await buildApp({ db: opened.db, sessionSecret: SECRET, portalUrl: PORTAL, devLogin: true, inlineGeneration: true });
    const enter = async (user: string) => {
      const r = await dev.inject({ method: 'GET', url: `/api/auth/dev?user=${user}` });
      expect(r.statusCode).toBe(302);
      return String(r.headers['set-cookie']).split(';')[0]!;
    };
    const mario = await enter('mario');
    await enter('luigi');
    expect(mario).toMatch(/^bradoku_session=/);
    const fr = await dev.inject({ method: 'GET', url: '/api/friends', headers: { cookie: mario } });
    expect(fr.json()).toEqual([{ id: 'dev-luigi', username: 'luigi', wins: 0, losses: 0, draws: 0 }]);
    const noSession = await dev.inject({ method: 'GET', url: '/api/me' });
    expect(noSession.json().loginUrl).toBe('/api/auth/dev?user=dev');
    await dev.close();
    await opened.close();
  });
});
