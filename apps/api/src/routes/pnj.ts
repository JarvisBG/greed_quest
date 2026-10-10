// Arbitres et GM (RG-3) : sanctions (RG-15, RG-15.1, 15.2), corrections du GM, checkpoints PNJ,
// expertise d'Antokiba (RG-8.8). Motif obligatoire pour toute correction ou sanction (RG-3.1).
import { BONUS_MATERIALISATION, addItem, draw, expertise, removeItem, type Book } from '@gq/engine';
import {
  AnnulationGainsIntent,
  AvertissementIntent,
  CheckpointCreation,
  CheckpointReussite,
  CorrectionJennyIntent,
  CorrectionLivreIntent,
  DisqualificationIntent,
  ExpertiseIntent,
  GelSanctionIntent,
} from '@gq/shared';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { STAFF, requireRole } from '../auth/guard.js';
import type { Role } from '../auth/tokens.js';
import { verifyLicence } from '../core/licence.js';
import { paramsOf } from '../core/params.js';
import type { ActionCtx } from '../core/runner.js';
import { catalogForDraw, limitesOf, loadBook, loadCatalogue, loadJoueur, saveBooks, updateJoueur, type JoueurRow } from '../core/state.js';
import { checkpoints, zones } from '../db/schema.js';
import { introuvable } from '../errors.js';
import { refus, send } from '../http.js';
import { newId } from '../ids.js';
import { parse } from '../validation.js';

type P = { Params: { partieId: string } };
type PI = { Params: { partieId: string; id: string } };

export const SANCTION_GEL_MS = 5 * 60_000; // RG-3 : le PNJ peut geler 5 min


