// Configuration lue dans l'environnement (voir .env.example).
export interface Config {
  port: number;
  host: string;
  /** postgres://… en prod ; vide = PGlite embarqué. */
  databaseUrl: string | undefined;
  /** Dossier du PGlite persistant (dev) ; vide = en mémoire. */
  pgliteDir: string | undefined;
  /** Secret de signature des jetons (sessions, licences). */
  secret: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? '0.0.0.0',
    databaseUrl: env.DATABASE_URL || undefined,
    pgliteDir: env.PGLITE_DIR || undefined,
    secret: env.GQ_SECRET ?? 'dev-secret-a-changer',
  };
}
