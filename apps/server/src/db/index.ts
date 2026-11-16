/**
 * Database: Postgres se c'è DATABASE_URL (produzione), altrimenti PGlite
 * (Postgres incorporato: su disco in una cartella, oppure in memoria per i test).
 */
import { drizzle as drizzlePg, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle as drizzleLite } from 'drizzle-orm/pglite';
import postgres from 'postgres';
import { PGlite } from '@electric-sql/pglite';
import * as schema from './schema.js';

export type DB = PostgresJsDatabase<typeof schema>;

/** Database creato dalla versione con account propri (id numerico e password): va ricreato. */
const OLD_SCHEMA = `SELECT 1 AS old FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_hash'`;
const OLD_SCHEMA_ERROR =
  'Database della versione con account propri (prima di whoru): va ricreato. In locale cancella apps/server/.data/.';

export async function openDatabase(opts: { url?: string; dataDir?: string } = {}): Promise<{ db: DB; close: () => Promise<void> }> {
  if (opts.url) {
    const client = postgres(opts.url, { max: 5, onnotice: () => {} });
    if ((await client.unsafe(OLD_SCHEMA)).length) throw new Error(OLD_SCHEMA_ERROR);
    await client.unsafe(schema.MIGRATION);
    return { db: drizzlePg(client, { schema }), close: () => client.end() };
  }
  const client = opts.dataDir ? new PGlite(opts.dataDir) : new PGlite();
  if ((await client.query(OLD_SCHEMA)).rows.length) throw new Error(OLD_SCHEMA_ERROR);
  await client.exec(schema.MIGRATION);
  const db = drizzleLite(client, { schema }) as unknown as DB;
  return { db, close: () => client.close() };
}
