import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { eq, ilike, and, ne } from 'drizzle-orm';
import { z } from 'zod';
import type { DB } from './db/index.js';
import { users } from './db/schema.js';
import { hashPassword, verifyPassword, tokens } from './auth.js';
import {
  HttpError, getUser, profile, startGame, resumeGame, finishGame, listChallenges, createChallenge, playChallenge,
  rematch, friends, getChallenge, challengeView,
} from './game.js';
import { unlockedAccessories, levelFromXp } from '@bradoku/core';

const CATEGORY = z.enum(['facile', 'medio', 'difficile', 'esperto', 'diabolico']);
const SIZE = z.number().int().min(5).max(10);
const credentials = z.object({
  username: z.string().trim().regex(/^[A-Za-z0-9_]{3,20}$/, 'Il nome deve avere 3–20 caratteri tra lettere, numeri e _'),
  password: z.string().min(6, 'La password deve avere almeno 6 caratteri').max(200),
});

export interface AppOptions {
  db: DB;
  jwtSecret: string;
  corsOrigin?: boolean | string | string[];
  staticDir?: string;
  logger?: boolean;
}

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });
  const { db } = opts;
  const jwt = tokens(opts.jwtSecret);
  await app.register(cors, { origin: opts.corsOrigin ?? true });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send({ error: err.message });
    if (err instanceof z.ZodError) return reply.status(400).send({ error: err.issues[0]?.message ?? 'Dati non validi' });
    app.log.error(err);
    return reply.status(500).send({ error: 'Errore del server' });
  });

  async function userId(req: FastifyRequest): Promise<number> {
    const h = req.headers.authorization ?? '';
    const id = h.startsWith('Bearer ') ? await jwt.verify(h.slice(7)) : null;
    if (!id) throw new HttpError(401, 'Accesso richiesto');
    return id;
  }
  const idParam = (req: FastifyRequest) => z.coerce.number().int().positive().parse((req.params as { id: string }).id);

  // ---- account
  app.post('/api/auth/register', async (req) => {
    const { username, password } = credentials.parse(req.body);
    const [taken] = await db.select({ id: users.id }).from(users).where(ilike(users.username, username));
    if (taken) throw new HttpError(409, 'Questo nome è già usato');
    const [u] = await db.insert(users).values({ username, passwordHash: await hashPassword(password) }).returning();
    return { token: await jwt.sign(u!.id), profile: await profile(db, u!) };
  });

  app.post('/api/auth/login', async (req) => {
    const { username, password } = z.object({ username: z.string().trim(), password: z.string() }).parse(req.body);
    const [u] = await db.select().from(users).where(ilike(users.username, username));
    if (!u || !(await verifyPassword(password, u.passwordHash))) throw new HttpError(401, 'Nome o password non corretti');
    return { token: await jwt.sign(u.id), profile: await profile(db, u) };
  });

  app.get('/api/me', async (req) => profile(db, await getUser(db, await userId(req))));

  app.put('/api/me/accessory', async (req) => {
    const u = await getUser(db, await userId(req));
    const { accessory } = z.object({ accessory: z.string() }).parse(req.body);
    if (!unlockedAccessories(levelFromXp(u.xp).level, u.medals).includes(accessory)) throw new HttpError(403, 'Accessorio non ancora sbloccato');
    await db.update(users).set({ accessory }).where(eq(users.id, u.id));
    return profile(db, { ...u, accessory });
  });

  app.get('/api/users', async (req) => {
    const me = await userId(req);
    const { q } = z.object({ q: z.string().trim().max(20).default('') }).parse(req.query);
    const rows = await db
      .select({ username: users.username })
      .from(users)
      .where(and(ne(users.id, me), ilike(users.username, `${q.replace(/[%_]/g, '')}%`)))
      .limit(8);
    return rows.map((r) => r.username);
  });

  // ---- partite
  app.post('/api/games', async (req) => {
    const u = await getUser(db, await userId(req));
    const { n, difficulty } = z.object({ n: SIZE, difficulty: CATEGORY }).parse(req.body);
    return startGame(db, u, { n, difficulty });
  });

  app.get('/api/games/:id', async (req) => resumeGame(db, await getUser(db, await userId(req)), idParam(req)));

  app.post('/api/games/:id/finish', async (req) => {
    const body = z
      .object({ pieces: z.array(z.number().int()).max(10), hints: z.number().int().min(0).max(999), lumi: z.boolean().default(false), clean: z.boolean() })
      .parse(req.body);
    return finishGame(db, await userId(req), idParam(req), body);
  });

  // ---- sfide
  app.get('/api/challenges', async (req) => listChallenges(db, await userId(req)));

  app.post('/api/challenges', async (req) => {
    const u = await getUser(db, await userId(req));
    const body = z.object({ opponent: z.string().trim().min(1), n: SIZE.optional(), difficulty: CATEGORY.optional(), fromGameId: z.number().int().optional() }).parse(req.body);
    return createChallenge(db, u, body);
  });

  app.get('/api/challenges/:id', async (req) => {
    const me = await userId(req);
    return challengeView(db, me, await getChallenge(db, me, idParam(req)));
  });

  app.post('/api/challenges/:id/play', async (req) => playChallenge(db, await getUser(db, await userId(req)), idParam(req)));
  app.post('/api/challenges/:id/rematch', async (req) => rematch(db, await getUser(db, await userId(req)), idParam(req)));
  app.get('/api/friends', async (req) => friends(db, await userId(req)));
  app.get('/api/health', async () => ({ ok: true }));

  // ---- frontend compilato (produzione): stesso server, stessa origine
  if (opts.staticDir && existsSync(opts.staticDir)) {
    await app.register(fastifyStatic, { root: opts.staticDir });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) return reply.status(404).send({ error: 'Non trovato' });
      return reply.sendFile('index.html');
    });
  }
  return app;
}
