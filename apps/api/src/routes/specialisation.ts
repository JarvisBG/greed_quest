// Pouvoirs de Spécialisation (RG-5.4, amendement 2026-10-10) : Zetsu, Fortune, Alchimie. Bandit passe par POST /sort
// (Vol avec source « pouvoir »). Recharge `rechargeSpeMin` (40 min) après usage.
import { activerFortune, activerZetsu, alchimie } from '@gq/engine';
import { SpecialisationIntent } from '@gq/shared';
import type { FastifyInstance } from 'fastify';
import { requireRole } from '../auth/guard.js';
import { ENGAGEE, engagedItems } from '../core/echanges.js';
import { paramsOf } from '../core/params.js';
import { actionPatch, circulation, isLivreGele, limitesOf, loadBook, loadCatalogue, loadJoueur, saveBooks, updateJoueur } from '../core/state.js';
import { introuvable } from '../errors.js';
import { refus, send } from '../http.js';
import { newId } from '../ids.js';
import { parse } from '../validation.js';

type P = { Params: { partieId: string } };

export async function specialisationRoutes(app: FastifyInstance) {
  const { runner } = app.gq;

  app.post<P>('/parties/:partieId/specialisation', async (req, reply) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    const input = parse(SpecialisationIntent, req.body);
    const r = await runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
      const j = await loadJoueur(c.tx, s.sub);
      if (!j) throw introuvable('Joueur');
      const deny = async (code: string, message: string) => {
        await c.log({ action: 'specialisation', resultat: 'refus', details: { pouvoir: input.pouvoir, code } });
        return refus(code, message);
      };
      const p = await paramsOf(c.tx, c.partie);
      const ctx = { now: c.now, gameState: c.partie.etat, rechargeMs: p.rechargeSpeMin * 60_000 };
      const joueur = { pouvoirSpe: j.pouvoirSpe, speA: j.speA, status: j.statut };
      switch (input.pouvoir) {
        case 'zetsu': {
          const o = activerZetsu({ ...ctx, dureeMs: p.zetsuMin * 60_000 }, joueur);
          if (!o.ok) return deny(o.code, o.message);
          await updateJoueur(c.tx, j.id, { ...actionPatch(j, c.now), speA: o.speA, zetsuJusqua: o.zetsuJusqua });
          await c.log({ action: 'specialisation', resultat: 'ok', details: { pouvoir: 'zetsu', jusqua: o.zetsuJusqua } });
          return { ok: true as const, pouvoir: 'zetsu' as const, dureeMs: o.zetsuJusqua - c.now };
        }
        case 'fortune': {
          const o = activerFortune(ctx, { ...joueur, fortuneArmee: j.fortuneArmee });
          if (!o.ok) return deny(o.code, o.message);
          await updateJoueur(c.tx, j.id, { ...actionPatch(j, c.now), speA: o.speA, fortuneArmee: true });
          await c.log({ action: 'specialisation', resultat: 'ok', details: { pouvoir: 'fortune' } });
          return { ok: true as const, pouvoir: 'fortune' as const };
        }
        case 'alchimie': {
          if ((await engagedItems(c.tx, partieId, j.id, c.now)).has(input.doublonItemId)) return deny(ENGAGEE.code, ENGAGEE.message);
          if (await isLivreGele(c.tx, j.id)) return deny('livre_gele', 'Ton Book est gelé : va voir le Game Master'); // RG-13.1
          const [book, cat, n] = await Promise.all([loadBook(c.tx, j.id), loadCatalogue(c.tx, partieId), circulation(c.tx, partieId)]);
          const limites = limitesOf(p);
          const o = alchimie(
            { ...ctx, newId, designees: cat.designees, rangDe: cat.rangDe, sousLimite: (id) => (n.get(id) ?? 0) < limites[cat.rangDe(id)] }, // RG-8.2
            { ...joueur, book },
            input.doublonItemId,
            input.carteVoulueId,
          );
          if (!o.ok) return deny(o.code, o.message);
          await saveBooks(c.tx, partieId, c.now, [{ joueurId: j.id, before: book, after: o.book }]);
          await updateJoueur(c.tx, j.id, { ...actionPatch(j, c.now), speA: o.speA });
          await c.log({ action: 'specialisation', resultat: o.resultat, details: { pouvoir: 'alchimie', doublon: input.doublonItemId, carteId: o.carte?.cardId ?? null } });
          return o.carte
            ? { ok: true as const, pouvoir: 'alchimie' as const, resultat: o.resultat, carte: { itemId: o.carte.id, carteId: o.carte.cardId, nom: cat.nomDe(o.carte.cardId), rang: cat.rangDe(o.carte.cardId) } }
            : { ok: true as const, pouvoir: 'alchimie' as const, resultat: o.resultat, message: 'L’alchimie échoue : ce doublon était une contrefaçon' };
        }
      }
    });
    return send(reply, r);
  });
}