export async function pnjRoutes(app: FastifyInstance) {
  const { runner } = app.gq;

  /** Action de l'équipe sur un joueur de la partie, journalisée sous son nom. */
  function onPlayer<T extends { ok: boolean }>(
    req: FastifyRequest<P>,
    roles: Role[],
    joueurId: string,
    fn: (c: ActionCtx, j: JoueurRow) => Promise<T>,
  ) {
    const s = requireRole(req, req.params.partieId, ...roles);
    return runner.run(req.params.partieId, { type: s.role === 'gm' ? 'gm' : 'pnj', id: s.sub }, async (c) => {
      const j = await loadJoueur(c.tx, joueurId);
      if (!j || j.partieId !== c.partie.id) throw introuvable('Joueur');
      return fn(c, j);
    });
  }

  /** RG-15.1 : toute sanction est journalisée et notifiée au joueur avec son motif. */
  const notify = (c: ActionCtx, j: JoueurRow, type: string, motif: string, extra: Record<string, unknown> = {}) =>
    c.emit({ type: 'joueur', id: j.id }, 'sanction', { type, motif, ...extra });

  app.post<P>('/parties/:partieId/sanctions/avertissement', async (req) => {
    const input = parse(AvertissementIntent, req.body);
    return onPlayer(req, STAFF, input.joueurId, async (c, j) => {
      await c.log({ action: 'avertissement', resultat: 'ok', motif: input.motif, details: { joueurId: j.id } });
      notify(c, j, 'avertissement', input.motif);
      return { ok: true as const };
    });
  });

  app.post<P>('/parties/:partieId/sanctions/gel', async (req, reply) => {
    const input = parse(GelSanctionIntent, req.body);
    const r = await onPlayer(req, STAFF, input.joueurId, async (c, j) => {
      if (j.statut === 'disqualifie' || j.statut === 'abandon') return refus('joueur_exclu', 'Ce joueur ne joue plus');
      const fin = c.now + SANCTION_GEL_MS;
      await updateJoueur(c.tx, j.id, { statut: 'gele', geleJusqua: Math.max(fin, j.geleJusqua ?? 0) });
      await c.log({ action: 'gel_sanction', resultat: 'ok', motif: input.motif, details: { joueurId: j.id, jusqua: fin } });
      notify(c, j, 'gel', input.motif, { jusqua: fin });
      return { ok: true as const, jusqua: fin };
    });
    return send(reply, r);
  });

  // RG-15 « photo de balise » : gains tirés sur cette balise annulés + gel 5 min.
  app.post<P>('/parties/:partieId/sanctions/annulation-gains', async (req) => {
    const input = parse(AnnulationGainsIntent, req.body);
    return onPlayer(req, STAFF, input.joueurId, async (c, j) => {
      const before = await loadBook(c.tx, j.id);
      const visees = before.items.filter((i) => i.kind === 'carte' && i.origine.type === 'balise' && i.origine.baliseId === input.baliseId);
      const after = visees.reduce((b, i) => removeItem(b, i.id, { cause: 'sanction', a: c.now }), before);
      await saveBooks(c.tx, c.partie.id, c.now, [{ joueurId: j.id, before, after }]);
      const fin = c.now + SANCTION_GEL_MS;
      await updateJoueur(c.tx, j.id, { statut: 'gele', geleJusqua: Math.max(fin, j.geleJusqua ?? 0) });
      await c.log({ action: 'annulation_gains', resultat: 'ok', motif: input.motif, details: { joueurId: j.id, baliseId: input.baliseId, retirees: visees.length } });
      notify(c, j, 'annulation_gains', input.motif, { retirees: visees.length, jusqua: fin });
      return { ok: true as const, retirees: visees.length };
    });
  });

  // RG-15.2 : disqualifié, il perd son Livre ; ses cartes retournent au stock (GM seulement, RG-3).
  app.post<P>('/parties/:partieId/sanctions/disqualification', async (req) => {
    const input = parse(DisqualificationIntent, req.body);
    return onPlayer(req, ['gm'], input.joueurId, async (c, j) => {
      const before = await loadBook(c.tx, j.id);
      const after: Book = before.items.reduce(
        (b, i) => removeItem(b, i.id, i.kind === 'carte' ? { cause: 'sanction', a: c.now } : undefined),
        before,
      );
      await saveBooks(c.tx, c.partie.id, c.now, [{ joueurId: j.id, before, after }]);
      await updateJoueur(c.tx, j.id, { statut: 'disqualifie' });
      await c.log({ action: 'disqualification', resultat: 'ok', motif: input.motif, details: { joueurId: j.id, cartes: before.items.length } });
      notify(c, j, 'disqualification', input.motif);
      return { ok: true as const };
    });
  });

  // Corrections du GM (RG-3 : « corriger Livre »), toujours motivées.
  app.post<P>('/parties/:partieId/corrections/livre', async (req, reply) => {
    const input = parse(CorrectionLivreIntent, req.body);
    const s = req.session;
    const r = await onPlayer(req, ['gm'], input.joueurId, async (c, j) => {
      const cat = await loadCatalogue(c.tx, c.partie.id);
      let after = await loadBook(c.tx, j.id);
      const before = after;
      if (input.retirerItemId) {
        if (!after.items.some((i) => i.id === input.retirerItemId)) return refus('element_absent', 'Élément absent du Livre');
        after = removeItem(after, input.retirerItemId, { cause: 'sanction', a: c.now });
      }
      if (input.ajouterCarteId) {
        if (!cat.cartes.some((x) => x.id === input.ajouterCarteId)) return refus('carte_inconnue', 'Carte inconnue');
        after = addItem(after, { kind: 'carte', id: newId(), cardId: input.ajouterCarteId, origine: { type: 'correction_gm', par: s!.sub }, obtenuA: c.now });
      }
      await saveBooks(c.tx, c.partie.id, c.now, [{ joueurId: j.id, before, after }]);
      await c.log({ action: 'correction_livre', resultat: 'ok', motif: input.motif, details: { joueurId: j.id, ajout: input.ajouterCarteId ?? null, retrait: input.retirerItemId ?? null } });
      c.emit({ type: 'joueur', id: j.id }, 'correction', { motif: input.motif });
      return { ok: true as const };
    });
    return send(reply, r);
  });

  app.post<P>('/parties/:partieId/corrections/jenny', async (req) => {
    const input = parse(CorrectionJennyIntent, req.body);
    return onPlayer(req, ['gm'], input.joueurId, async (c, j) => {
      const jenny = Math.max(0, j.jenny + input.delta);
      await updateJoueur(c.tx, j.id, { jenny });
      await c.log({ action: 'correction_jenny', resultat: 'ok', motif: input.motif, details: { joueurId: j.id, delta: input.delta, jenny } });
      c.emit({ type: 'joueur', id: j.id }, 'correction', { motif: input.motif, jenny });
      return { ok: true as const, jenny };
    });
  });

  // --- Checkpoints PNJ ---

  app.post<P>('/parties/:partieId/checkpoints', async (req, reply) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'gm');
    const input = parse(CheckpointCreation, req.body);
    const r = await runner.run(partieId, { type: 'gm', id: s.sub }, async (c) => {
      const [z] = await c.tx.select().from(zones).where(and(eq(zones.id, input.zoneId), eq(zones.partieId, partieId)));
      if (!z) return refus('zone_inconnue', 'Zone inconnue');
      const id = newId();
      await c.tx.insert(checkpoints).values({ id, partieId, zoneId: z.id, defi: input.defi, cartes: input.cartes, arbitreId: input.arbitreId ?? null });
      await c.log({ action: 'checkpoint_creation', resultat: 'ok', details: { id, zoneId: z.id, cartes: input.cartes.length } });
      return { ok: true as const, id };
    });
    return send(reply, r);
  });

  app.get<P>('/parties/:partieId/checkpoints', async (req) => {
    requireRole(req, req.params.partieId, ...STAFF);
    return { ok: true, checkpoints: await app.gq.db.select().from(checkpoints).where(eq(checkpoints.partieId, req.params.partieId)) };
  });

  // Défi réussi : le PNJ scanne la licence (RG-5.2) et donne une carte du checkpoint et/ou des jenny.
  // RG-5.4 Matérialisation : +1 tirage bonus plafonné au rang C.
  app.post<PI>('/parties/:partieId/checkpoints/:id/reussite', async (req, reply) => {
    const { partieId, id } = req.params;
    const s = requireRole(req, partieId, ...STAFF);
    const input = parse(CheckpointReussite, req.body);
    const r = await runner.run(partieId, { type: s.role === 'gm' ? 'gm' : 'pnj', id: s.sub }, async (c) => {
      if (c.partie.etat !== 'en_cours' && c.partie.etat !== 'phase_finale') return refus('partie_fermee', 'La partie n’est pas en cours');
      const [cp] = await c.tx.select().from(checkpoints).where(and(eq(checkpoints.id, id), eq(checkpoints.partieId, partieId)));
      if (!cp) throw introuvable('Checkpoint');
      const lic = await verifyLicence(c.tx, partieId, input.licence, c.realNow);
      if (!lic.ok) return refus(lic.code, lic.message);
      const j = lic.joueur;
      if (j.statut === 'disqualifie' || j.statut === 'abandon') return refus('joueur_exclu', 'Ce joueur ne joue plus');

      const p = await paramsOf(c.tx, c.partie);
      const cat = await loadCatalogue(c.tx, partieId);
      const before = await loadBook(c.tx, j.id);
      let after = before;
      const donnees: string[] = [];
      if (input.carteId) {
        const idx = cp.cartes.indexOf(input.carteId);
        if (idx === -1) return refus('carte_indisponible', 'Cette carte n’est plus dans le stock du checkpoint');
        const catalogue = await catalogForDraw(c.tx, cat, partieId);
        const entry = catalogue.find((x) => x.id === input.carteId);
        if (!entry || entry.enCirculation >= limitesOf(p)[entry.rank]) return refus('limite_atteinte', 'Cette carte a atteint sa limite d’exemplaires'); // RG-8.2
        after = addItem(after, { kind: 'carte', id: newId(), cardId: input.carteId, origine: { type: 'pnj', checkpointId: cp.id }, obtenuA: c.now });
        donnees.push(cat.nomDe(input.carteId));
        const reste = [...cp.cartes];
        reste.splice(idx, 1);
        await c.tx.update(checkpoints).set({ cartes: reste }).where(eq(checkpoints.id, cp.id));
      }
      let jenny = j.jenny + input.jenny;
      let bonus: unknown = null;
      if (j.nen === 'materialisation') {
        const g = draw({ beaconType: 'standard', tiragesPrecedents: 0, catalogue: await catalogForDraw(c.tx, cat, partieId), limites: limitesOf(p) }, c.rng, BONUS_MATERIALISATION);
        if (g.kind === 'carte') {
          after = addItem(after, { kind: 'carte', id: newId(), cardId: g.cardId, origine: { type: 'pnj', checkpointId: cp.id }, obtenuA: c.now });
          bonus = { kind: 'carte', nom: cat.nomDe(g.cardId), rang: g.rank };
        } else if (g.kind === 'sort') {
          after = addItem(after, { kind: 'sort', id: newId(), spell: g.spell, obtenuA: c.now });
          bonus = { kind: 'sort', sort: g.spell };
        } else {
          jenny += g.amount;
          bonus = { kind: 'jenny', montant: g.amount };
        }
      }
      await saveBooks(c.tx, partieId, c.now, [{ joueurId: j.id, before, after }]);
      await updateJoueur(c.tx, j.id, { jenny, derniereActionA: c.now, ...(j.statut === 'inactif' ? { statut: 'actif' as const } : {}) });
      await c.log({ action: 'checkpoint', resultat: 'ok', details: { checkpointId: cp.id, joueurId: j.id, cartes: donnees, jenny: input.jenny, bonus } });
      c.emit({ type: 'joueur', id: j.id }, 'checkpoint', { cartes: donnees, jenny: input.jenny, bonus });
      return { ok: true as const, joueur: j.pseudo, cartes: donnees, bonus };
    });
    return send(reply, r);
  });

  // RG-8.8 : expertise payante à Antokiba (10 J la page, 25 J le Livre) ; résultat envoyé au joueur.
  app.post<P>('/parties/:partieId/expertise', async (req, reply) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, ...STAFF);
    const input = parse(ExpertiseIntent, req.body);
    const r = await runner.run(partieId, { type: s.role === 'gm' ? 'gm' : 'pnj', id: s.sub }, async (c) => {
      const lic = await verifyLicence(c.tx, partieId, input.licence, c.realNow);
      if (!lic.ok) return refus(lic.code, lic.message);
      const j = lic.joueur;
      const cat = await loadCatalogue(c.tx, partieId);
      const before = await loadBook(c.tx, j.id);
      const res = expertise(before, cat.designees, input.page ? { page: input.page } : 'livre', j.jenny);
      if (!res.ok) return refus(res.code, res.message);
      await saveBooks(c.tx, partieId, c.now, [{ joueurId: j.id, before, after: res.book }]);
      await updateJoueur(c.tx, j.id, { jenny: j.jenny - res.cout });
      await c.log({ action: 'expertise', resultat: 'ok', details: { joueurId: j.id, page: input.page ?? null, cout: res.cout, trouvees: res.contrefacons.length } });
      c.emit({ type: 'joueur', id: j.id }, 'expertise', { contrefacons: res.contrefacons, cout: res.cout });
      return { ok: true as const, joueur: j.pseudo, cout: res.cout, trouvees: res.contrefacons.length };
    });
    return send(reply, r);
  });
}
