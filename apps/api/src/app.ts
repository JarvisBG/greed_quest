// Construction du serveur Fastify. Les dépendances (base, horloge, aléa) sont injectées pour les tests.
import type { Rng } from '@gq/engine';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Session } from './auth/tokens.js';
import { Tokens } from './auth/tokens.js';
import { Bus } from './core/bus.js';
import { Runner, cryptoRng } from './core/runner.js';
import type { Db } from './db/client.js';
import { Refus } from './errors.js';
import { adminRoutes } from './routes/admin.js';
import { staffRoutes } from './routes/staff.js';

export interface AppDeps {
  db: Db;
  secret?: string;
  /** Code de l'organisateur pour créer une partie. */
  adminCode?: string;
  /** Horloge réelle (ms) : remplaçable en test. L'horloge de jeu en découle (gameClock). */
  now?: () => number;
  rng?: Rng;
  logger?: boolean;
}

export interface Services {
  db: Db;
  bus: Bus;
  runner: Runner;
  tokens: Tokens;
  adminCode: string;
  now: () => number;
  rng: Rng;
}

declare module 'fastify' {
  interface FastifyInstance {
    gq: Services;
  }
  interface FastifyRequest {
    session: Session | null;
  }
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: deps.logger ?? false });
  const now = deps.now ?? Date.now;
  const rng = deps.rng ?? cryptoRng;
  const bus = new Bus();
  const tokens = new Tokens(deps.secret ?? 'dev-secret-a-changer');
  app.decorate('gq', {
    db: deps.db,
    bus,
    runner: new Runner(deps.db, bus, now, rng),
    tokens,
    adminCode: deps.adminCode ?? 'admin-dev',
    now,
    rng,
  });

  app.decorateRequest('session', null);
  app.addHook('onRequest', async (req) => {
    const h = req.headers.authorization;
    req.session = h?.startsWith('Bearer ') ? tokens.verify(h.slice(7)) : null;
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof Refus) return reply.status(err.status).send({ ok: false, code: err.code, message: err.message });
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status < 500) return reply.status(status).send({ ok: false, code: 'requete_invalide', message: 'Requête invalide' });
    app.log.error(err);
    return reply.status(500).send({ ok: false, code: 'erreur_serveur', message: 'Erreur du serveur, réessaie' });
  });

  app.get('/sante', async () => ({ ok: true }));
  await app.register(adminRoutes);
  await app.register(staffRoutes);
  return app;
}
