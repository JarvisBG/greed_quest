// Construction du serveur Fastify. Les dépendances (base, horloge, aléa) sont injectées pour les tests.
import Fastify, { type FastifyInstance } from 'fastify';
import type { Db } from './db/client.js';

export interface AppDeps {
  db: Db;
  /** Horloge réelle (ms) : remplaçable en test. L'horloge de jeu en découle (gameClock). */
  now?: () => number;
  logger?: boolean;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: deps.logger ?? false });
  app.get('/sante', async () => ({ ok: true }));
  return app;
}
