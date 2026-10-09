// Enchères d'Antokiba (RG-11.4, 11.5) : un PNJ met une carte en vente 3 min ; les joueurs scannent
// le QR de l'enchère sur place puis surenchérissent dans l'app ; seul le gagnant est débité.
import { addItem, closeAuction, joinAuction, openAuction, placeBid, type Auction } from '@gq/engine';
import { EnchereInscription, EnchereOffre, EnchereOuverture } from '@gq/shared';
import { and, eq, lte } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { STAFF, requireRole } from '../auth/guard.js';
import { paramsOf } from '../core/params.js';
import { recordPosition } from '../core/position.js';
import type { ActionCtx } from '../core/runner.js';
import { circulation, limitesOf, loadBook, loadCatalogue, loadJoueur, saveBooks, updateJoueur, actionPatch } from '../core/state.js';
import { encheres, joueurs } from '../db/schema.js';
import { introuvable } from '../errors.js';
import { refus, send } from '../http.js';
import { newId } from '../ids.js';
import { parse } from '../validation.js';
import { isPlaceQr } from './boutique.js';

type P = { Params: { partieId: string } };
type PE = { Params: { partieId: string; id: string } };
type EnchereRow = typeof encheres.$inferSelect;

const auctionOf = (r: EnchereRow): Auction => ({
  id: r.id,
  cardId: r.carteId,
  prixDepart: r.prixDepart,
  debut: r.debut,
  fin: r.fin,
  participants: r.participants,
  offres: r.offres,
});

const gameOpen = (etat: string) => etat === 'en_cours' || etat === 'phase_finale';

/** Vue publique : carte, fin, meilleure offre (pseudo). */
async function publicView(c: ActionCtx, a: Auction) {
  const cat = await loadCatalogue(c.tx, c.partie.id);
  const best = a.offres.at(-1);
  const pseudo = best ? (await loadJoueur(c.tx, best.playerId))?.pseudo ?? '?' : null;
  return {
    id: a.id,
    carte: { id: a.cardId, nom: cat.nomDe(a.cardId), rang: cat.rangDe(a.cardId) },
    fin: a.fin,
    prixDepart: a.prixDepart,
    meilleureOffre: best ? { montant: best.montant, pseudo } : null,
  };
}

/**
 * Clôture les enchères arrivées à échéance (appelée par les tâches planifiées et par le PNJ).
 * RG-11.4 : seul le gagnant est débité. RG-11.5 : sans offre valable, la carte retourne au PNJ.
 * RG-8.2 : la limite d'exemplaires est absolue ; si elle est atteinte entre-temps, la vente n'a pas lieu.
 */
export async function closeDueAuctions(c: ActionCtx): Promise<void> {
  const dues = await c.tx
    .select()
    .from(encheres)
    .where(and(eq(encheres.partieId, c.partie.id), eq(encheres.etat, 'ouverte'), lte(encheres.fin, c.now)));
  if (dues.length === 0) return;
  const cat = await loadCatalogue(c.tx, c.partie.id);
  const limites = limitesOf(await paramsOf(c.tx, c.partie));
  for (const row of dues) {
    const a = auctionOf(row);
    const jenny = new Map<string, number>();
    for (const o of a.offres) {
      if (!jenny.has(o.playerId)) jenny.set(o.playerId, (await loadJoueur(c.tx, o.playerId))?.jenny ?? 0);
    }
    const { gagnant } = closeAuction(a, (id) => jenny.get(id) ?? 0);
    const enCirculation = (await circulation(c.tx, c.partie.id)).get(a.cardId) ?? 0;
    const vendable = gagnant !== null && enCirculation < limites[cat.rangDe(a.cardId)];
    if (!vendable) {
      await c.tx.update(encheres).set({ etat: 'invendue' }).where(eq(encheres.id, a.id));
      await c.log({ action: 'enchere_cloture', resultat: 'invendue', details: { enchereId: a.id, carteId: a.cardId, limiteAtteinte: gagnant !== null } });
      c.emit({ type: 'joueurs' }, 'enchere_close', { id: a.id, vendue: false });
      c.emit({ type: 'staff' }, 'enchere_close', { id: a.id, vendue: false });
      continue;
    }
    const j = (await loadJoueur(c.tx, gagnant.playerId))!;
    const book = await loadBook(c.tx, j.id);
    const after = addItem(book, { kind: 'carte', id: newId(), cardId: a.cardId, origine: { type: 'enchere', enchereId: a.id }, obtenuA: c.now });
    await saveBooks(c.tx, c.partie.id, c.now, [{ joueurId: j.id, before: book, after }]);
    await updateJoueur(c.tx, j.id, { jenny: j.jenny - gagnant.montant });
    await c.tx.update(encheres).set({ etat: 'vendue', gagnantId: j.id, prix: gagnant.montant }).where(eq(encheres.id, a.id));
    await c.log({ action: 'enchere_cloture', resultat: 'vendue', details: { enchereId: a.id, carteId: a.cardId, gagnant: j.id, prix: gagnant.montant } });
    const fin = { id: a.id, vendue: true, pseudo: j.pseudo, prix: gagnant.montant, carte: cat.nomDe(a.cardId) };
    c.emit({ type: 'joueurs' }, 'enchere_close', fin);
    c.emit({ type: 'staff' }, 'enchere_close', fin);
    c.emit({ type: 'joueur', id: j.id }, 'enchere_gagnee', fin);
  }
}

