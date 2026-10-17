// Création d'une partie par l'organisateur (code admin), avec son premier GM.
import { conseilCartesDesignees, tirerCatalogue } from '@gq/engine';
import { BANQUE_CARTES, PartieCreate } from '@gq/shared';
import { eq } from 'drizzle-orm';
import { paramsOf, settingsOf } from '../core/params.js';
import type { FastifyInstance } from 'fastify';
import { hashCode } from '../auth/tokens.js';
import { writeLog } from '../core/journal.js';
import { createPartie, seedDemoContent } from '../db/seed.js';
import { cartes, parties, staff } from '../db/schema.js';
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
      else {
        // RG-8.1 (amendement 2026-10-17) : la plateforme propose tout de suite un catalogue tiré au hasard, avec le
        // nombre de cartes conseillé (durée du préréglage, joueurs attendus) ; le GM peut retirer ou retoucher.
        const [p] = await tx.select().from(parties).where(eq(parties.id, partieId));
        const n = conseilCartesDesignees(body.joueursAttendus, (await paramsOf(tx, p!)).dureePartieMin);
        const tirage = tirerCatalogue(BANQUE_CARTES, n, app.gq.rng);
        await tx.insert(cartes).values(tirage.map((c) => ({ id: newId(), partieId, numero: c.numero, nom: c.nom, rang: c.rang, texte: c.texte })));
        const settings = { ...settingsOf(p!), cartesDesignees: { mode: 'verrouille' as const, value: tirage.length } };
        await tx.update(parties).set({ parametres: settings }).where(eq(parties.id, partieId));
      }
      const gmId = newId();
      await tx.insert(staff).values({ id: gmId, partieId, nom: body.gm.nom, role: 'gm', codeHash: hashCode(body.gm.code) });
      await writeLog(tx, partieId, 0, { type: 'systeme', id: null }, {
        action: 'creation_partie',
        resultat: 'ok',
        details: { nom: body.nom, prereglage: body.prereglage, gm: body.gm.nom, joueursAttendus: body.joueursAttendus },
      });
      return { ok: true, partieId, token: app.gq.tokens.issue({ role: 'gm', sub: gmId, partieId }) };
    });
  });
}
