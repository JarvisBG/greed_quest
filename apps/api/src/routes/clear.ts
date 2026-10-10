// Clear (RG-13.1 à 13.3) : le joueur déclare son Livre complet (Clear provisoire, Livre gelé),
// le GM confirme en scannant sa licence (partie terminée), le gagnant choisit 3 cartes = lots réels.
import { checkClear, endByClear, validateRewards } from '@gq/engine';
import { ClearAnnulation, ClearConfirmation, RecompensesIntent } from '@gq/shared';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { requireRole } from '../auth/guard.js';
import { applyLifecycle } from '../core/cycle.js';
import { verifyLicence } from '../core/licence.js';
import { lifecycleOf } from '../core/partie.js';
import { isLivreGele, loadBook, loadCatalogue, loadJoueur, updateJoueur, actionPatch } from '../core/state.js';
import { cartes, livres, parties } from '../db/schema.js';
import { introuvable } from '../errors.js';
import { refus, send } from '../http.js';
import { parse } from '../validation.js';

type P = { Params: { partieId: string } };

const gameOpen = (etat: string) => etat === 'en_cours' || etat === 'phase_finale';

export async function clearRoutes(app: FastifyInstance) {
  const { runner } = app.gq;

  // RG-13.1 : Clear provisoire.
  app.post<P>('/parties/:partieId/clear', async (req, reply) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    const r = await runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
      const j = await loadJoueur(c.tx, s.sub);
      if (!j) throw introuvable('Joueur');
      const deny = async (code: string, message: string) => {
        await c.log({ action: 'clear_demande', resultat: 'refus', details: { code } });
        return refus(code, message);
      };
      if (!gameOpen(c.partie.etat)) return deny('partie_fermee', 'Le Clear se déclare pendant la partie');
      if (j.statut === 'disqualifie' || j.statut === 'abandon') return deny('joueur_exclu', 'Tu ne joues plus');
      if (await isLivreGele(c.tx, j.id)) return deny('deja_gele', 'Ton Book est déjà gelé : va voir le Game Master');
      const cat = await loadCatalogue(c.tx, partieId);
      const check = checkClear(await loadBook(c.tx, j.id), cat.designees);
      if (check.etat === 'incomplet') {
        return deny('incomplet', `Il te manque ${check.manquantes} carte${check.manquantes > 1 ? 's' : ''}`);
      }
      if (check.etat === 'contrefacon') {
        // RG-13.1 : on indique la page, jamais la carte.
        return deny('contrefacon', `Une contrefaçon se cache en page ${check.page}`);
      }
      await c.tx.update(livres).set({ gele: true, geleA: c.now }).where(eq(livres.joueurId, j.id));
      await updateJoueur(c.tx, j.id, actionPatch(j, c.now));
      await c.log({ action: 'clear_demande', resultat: 'ok', details: { joueurId: j.id } });
      c.emit({ type: 'staff' }, 'demande_clear', { joueurId: j.id, pseudo: j.pseudo }); // demande de validation
      return { ok: true as const, message: 'Book complet ! Ton Book est gelé : va voir le Game Master' };
    });
    return send(reply, r);
  });

  // RG-13.2 : le GM scanne la licence → partie terminée, classement figé.
  app.post<P>('/parties/:partieId/clear/confirmer', async (req, reply) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'gm');
    const input = parse(ClearConfirmation, req.body);
    const r = await runner.run(partieId, { type: 'gm', id: s.sub }, async (c) => {
      const lic = await verifyLicence(c.tx, partieId, input.licence, c.realNow);
      if (!lic.ok) return refus(lic.code, lic.message);
      const j = lic.joueur;
      if (!(await isLivreGele(c.tx, j.id))) return refus('pas_de_clear', 'Ce joueur n’a pas déclaré de Clear');
      const cat = await loadCatalogue(c.tx, partieId);
      const check = checkClear(await loadBook(c.tx, j.id), cat.designees);
      if (check.etat !== 'complet') return refus('livre_incomplet', 'Le Book n’est plus complet');
      const res = endByClear(lifecycleOf(c.partie), c.realNow);
      if (!res.ok) return refus('transition_impossible', res.message);
      await c.tx.update(parties).set({ gagnantId: j.id }).where(eq(parties.id, partieId));
      await c.log({ action: 'clear', resultat: 'confirme', details: { joueurId: j.id, pseudo: j.pseudo } });
      await applyLifecycle(c, res.game, res.transition ? [res.transition] : []);
      const annonce = { pseudo: j.pseudo };
      c.emit({ type: 'joueurs' }, 'clear', annonce); // push si confirmé
      c.emit({ type: 'tracker' }, 'clear', annonce); // plein écran
      c.emit({ type: 'joueur', id: j.id }, 'clear_confirme', annonce);
      return { ok: true as const, gagnant: j.pseudo };
    });
    return send(reply, r);
  });

  // Le GM refuse un Clear provisoire (Livre dégelé), avec motif.
  app.post<P>('/parties/:partieId/clear/annuler', async (req, reply) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'gm');
    const input = parse(ClearAnnulation, req.body);
    const r = await runner.run(partieId, { type: 'gm', id: s.sub }, async (c) => {
      if (!(await isLivreGele(c.tx, input.joueurId))) return refus('pas_de_clear', 'Ce joueur n’a pas déclaré de Clear');
      await c.tx.update(livres).set({ gele: false, geleA: null }).where(eq(livres.joueurId, input.joueurId));
      await c.log({ action: 'clear_annulation', resultat: 'ok', motif: input.motif, details: { joueurId: input.joueurId } });
      c.emit({ type: 'joueur', id: input.joueurId }, 'clear_refuse', { motif: input.motif });
      return { ok: true as const };
    });
    return send(reply, r);
  });

  // RG-13.3 : le gagnant choisit 3 cartes désignées de son Livre ; chacune correspond à un lot réel.
  app.post<P>('/parties/:partieId/clear/recompenses', async (req, reply) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    const input = parse(RecompensesIntent, req.body);
    const r = await runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
      if (c.partie.gagnantId !== s.sub) return refus('pas_gagnant', 'Réservé au vainqueur du Clear');
      if (c.partie.recompenses) return refus('deja_choisi', 'Tes récompenses sont déjà choisies');
      const cat = await loadCatalogue(c.tx, partieId);
      const v = validateRewards(await loadBook(c.tx, s.sub), cat.designees, input.itemIds);
      if (!v.ok) return refus('choix_invalide', v.message);
      await c.tx.update(parties).set({ recompenses: v.cardIds }).where(eq(parties.id, partieId));
      const rows = await c.tx.select().from(cartes).where(eq(cartes.partieId, partieId));
      const lots = v.cardIds.map((id) => {
        const x = rows.find((r) => r.id === id);
        return { carte: x?.nom ?? '?', lotReel: x?.lotReel ?? null };
      });
      await c.log({ action: 'recompenses', resultat: 'ok', details: { cartes: v.cardIds, lots } });
      c.emit({ type: 'staff' }, 'recompenses', { joueurId: s.sub, lots });
      return { ok: true as const, lots };
    });
    return send(reply, r);
  });
}
