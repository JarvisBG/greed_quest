// Écran géant (tracker) : état complet à l'ouverture (public, comme la room tracker), puis temps réel.
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { balisesParZone, ecranSnapshot } from '../core/ecran.js';
import { SYSTEME } from '../core/journal.js';
import { zones } from '../db/schema.js';

type P = { Params: { partieId: string } };

export async function ecranRoutes(app: FastifyInstance) {
  app.get<P>('/parties/:partieId/ecran', async (req) =>
    app.gq.runner.run(req.params.partieId, SYSTEME, async (c) => ({ ok: true as const, ...(await ecranSnapshot(c)) })),
  );

  // Carte de l'île de l'app joueur (amendement du 2026-10-10) : contours des zones et nombre de balises
  // actives par zone, comme l'écran (RG-6.5 : jamais lesquelles ni où) ; ni heatmap ni position (RG-10.12).
  app.get<P>('/parties/:partieId/carte', async (req) =>
    app.gq.runner.run(req.params.partieId, SYSTEME, async (c) => ({
      ok: true as const,
      zones: await c.tx.select({ id: zones.id, nom: zones.nom, type: zones.type, polygone: zones.polygone }).from(zones).where(eq(zones.partieId, c.partie.id)),
      balisesParZone: await balisesParZone(c),
    })),
  );
}
