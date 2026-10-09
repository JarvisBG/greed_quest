// Écran géant (tracker) : état complet à l'ouverture (public, comme la room tracker), puis temps réel.
import type { FastifyInstance } from 'fastify';
import { SYSTEME } from '../core/journal.js';
import { ecranSnapshot } from '../core/ecran.js';

type P = { Params: { partieId: string } };

export async function ecranRoutes(app: FastifyInstance) {
  app.get<P>('/parties/:partieId/ecran', async (req) =>
    app.gq.runner.run(req.params.partieId, SYSTEME, async (c) => ({ ok: true as const, ...(await ecranSnapshot(c)) })),
  );
}
