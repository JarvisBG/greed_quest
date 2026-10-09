// Connexion à la base : PostgreSQL si DATABASE_URL est fourni (prod), sinon PGlite embarqué (dev, tests).
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import * as schema from './schema.js';

export type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Base ou transaction en cours : les dépôts acceptent les deux. */
export type DbOrTx = Db | Tx;

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

export interface DbHandle {
  db: Db;
  close(): Promise<void>;
}

/**
 * `url` : chaîne postgres:// (prod) ; sinon `dataDir` pour un PGlite persistant sur disque,
 * ou rien pour une base en mémoire (tests). Les migrations sont appliquées à l'ouverture.
 */
export async function openDb(opts: { url?: string | undefined; dataDir?: string | undefined } = {}): Promise<DbHandle> {
  if (opts.url) {
    const pool = new pg.Pool({ connectionString: opts.url });
    const db = drizzlePg(pool, { schema });
    await migratePg(db, { migrationsFolder });
    return { db: db as unknown as Db, close: () => pool.end() };
  }
  // PGlite ne crée que le dernier dossier du chemin (ENOENT si `.data/` manque).
  if (opts.dataDir) mkdirSync(opts.dataDir, { recursive: true });
  const client = new PGlite(opts.dataDir);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder });
  return { db: db as unknown as Db, close: () => client.close() };
}
