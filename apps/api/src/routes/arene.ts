// Arène de Soufrabi (amendement 2026-10-09, Sivraj) : le PNJ scanne la licence du joueur, qui paie la mise ;
// il arbitre le défi puis donne l'issue. Victoire = tirage A / S / SS (limites RG-8.2), défaite = mise perdue.
// Livre plein : la carte gagnée déborde, comme pour un checkpoint (décision validée, PROGRESS.md).
import { addItem, arenaReward, enterArena, layoutBook } from '@gq/engine';
import { AreneAnnulation, AreneEntree, AreneIssue, RANK_POINTS } from '@gq/shared';
import { and, desc, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { STAFF, requireRole } from '../auth/guard.js';
import { verifyLicence } from '../core/licence.js';
import { paramsOf } from '../core/params.js';
import type { ActionCtx } from '../core/runner.js';
import { catalogForDraw, limitesOf, loadBook, loadCatalogue, loadJoueur, saveBooks, updateJoueur } from '../core/state.js';
import { arene, type GainArene } from '../db/schema.js';
import { introuvable } from '../errors.js';
import { refus, send } from '../http.js';
import { newId } from '../ids.js';
import { parse } from '../validation.js';

type P = { Params: { partieId: string } };
type PI = { Params: { partieId: string; id: string } };
type TentativeRow = typeof arene.$inferSelect;

const gameOpen = (etat: string) => etat === 'en_cours' || etat === 'phase_finale';

export async function areneRoutes(app: FastifyInstance) {
  const { runner } = app.gq;

  /** Action de l'équipe, journalisée sous son nom. */
  function equipe<T extends { ok: boolean }>(req: FastifyRequest<P>, fn: (c: ActionCtx, staffId: string) => Promise<T>) {
    const s = requireRole(req, req.params.partieId, ...STAFF);
    return runner.run(req.params.partieId, { type: s.role === 'gm' ? 'gm' : 'pnj', id: s.sub }, (c) => fn(c, s.sub));
  }

  /** Tentative en cours de cette partie, ou introuvable. */
  async function enCours(c: ActionCtx, id: string): Promise<TentativeRow | null> {
    const [t] = await c.tx.select().from(arene).where(and(eq(arene.id, id), eq(arene.partieId, c.partie.id)));
    if (!t) throw introuvable('Tentative');
    return t.etat === 'en_cours' ? t : null;
  }

  // Entrée : licence vérifiée (présence), délai entre deux tentatives, mise débitée tout de suite.
  app.post<P>('/parties/:partieId/arene/entree', async (req, reply) => {
    const input = parse(AreneEntree, req.body);
    const r = await equipe(req, async (c, staffId) => {
      if (!gameOpen(c.partie.etat)) return refus('partie_fermee', 'L’arène est fermée pour le moment');
      const lic = await verifyLicence(c.tx, c.partie.id, input.licence, c.realNow);
      if (!lic.ok) return refus(lic.code, lic.message);
      const j = lic.joueur;
      const p = await paramsOf(c.tx, c.partie);
      const [derniere] = await c.tx.select().from(arene).where(eq(arene.joueurId, j.id)).orderBy(desc(arene.entreeA)).limit(1);
      const entree = enterArena(
        { statut: j.statut, jenny: j.jenny, derniereEntreeA: derniere?.etat === 'annulee' ? null : (derniere?.entreeA ?? null), tentativeEnCours: derniere?.etat === 'en_cours' },
        c.now,
        { mise: p.areneMiseJ, delaiMin: p.areneDelaiMin },
      );
      if (!entree.ok) {
        await c.log({ action: 'arene_entree', resultat: 'refus', details: { joueurId: j.id, code: entree.code } });
        return refus(entree.code, entree.message);
      }
      const id = newId();
      await c.tx.insert(arene).values({ id, partieId: c.partie.id, joueurId: j.id, pnjId: staffId, mise: entree.mise, entreeA: c.now });
      await updateJoueur(c.tx, j.id, { jenny: j.jenny - entree.mise, derniereActionA: c.now, ...(j.statut === 'inactif' ? { statut: 'actif' as const } : {}) });
      await c.log({ action: 'arene_entree', resultat: 'ok', details: { tentativeId: id, joueurId: j.id, mise: entree.mise } });
      c.emit({ type: 'joueur', id: j.id }, 'arene', { id, etat: 'en_cours', mise: entree.mise });
      return { ok: true as const, id, joueur: { id: j.id, pseudo: j.pseudo }, mise: entree.mise };
    });
    return send(reply, r);
  });

  // Issue du défi : victoire = tirage A / S / SS ; défaite = mise perdue.
  app.post<PI>('/parties/:partieId/arene/:id/issue', async (req, reply) => {
    const { victoire } = parse(AreneIssue, req.body);
    const r = await equipe(req, async (c) => {
      const t = await enCours(c, req.params.id);
      if (!t) return refus('tentative_terminee', 'Ce défi a déjà une issue');
      if (!gameOpen(c.partie.etat)) return refus('partie_fermee', 'La partie n’est pas en cours : annule le défi pour rembourser la mise');
      const j = (await loadJoueur(c.tx, t.joueurId))!;
      if (!victoire) {
        await c.tx.update(arene).set({ etat: 'perdue', finA: c.now }).where(eq(arene.id, t.id));
        await c.log({ action: 'arene_issue', resultat: 'perdue', details: { tentativeId: t.id, joueurId: j.id, mise: t.mise } });
        c.emit({ type: 'joueur', id: j.id }, 'arene', { id: t.id, etat: 'perdue', mise: t.mise });
        return { ok: true as const, joueur: j.pseudo, gain: null };
      }
      const cat = await loadCatalogue(c.tx, c.partie.id);
      const p = await paramsOf(c.tx, c.partie);
      const g = arenaReward(await catalogForDraw(c.tx, cat, c.partie.id), limitesOf(p), c.rng);
      let gain: GainArene;
      let vue: { kind: 'carte'; nom: string; rang: string } | { kind: 'jenny'; montant: number };
      const before = await loadBook(c.tx, j.id);
      if (g.kind === 'carte') {
        const after = addItem(before, { kind: 'carte', id: newId(), cardId: g.cardId, origine: { type: 'arene', tentativeId: t.id }, obtenuA: c.now });
        await saveBooks(c.tx, c.partie.id, c.now, [{ joueurId: j.id, before, after }]);
        gain = { kind: 'carte', carteId: g.cardId, rang: g.rank };
        vue = { kind: 'carte', nom: cat.nomDe(g.cardId), rang: g.rank };
        if (RANK_POINTS[g.rank] >= RANK_POINTS.S) c.emit({ type: 'tracker' }, 'fil', { type: 'arene', pseudo: j.pseudo, carte: vue.nom, rang: g.rank, heureJeu: c.now });
        const distinctes = layoutBook(after, cat.designees).designes.filter((d) => d.slot.etat === 'plein').length;
        c.emit({ type: 'tracker' }, 'progression', { joueurId: j.id, pseudo: j.pseudo, cartes: distinctes });
      } else {
        // RG-8.3 : A, S et SS tous épuisés → repli en jenny.
        const montant = g.kind === 'jenny' ? g.amount : 0;
        await updateJoueur(c.tx, j.id, { jenny: j.jenny + montant });
        gain = { kind: 'jenny', montant };
        vue = gain;
      }
      await c.tx.update(arene).set({ etat: 'gagnee', gain, finA: c.now }).where(eq(arene.id, t.id));
      await c.log({ action: 'arene_issue', resultat: 'gagnee', details: { tentativeId: t.id, joueurId: j.id, gain } });
      c.emit({ type: 'joueur', id: j.id }, 'arene', { id: t.id, etat: 'gagnee', gain: vue });
      return { ok: true as const, joueur: j.pseudo, gain: vue };
    });
    return send(reply, r);
  });

  // Entrée enregistrée par erreur : mise remboursée, et la tentative ne compte pas dans le délai.
  app.post<PI>('/parties/:partieId/arene/:id/annuler', async (req, reply) => {
    const { motif } = parse(AreneAnnulation, req.body);
    const r = await equipe(req, async (c) => {
      const t = await enCours(c, req.params.id);
      if (!t) return refus('tentative_terminee', 'Ce défi a déjà une issue');
      const j = (await loadJoueur(c.tx, t.joueurId))!;
      await c.tx.update(arene).set({ etat: 'annulee', finA: c.now }).where(eq(arene.id, t.id));
      await updateJoueur(c.tx, j.id, { jenny: j.jenny + t.mise });
      await c.log({ action: 'arene_annulation', resultat: 'ok', motif, details: { tentativeId: t.id, joueurId: j.id, rembourse: t.mise } });
      c.emit({ type: 'joueur', id: j.id }, 'arene', { id: t.id, etat: 'annulee', mise: t.mise, motif });
      return { ok: true as const, rembourse: t.mise };
    });
    return send(reply, r);
  });

  // Défis en cours (console de l'arbitre).
  app.get<P>('/parties/:partieId/arene', async (req) => {
    const { partieId } = req.params;
    requireRole(req, partieId, ...STAFF);
    const rows = await app.gq.db.select().from(arene).where(and(eq(arene.partieId, partieId), eq(arene.etat, 'en_cours')));
    const vues = [];
    for (const t of rows) vues.push({ id: t.id, joueurId: t.joueurId, pseudo: (await loadJoueur(app.gq.db, t.joueurId))?.pseudo ?? '?', mise: t.mise, entreeA: t.entreeA });
    return { ok: true, tentatives: vues };
  });
}
