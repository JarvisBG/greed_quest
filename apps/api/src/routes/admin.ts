// Création d'une partie par l'organisateur (code admin), avec son premier GM.
import { PartieCreate } from '@gq/shared';
import type { FastifyInstance } from 'fastify';
import { hashCode } from '../auth/tokens.js';
import { writeLog } from '../core/journal.js';
import { createPartie, seedDemoContent } from '../db/seed.js';
import { staff } from '../db/schema.js';
import { Refus } from '../errors.js';
import { newId } from '../ids.js';
import { parse } from '../validation.js';

export async function adminRoutes(app: FastifyInstance) {
  app.post('/admin/parties', async (req) => {
    if (req.headers['x-code-admin'] !== app.gq.adminCode) throw new Refus('interdit', 'Code organisateur invalide', 403);
    const body = parse(PartieCreate, req.body);
    return app.gq.db.transaction(async (tx) => {
      const partieId = await createPartie(tx, { nom: body.nom, prereglage: body.prereglage });
      if (body.demo) await seedDemoContent(tx, partieId);
      const gmId = newId();
      await tx.insert(staff).values({ id: gmId, partieId, nom: body.gm.nom, role: 'gm', codeHash: hashCode(body.gm.code) });
      await writeLog(tx, partieId, 0, { type: 'systeme', id: null }, {
        action: 'creation_partie',
        resultat: 'ok',
        details: { nom: body.nom, prereglage: body.prereglage, gm: body.gm.nom },
      });
      return { ok: true, partieId, token: app.gq.tokens.issue({ role: 'gm', sub: gmId, partieId }) };
    });
  });
}
