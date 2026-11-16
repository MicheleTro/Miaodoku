import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { openDatabase } from './db/index.js';
import { buildApp } from './app.js';

const production = process.env.NODE_ENV === 'production';

// Variabili d'ambiente, controllate all'avvio: in produzione un valore mancante ferma il server.
const env = z
  .object({
    PORT: z.coerce.number().int().positive().default(3000),
    /** Postgres; se assente, PGlite (Postgres incorporato) in PGLITE_DIR. */
    DATABASE_URL: z.string().min(1).optional(),
    PGLITE_DIR: z.string().min(1).optional(),
    /** Firma del cookie di sessione del gioco (almeno 32 caratteri). */
    SESSION_SECRET: production ? z.string().min(32) : z.string().min(32).default('solo-per-sviluppo-cambiami-0123456789'),
    /** Portale whoru: da lì arriva l'identità (token firmato) e la rete di amici. */
    PORTAL_URL: z.string().url().default('https://slothymic.com'),
    /** Id di questo servizio nel registro del portale (= `aud` del token). */
    SERVICE_ID: z.string().min(1).default('bradoku'),
    /** Token per l'API amici del portale (= SERVICE_TOKEN_BRADOKU sul portale). */
    PORTAL_SERVICE_TOKEN: z.string().min(32).optional(),
    /** Solo sviluppo: /api/auth/dev?user=mario per entrare senza portale. Ignorato in produzione. */
    DEV_LOGIN: z.string().optional(),
    /** Origini ammesse da un altro sito, separate da virgola (di norma nessuna). */
    CORS_ORIGIN: z.string().optional(),
    STATIC_DIR: z.string().optional(),
  })
  .parse(process.env);

if (production && !env.PORTAL_SERVICE_TOKEN) console.warn('PORTAL_SERVICE_TOKEN non impostato: le sfide tra amici non funzionano');

const { db } = await openDatabase({
  url: env.DATABASE_URL,
  dataDir: env.DATABASE_URL ? undefined : (env.PGLITE_DIR ?? fileURLToPath(new URL('../.data/pglite', import.meta.url))),
});
const app = await buildApp({
  db,
  sessionSecret: env.SESSION_SECRET,
  portalUrl: env.PORTAL_URL,
  serviceId: env.SERVICE_ID,
  portalServiceToken: env.PORTAL_SERVICE_TOKEN,
  devLogin: env.DEV_LOGIN === 'true',
  production,
  corsOrigin: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',').map((o) => o.trim()) : undefined,
  staticDir: env.STATIC_DIR ?? fileURLToPath(new URL('../../web/dist', import.meta.url)),
  logger: true,
});
await app.listen({ port: env.PORT, host: '0.0.0.0' });
console.log(`Bradoku in ascolto su http://localhost:${env.PORT} (${env.DATABASE_URL ? 'Postgres' : 'PGlite locale'}, portale ${env.PORTAL_URL})`);
