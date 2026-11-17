import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import type { JWTVerifyGetKey } from 'jose';
import { z } from 'zod';
import type { DB } from './db/index.js';
import { users } from './db/schema.js';
import {
  ADMIN_GROUP, clearedCookie, cookieName, portalVerifier, readCookie, sessionCookie, sessions, type PlayerSession,
} from './auth.js';
import { devPortal, httpPortal, missingPortal, PortalUnavailableError, type Portal } from './portal.js';
import {
  HttpError, getUser, profile, pathInfo, playPath, prefetchPath, resumeGame, finishGame, listChallenges, createChallenge, playChallenge,
  rematch, friends, getChallenge, challengeView, otherPlayer, rememberUser,
} from './game.js';
import { unlockedAccessories, levelFromXp, MIN_SIZE, MAX_SIZE } from '@bradoku/core';
import { stopGenerator, useInlineGeneration } from './levels.js';

const SIZE = z.number().int().min(MIN_SIZE).max(MAX_SIZE);
const SUB = z.string().min(1).max(128);

export interface AppOptions {
  db: DB;
  /** Firma del cookie di sessione del gioco (almeno 32 caratteri in produzione). */
  sessionSecret: string;
  /** Portale whoru: emette i token di accesso e pubblica la chiave in /.well-known/jwks.json. */
  portalUrl: string;
  /** Id di questo servizio nel registro del portale: deve coincidere con `aud` del token. */
  serviceId?: string;
  /** Token per l'API amici del portale (stesso valore di SERVICE_TOKEN_BRADOKU sul portale). */
  portalServiceToken?: string;
  /** Solo sviluppo: /api/auth/dev per entrare senza portale. Ignorato in produzione. */
  devLogin?: boolean;
  production?: boolean;
  /** Origini ammesse per chiamate da un altro sito (con cookie). Di norma nessuna: stessa origine. */
  corsOrigin?: string[];
  staticDir?: string;
  logger?: boolean;
  /** Per i test: chiavi del portale al posto di quelle scaricate da /.well-known/jwks.json. */
  portalJwks?: JWTVerifyGetKey;
  /** Per i test: amici al posto dell'API del portale. */
  portal?: Portal;
  /** Genera i livelli sul thread principale invece che nel worker (test). */
  inlineGeneration?: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    session?: PlayerSession;
  }
}

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });
  const { db } = opts;
  const production = opts.production ?? false;
  const devLogin = !!opts.devLogin && !production;
  const portalUrl = opts.portalUrl.replace(/\/+$/, '');
  const serviceId = opts.serviceId ?? 'bradoku';
  const loginUrl = devLogin ? '/api/auth/dev?user=dev' : `${portalUrl}/launch/${serviceId}`;
  const cookie = cookieName(production);
  const session = sessions(opts.sessionSecret);
  const verifyPortalToken = portalVerifier({ portalUrl, serviceId, jwks: opts.portalJwks });
  const portal: Portal =
    opts.portal ??
    (opts.portalServiceToken ? httpPortal(portalUrl, opts.portalServiceToken) : devLogin ? devPortal(db) : missingPortal());

  if (opts.inlineGeneration) useInlineGeneration();
  app.addHook('onClose', async () => stopGenerator());
  // il primo quadro del Percorso pronto prima che arrivi qualcuno
  app.addHook('onReady', async () => prefetchPath(db, 1));

  if (opts.corsOrigin?.length) await app.register(cors, { origin: opts.corsOrigin, credentials: true });

  app.setErrorHandler((err, _req, reply) => {
    // 401: con l'indirizzo per entrare dal portale, così il frontend sa dove mandare il giocatore
    if (err instanceof HttpError) return reply.status(err.status).send({ error: err.message, ...(err.status === 401 ? { loginUrl } : {}) });
    if (err instanceof PortalUnavailableError) {
      app.log.warn(err.message);
      return reply.status(503).send({ error: 'Il portale non risponde: riprova tra poco' });
    }
    if (err instanceof z.ZodError) return reply.status(400).send({ error: err.issues[0]?.message ?? 'Dati non validi' });
    app.log.error(err);
    return reply.status(500).send({ error: 'Errore del server' });
  });

  /** Chi chiama: dalla sessione nel cookie. Senza, 401 (con l'indirizzo per entrare dal portale). */
  async function userId(req: FastifyRequest): Promise<string> {
    const token = readCookie(req.headers.cookie, cookie);
    const s = token ? await session.verify(token) : null;
    if (!s) throw new HttpError(401, 'Accesso richiesto');
    req.session = s;
    return s.sub;
  }
  const idParam = (req: FastifyRequest) => z.coerce.number().int().positive().parse((req.params as { id: string }).id);

  async function openSession(reply: FastifyReply, s: PlayerSession) {
    await rememberUser(db, { sub: s.sub, username: s.username });
    return reply
      .header('Set-Cookie', sessionCookie(cookie, await session.sign(s), production))
      .header('Cache-Control', 'no-store')
      .header('Referrer-Policy', 'no-referrer')
      .redirect('/');
  }

  // ---- accesso (identità da whoru)

  // Ritorno dal portale: scambia il token breve con la sessione del gioco e toglie il token dall'indirizzo.
  app.get('/api/auth/callback', async (req, reply) => {
    const q = z.object({ token: z.string().min(20).max(4096) }).safeParse(req.query);
    const s = q.success ? await verifyPortalToken(q.data.token) : null;
    // Token scaduto, già usato o non valido: si riparte dal portale
    if (!s) return reply.header('Cache-Control', 'no-store').redirect(loginUrl);
    return openSession(reply, s);
  });

  app.get('/api/auth/me', async (req, reply) => {
    await userId(req);
    const s = req.session!;
    return reply.header('Cache-Control', 'no-store').send({
      id: s.sub, username: s.username, isAdmin: s.groups.includes(ADMIN_GROUP), loginUrl, portalUrl,
    });
  });

  // Esce dal gioco (la sessione del portale resta: si esce da lì).
  app.post('/api/auth/logout', async (_req, reply) => reply.header('Set-Cookie', clearedCookie(cookie, production)).code(204).send());

  // Solo sviluppo (mai in produzione): entra senza portale. /api/auth/dev?user=mario&admin=1
  if (devLogin) {
    app.get('/api/auth/dev', async (req, reply) => {
      const q = z.object({ user: z.string().regex(/^[a-z0-9_]{1,32}$/).default('dev'), admin: z.string().optional() }).parse(req.query);
      return openSession(reply, { sub: `dev-${q.user}`, username: q.user, groups: q.admin ? [ADMIN_GROUP, 'membri'] : ['membri'] });
    });
  }

  // ---- profilo
  app.get('/api/me', async (req) => profile(db, await getUser(db, await userId(req))));

  app.put('/api/me/accessory', async (req) => {
    const u = await getUser(db, await userId(req));
    const { accessory } = z.object({ accessory: z.string() }).parse(req.body);
    if (!unlockedAccessories(levelFromXp(u.xp).level, u.medals).includes(accessory)) throw new HttpError(403, 'Accessorio non ancora sbloccato');
    await db.update(users).set({ accessory }).where(eq(users.id, u.id));
    return profile(db, { ...u, accessory });
  });

  // ---- Percorso: quadri uguali per tutti, griglia e difficoltà decise dal gioco
  app.get('/api/path', async (req) => pathInfo(db, await getUser(db, await userId(req))));
  app.post('/api/path/play', async (req) => playPath(db, await getUser(db, await userId(req))));

  // ---- partite

  app.get('/api/games/:id', async (req) => resumeGame(db, await getUser(db, await userId(req)), idParam(req)));

  app.post('/api/games/:id/finish', async (req) => {
    const body = z
      .object({ pieces: z.array(z.number().int()).max(MAX_SIZE), hints: z.number().int().min(0).max(999), lumi: z.boolean().default(false), clean: z.boolean() })
      .parse(req.body);
    return finishGame(db, await userId(req), idParam(req), body);
  });

  // ---- sfide: solo tra amici del portale (decisione whoru #28)
  app.get('/api/challenges', async (req) => listChallenges(db, await userId(req)));

  app.post('/api/challenges', async (req) => {
    const u = await getUser(db, await userId(req));
    const body = z.object({ opponent: SUB, n: SIZE.optional(), hard: z.boolean().optional(), fromGameId: z.number().int().optional() }).parse(req.body);
    if (body.opponent === u.id) throw new HttpError(400, 'Non puoi sfidare te stesso');
    const friend = await portal.check(u.id, body.opponent);
    if (!friend) throw new HttpError(403, 'Puoi sfidare solo i tuoi amici del portale');
    return createChallenge(db, u, { opponent: friend, n: body.n, want: body.hard ? 'difficile+' : 'normale', fromGameId: body.fromGameId });
  });

  app.get('/api/challenges/:id', async (req) => {
    const id = await userId(req);
    return challengeView(db, id, await getChallenge(db, id, idParam(req)));
  });

  app.post('/api/challenges/:id/play', async (req) => playChallenge(db, await getUser(db, await userId(req)), idParam(req)));

  app.post('/api/challenges/:id/rematch', async (req) => {
    const u = await getUser(db, await userId(req));
    const c = await getChallenge(db, u.id, idParam(req));
    const friend = await portal.check(u.id, otherPlayer(c, u.id));
    if (!friend) throw new HttpError(403, 'Non siete più amici nel portale');
    return rematch(db, u, c, friend);
  });

  app.get('/api/friends', async (req) => {
    const id = await userId(req);
    return friends(db, id, await portal.friends(id));
  });

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
