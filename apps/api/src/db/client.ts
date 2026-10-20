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
 * `ssl` : connexion chiffrée (Supabase), sans vérifier le certificat (celui du pooler Supabase n'est pas signé
 * par une autorité connue de Node).
 */
export async function openDb(opts: { url?: string | undefined; dataDir?: string | undefined; ssl?: boolean } = {}): Promise<DbHandle> {
  if (opts.url) {
    const pool = new pg.Pool({
      connectionString: opts.url,
      ...(opts.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
      // Offre gratuite : le pooler de Supabase (mode session) n'ouvre qu'une quinzaine de connexions réelles.
      max: 8,
      idleTimeoutMillis: 60_000,
      connectionTimeoutMillis: 15_000,
      // Une requête bloquée ne garde pas le verrou d'une partie indéfiniment.
      query_timeout: 20_000,
      keepAlive: true,
    });
    // Sans écouteur, une connexion au repos coupée par Supabase (maintenance, redémarrage du pooler) ferait tomber
    // tout le serveur ; le pool la remplace à la requête suivante.
    pool.on('error', (e) => console.error('Base : connexion perdue, elle sera rouverte', e.message));
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
