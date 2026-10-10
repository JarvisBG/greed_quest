// Cartes objets (amendement 2026-10-10) : Ticket de la Fortune, Boussole du chercheur, Coffre scellé.
// La Pépite d'or se revend à Masadora (boutique.ts), le Second souffle s'utilise au scan (scan.ts),
// le Voile d'ombre agit seul contre Radar et Regard (sorts.ts).
import { gratterTicket, utiliserBoussole, utiliserCoffre, type Book } from '@gq/engine';
import { ObjetIntent } from '@gq/shared';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { requireRole } from '../auth/guard.js';
import { ENGAGEE, engagedItems } from '../core/echanges.js';
import { paramsOf } from '../core/params.js';
import { recordPosition } from '../core/position.js';
import { actionPatch, isLivreGele, loadBook, loadJoueur, saveBooks, updateJoueur } from '../core/state.js';
import { balises } from '../db/schema.js';
import { introuvable } from '../errors.js';
import { refus, send } from '../http.js';
import { parse } from '../validation.js';

type P = { Params: { partieId: string } };

const NOMS = { ticket: 'Ticket de la Fortune', boussole: 'Boussole du chercheur', coffre: 'Coffre scellé' } as const;
const DIRECTIONS = { N: 'le nord', NE: 'le nord-est', E: 'l’est', SE: 'le sud-est', S: 'le sud', SO: 'le sud-ouest', O: 'l’ouest', NO: 'le nord-ouest' } as const;

export async function objetsRoutes(app: FastifyInstance) {
  const { runner } = app.gq;

  app.post<P>('/parties/:partieId/objet', async (req, reply) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    const input = parse(ObjetIntent, req.body);
    const r = await runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
      const j = await loadJoueur(c.tx, s.sub);
      if (!j) throw introuvable('Joueur');
      const deny = async (code: string, message: string) => {
        await c.log({ action: 'objet', resultat: 'refus', details: { objet: input.objet, code } });
        return refus(code, message);
      };
      const position = input.objet === 'boussole' ? await recordPosition(c, j, input.position) : j.position;
      const book = await loadBook(c.tx, j.id);
      const engagees = await engagedItems(c.tx, partieId, j.id, c.now);
      if (engagees.has(input.itemId) || (input.objet === 'coffre' && engagees.has(input.carteItemId))) return deny(ENGAGEE.code, ENGAGEE.message);
      if (await isLivreGele(c.tx, j.id)) return deny('livre_gele', 'Ton Book est gelé : va voir le Game Master'); // RG-13.1
      const joueur = { status: j.statut, book };

      let after: Book;
      let jenny = j.jenny;
      let resultat: Record<string, unknown>;
      switch (input.objet) {
        case 'ticket': {
          const o = gratterTicket({ gameState: c.partie.etat }, joueur, input.itemId, c.rng);
          if (!o.ok) return deny(o.code, o.message);
          after = o.book;
          jenny += o.gain;
          resultat = { gain: o.gain };
          break;
        }
        case 'boussole': {
          const rows = await c.tx.select().from(balises).where(and(eq(balises.partieId, partieId)));
          const o = utiliserBoussole(
            { gameState: c.partie.etat, now: c.now },
            { ...joueur, position, historiqueTirages: j.historiqueTirages },
            input.itemId,
            rows.map((b) => ({ id: b.id, state: b.etat, type: b.type, position: b.position })),
          );
          if (!o.ok) return deny(o.code, o.message);
          after = o.book;
          // Une direction seulement, jamais une distance ni une position (RG-10.12).
          resultat = { direction: o.direction, message: `L’aiguille pointe vers ${DIRECTIONS[o.direction]}` };
          break;
        }
        case 'coffre': {
          const p = await paramsOf(c.tx, c.partie);
          const o = utiliserCoffre({ gameState: c.partie.etat, now: c.now, dureeMs: p.coffreMin * 60_000 }, joueur, input.itemId, input.carteItemId);
          if (!o.ok) return deny(o.code, o.message);
          after = o.book;
          resultat = { carteItemId: input.carteItemId, jusqua: o.jusqua };
          break;
        }
      }
      await saveBooks(c.tx, partieId, c.now, [{ joueurId: j.id, before: book, after }]);
      await updateJoueur(c.tx, j.id, { ...actionPatch(j, c.now), jenny });
      await c.log({ action: 'objet', resultat: 'ok', details: { objet: input.objet, itemId: input.itemId, ...resultat } });
      return { ok: true as const, objet: input.objet, nom: NOMS[input.objet], jenny, ...resultat };
    });
    return send(reply, r);
  });
}
