import { fileURLToPath } from 'node:url';
import { openDatabase } from './db/index.js';
import { buildApp } from './app.js';

const env = process.env;
const port = Number(env.PORT ?? 3000);
const jwtSecret = env.JWT_SECRET ?? 'solo-per-sviluppo-cambiami';
if (!env.JWT_SECRET) console.warn('JWT_SECRET non impostato: uso un segreto di sviluppo');

const { db } = await openDatabase({
  url: env.DATABASE_URL,
  dataDir: env.DATABASE_URL ? undefined : (env.PGLITE_DIR ?? fileURLToPath(new URL('../.data/pglite', import.meta.url))),
});
const app = await buildApp({
  db,
  jwtSecret,
  corsOrigin: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',') : true,
  staticDir: env.STATIC_DIR ?? fileURLToPath(new URL('../../web/dist', import.meta.url)),
  logger: true,
});
await app.listen({ port, host: '0.0.0.0' });
console.log(`Bradoku in ascolto su http://localhost:${port} (${env.DATABASE_URL ? 'Postgres' : 'PGlite locale'})`);