export async function encheresRoutes(app: FastifyInstance) {
  const { runner } = app.gq;

  // RG-11.4 : le PNJ met une carte en vente pour 3 min.
  app.post<P>('/parties/:partieId/encheres', async (req, reply) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, ...STAFF);
    const input = parse(EnchereOuverture, req.body);
    const r = await runner.run(partieId, { type: s.role === 'gm' ? 'gm' : 'pnj', id: s.sub }, async (c) => {
      if (!gameOpen(c.partie.etat)) return refus('partie_fermee', 'Les enchères sont fermées pour le moment');
      const cat = await loadCatalogue(c.tx, partieId);
      if (!cat.cartes.some((x) => x.id === input.carteId)) return refus('carte_inconnue', 'Carte inconnue');
      const limite = limitesOf(await paramsOf(c.tx, c.partie))[cat.rangDe(input.carteId)];
      if (((await circulation(c.tx, partieId)).get(input.carteId) ?? 0) >= limite) {
        return refus('limite_atteinte', 'Cette carte a atteint sa limite d’exemplaires'); // RG-8.2
      }
      const a = openAuction(newId(), input.carteId, c.now, input.prixDepart);
      await c.tx.insert(encheres).values({ id: a.id, partieId, carteId: a.cardId, pnjId: s.sub, prixDepart: a.prixDepart, debut: a.debut, fin: a.fin });
      await c.log({ action: 'enchere_ouverture', resultat: 'ok', details: { enchereId: a.id, carteId: a.cardId, prixDepart: a.prixDepart } });
      const vue = await publicView(c, a);
      c.emit({ type: 'joueurs' }, 'enchere', vue);
      c.emit({ type: 'staff' }, 'enchere', vue);
      return { ok: true as const, enchere: vue };
    });
    return send(reply, r);
  });

  app.get<P>('/parties/:partieId/encheres', async (req) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur', ...STAFF);
    return runner.run(partieId, { type: s.role === 'joueur' ? 'joueur' : s.role, id: s.sub }, async (c) => {
      const rows = await c.tx.select().from(encheres).where(and(eq(encheres.partieId, partieId), eq(encheres.etat, 'ouverte')));
      const vues = [];
      for (const r of rows) if (r.fin > c.now) vues.push({ ...(await publicView(c, auctionOf(r))), inscrit: r.participants.includes(s.sub) });
      return { ok: true as const, encheres: vues };
    });
  });

  /** Gabarit des actions joueur sur une enchère ouverte. */
  function playerAction(
    url: string,
    action: string,
    apply: (c: ActionCtx, a: Auction, joueur: typeof joueurs.$inferSelect, body: unknown) => Promise<ReturnType<typeof placeBid>>,
  ) {
    app.post<PE>(`/parties/:partieId/encheres/:id/${url}`, async (req, reply) => {
      const { partieId, id } = req.params;
      const s = requireRole(req, partieId, 'joueur');
      const r = await runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
        const [row] = await c.tx.select().from(encheres).where(and(eq(encheres.id, id), eq(encheres.partieId, partieId)));
        if (!row) throw introuvable('Enchère');
        const j = await loadJoueur(c.tx, s.sub);
        if (!j) throw introuvable('Joueur');
        const deny = async (code: string, message: string) => {
          await c.log({ action, resultat: 'refus', details: { enchereId: id, code } });
          return refus(code, message);
        };
        if (!gameOpen(c.partie.etat)) return deny('partie_fermee', 'Les enchères sont fermées pour le moment');
        if (row.etat !== 'ouverte') return deny('terminee', 'Enchère terminée');
        if (j.statut === 'disqualifie' || j.statut === 'abandon' || j.statut === 'gele') return deny('joueur_bloque', 'Tu ne peux pas enchérir maintenant');
        const res = await apply(c, auctionOf(row), j, req.body);
        if (!res.ok) return deny(res.code, res.message);
        await c.tx.update(encheres).set({ participants: [...res.auction.participants], offres: [...res.auction.offres] }).where(eq(encheres.id, id));
        await updateJoueur(c.tx, j.id, actionPatch(j, c.now));
        await c.log({ action, resultat: 'ok', details: { enchereId: id, montant: res.auction.offres.at(-1)?.montant ?? null } });
        const vue = await publicView(c, res.auction);
        c.emit({ type: 'joueurs' }, 'enchere', vue);
        c.emit({ type: 'staff' }, 'enchere', vue);
        return { ok: true as const, enchere: vue };
      });
      return send(reply, r);
    });
  }

  // RG-11.4 : participer exige le scan du QR de l'enchère (Antokiba), sur place.
  playerAction('rejoindre', 'enchere_inscription', async (c, a, j, body) => {
    const input = parse(EnchereInscription, body);
    await recordPosition(c, j, input.position);
    if (!(await isPlaceQr(c.tx, c.partie.id, input.qr, 'antokiba'))) {
      return { ok: false, code: 'non_inscrit', message: 'Scanne le QR de l’enchère, sur place' };
    }
    return joinAuction(a, j.id, c.now);
  });

  // Surenchère depuis l'app ; personne n'est débité avant la clôture.
  playerAction('offre', 'enchere_offre', async (c, a, j, body) => {
    const { montant } = parse(EnchereOffre, body);
    return placeBid(a, j.id, montant, j.jenny, c.now);
  });

  // Le PNJ (ou le GM) clôture les enchères échues sans attendre la tâche planifiée.
  app.post<P>('/parties/:partieId/encheres/cloturer', async (req) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, ...STAFF);
    return runner.run(partieId, { type: s.role === 'gm' ? 'gm' : 'pnj', id: s.sub }, async (c) => {
      await closeDueAuctions(c);
      return { ok: true as const };
    });
  });
}
