// Cartes de Maître du jeu (RG-8.15 à 8.21, amendement du 2026-10-15) : le joueur joue « Jarvis tout-puissant »
// (Décret + Jugement) ou « Le Sceau d'Ange » ; le GM les donne et voit où elles sont. Le serveur décide de tout (P1).
import { JUGEMENT_FIGE_MS, JUGEMENT_INTOUCHABLE_MS, SCEAU_MS, addItem, cartesDuDecret, jouerJarvis, jouerSceau, type Book, type GmJoueur, type GmRefusal } from '@gq/engine';
import { CARTES_GM, CarteGmIntent, DonCarteGmIntent } from '@gq/shared';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { STAFF, requireRole } from '../auth/guard.js';
import { ENGAGEE, engagedItems } from '../core/echanges.js';
import { paramsOf } from '../core/params.js';
import { recordPosition } from '../core/position.js';
import { noterRencontre } from '../core/rencontres.js';
import type { ActionCtx } from '../core/runner.js';
import {
  actionPatch,
  circulation,
  donnerCarteGm,
  isLivreGele,
  ligneCarteGm,
  limitesOf,
  loadBook,
  loadBooks,
  loadCatalogue,
  loadJoueur,
  loadJoueurs,
  saveBooks,
  updateJoueur,
  vueCarte,
  type JoueurRow,
} from '../core/state.js';
import { cartesGm } from '../db/schema.js';
import { introuvable } from '../errors.js';
import { refus, send } from '../http.js';
import { newId } from '../ids.js';
import { parse } from '../validation.js';
import { rangeOf } from './sorts.js';

type P = { Params: { partieId: string } };

/** Noms affichés des cartes (joueurs, écran géant, Journal). */
export const NOMS_GM = { jarvis: 'Jarvis tout-puissant', ange: "Le Sceau d'Ange" } as const;

async function gmJoueur(c: ActionCtx, j: JoueurRow, book: Book): Promise<GmJoueur> {
  return {
    id: j.id,
    status: j.statut,
    position: j.position,
    book,
    livreGele: await isLivreGele(c.tx, j.id),
    immuniteJusqua: j.immuniteJusqua,
    figeJusqua: j.figeJusqua,
    scelleJusqua: j.scelleJusqua,
    intouchableJusqua: j.intouchableJusqua,
  };
}
const patchGm = (p: GmJoueur) => ({ immuniteJusqua: p.immuniteJusqua, figeJusqua: p.figeJusqua ?? null, scelleJusqua: p.scelleJusqua ?? null, intouchableJusqua: p.intouchableJusqua ?? null });

export async function cartesGmRoutes(app: FastifyInstance) {
  const { runner } = app.gq;

  // RG-8.19 : cartes que le Décret peut faire apparaître ; « reprise » = à sa limite, elle sera prise à un détenteur.
  app.get<P>('/parties/:partieId/cartes-gm/decret', async (req) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    return runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
      const [book, cat, p, circ] = await Promise.all([loadBook(c.tx, s.sub), loadCatalogue(c.tx, partieId), paramsOf(c.tx, c.partie), circulation(c.tx, partieId)]);
      const limites = limitesOf(p);
      const cartes = cartesDuDecret(book, cat).map((id) => ({ carteId: id, ...vueCarte(cat, id, limites), reprise: (circ.get(id) ?? 0) >= limites[cat.rangDe(id)] }));
      return { ok: true as const, cartes };
    });
  });

  app.post<P>('/parties/:partieId/cartes-gm/jouer', async (req, reply) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    const input = parse(CarteGmIntent, req.body);
    const r = await runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
      const j = await loadJoueur(c.tx, s.sub);
      if (!j) throw introuvable('Joueur');
      await recordPosition(c, j, input.position);
      const moi = (await loadJoueur(c.tx, s.sub))!; // position à jour
      const deny = async (e: GmRefusal | { ok: false; code: string; message: string }) => {
        await c.log({ action: 'carte_gm', resultat: 'refus', details: { gm: input.gm, code: e.code } });
        return refus(e.code, e.message);
      };
      if ((await engagedItems(c.tx, partieId, j.id, c.now)).has(input.itemId)) return deny(ENGAGEE);

      const [p, cat] = await Promise.all([paramsOf(c.tx, c.partie), loadCatalogue(c.tx, partieId)]);
      const w = { now: c.now, gameState: c.partie.etat, portee: rangeOf(p), rangDe: cat.rangDe, designees: cat.designees, newId };

      if (input.gm === 'jarvis') {
        const lignes = await loadJoueurs(c.tx, partieId);
        const books = await loadBooks(c.tx, lignes.map((x) => x.id));
        const tous = await Promise.all(lignes.map((x) => gmJoueur(c, x.id === moi.id ? moi : x, books.get(x.id)!)));
        const lanceur = tous.find((x) => x.id === moi.id)!;
        const limite = limitesOf(p)[cat.rangDe(input.carteId)];
        const enCirculation = (await circulation(c.tx, partieId)).get(input.carteId) ?? 0;
        const res = jouerJarvis(w, { lanceur, autres: tous.filter((x) => x.id !== moi.id), itemId: input.itemId, carteVoulueId: input.carteId, limite, enCirculation }, c.rng);
        if (!res.ok) return deny(res);

        const changes = [res.lanceur, ...res.autres].map((x) => ({ joueurId: x.id, before: books.get(x.id)!, after: x.book }));
        await saveBooks(c.tx, partieId, c.now, changes);
        await updateJoueur(c.tx, moi.id, { ...actionPatch(moi, c.now), ...patchGm(res.lanceur) });
        for (const x of res.autres) await updateJoueur(c.tx, x.id, patchGm(x));
        await c.tx.update(cartesGm).set({ jouee: (await ligneCarteGm(c.tx, partieId, 'jarvis')).jouee + 1 }).where(eq(cartesGm.id, res.rendue.id));

        const pseudo = new Map(lignes.map((x) => [x.id, x.pseudo]));
        const limites = limitesOf(p);
        const carte = { carteId: res.carte.cardId, ...vueCarte(cat, res.carte.cardId, limites) };
        const figes = res.figes.map((id) => pseudo.get(id) ?? '?');
        const reprisA = res.reprisA ? (pseudo.get(res.reprisA) ?? '?') : null;
        await c.log({ action: 'carte_gm', resultat: 'jouee', details: { gm: 'jarvis', carteId: res.carte.cardId, reprisA: res.reprisA ?? null, figes: res.figes } });
        // Annonce à tous (« Jarvis a parlé ») et à l'écran géant ; chacun des joueurs touchés apprend ce qui lui arrive.
        const annonce = { gm: 'jarvis' as const, lanceur: moi.pseudo, carte: carte.nom, figes, reprisA, heureJeu: c.now };
        c.emit({ type: 'joueurs' }, 'carte_gm_jouee', annonce);
        c.emit({ type: 'tracker' }, 'fil', { type: 'carte_gm', ...annonce });
        c.emit({ type: 'staff' }, 'carte_gm_jouee', annonce);
        for (const id of res.figes) c.emit({ type: 'joueur', id }, 'carte_gm_recue', { gm: 'jarvis', lanceur: moi.pseudo, figeMs: JUGEMENT_FIGE_MS, heureJeu: c.now });
        if (res.reprisA) c.emit({ type: 'joueur', id: res.reprisA }, 'carte_gm_recue', { gm: 'jarvis', lanceur: moi.pseudo, perdue: carte, heureJeu: c.now });
        return { ok: true as const, gm: 'jarvis' as const, carte, reprisA, figes, intouchableMs: JUGEMENT_INTOUCHABLE_MS };
      }

      const cibleRow = await loadJoueur(c.tx, input.cibleId);
      if (!cibleRow || cibleRow.partieId !== partieId) return deny({ ok: false, code: 'cible_invalide', message: 'Cible invalide' });
      const books = await loadBooks(c.tx, [moi.id, cibleRow.id]);
      const res = jouerSceau(w, { lanceur: await gmJoueur(c, moi, books.get(moi.id)!), cible: await gmJoueur(c, cibleRow, books.get(cibleRow.id)!), itemId: input.itemId });
      if (!res.ok) return deny(res);
      await saveBooks(c.tx, partieId, c.now, [{ joueurId: moi.id, before: books.get(moi.id)!, after: res.lanceur.book }]);
      await updateJoueur(c.tx, moi.id, actionPatch(moi, c.now));
      await updateJoueur(c.tx, cibleRow.id, patchGm(res.cible));
      await c.tx.update(cartesGm).set({ jouee: (await ligneCarteGm(c.tx, partieId, 'ange')).jouee + 1 }).where(eq(cartesGm.id, res.rendue.id));
      await noterRencontre(c, moi.id, cibleRow.id);
      await c.log({ action: 'carte_gm', resultat: 'jouee', details: { gm: 'ange', cible: cibleRow.id } });
      c.emit({ type: 'joueur', id: cibleRow.id }, 'carte_gm_recue', { gm: 'ange', lanceur: moi.pseudo, scelleMs: SCEAU_MS, heureJeu: c.now });
      c.emit({ type: 'tracker' }, 'fil', { type: 'carte_gm', gm: 'ange', lanceur: moi.pseudo, cible: cibleRow.pseudo, heureJeu: c.now });
      c.emit({ type: 'staff' }, 'carte_gm_jouee', { gm: 'ange', lanceur: moi.pseudo, cible: cibleRow.pseudo, heureJeu: c.now });
      return { ok: true as const, gm: 'ange' as const, cible: cibleRow.pseudo, scelleMs: SCEAU_MS };
    });
    return send(reply, r);
  });

  // RG-8.16 : le GM donne une carte encore au Maître du jeu (récompense d'évènement ou don direct), motif journalisé.
  app.post<P>('/parties/:partieId/cartes-gm/donner', async (req, reply) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'gm');
    const input = parse(DonCarteGmIntent, req.body);
    const r = await runner.run(partieId, { type: 'gm', id: s.sub }, async (c) => {
      const j = await loadJoueur(c.tx, input.joueurId);
      if (!j || j.partieId !== partieId) throw introuvable('Joueur');
      const item = await donnerCarteGm(c.tx, partieId, input.gm, c.now);
      if (!item) return refus('deja_en_jeu', 'Cette carte est déjà dans le Book d’un joueur');
      const book = await loadBook(c.tx, j.id);
      await saveBooks(c.tx, partieId, c.now, [{ joueurId: j.id, before: book, after: addItem(book, item) }]);
      await c.log({ action: 'carte_gm_obtenue', resultat: 'don', details: { gm: input.gm, joueurId: j.id, motif: input.motif } });
      c.emit({ type: 'joueur', id: j.id }, 'carte_gm_obtenue', { gm: input.gm, par: 'gm' });
      c.emit({ type: 'tracker' }, 'fil', { type: 'carte_gm_obtenue', gm: input.gm, pseudo: j.pseudo, heureJeu: c.now });
      return { ok: true as const };
    });
    return send(reply, r);
  });

  // RG-8.17 : où sont les cartes de Maître du jeu (équipe seulement).
  app.get<P>('/parties/:partieId/cartes-gm', async (req) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, ...STAFF);
    return runner.run(partieId, { type: s.role === 'gm' ? 'gm' : 'pnj', id: s.sub }, async (c) => {
      const pseudo = new Map((await loadJoueurs(c.tx, partieId)).map((j) => [j.id, j.pseudo]));
      const cartes = await Promise.all(
        CARTES_GM.map(async (gm) => {
          const l = await ligneCarteGm(c.tx, partieId, gm);
          return { gm, nom: NOMS_GM[gm], detenteur: l.joueurId ? { id: l.joueurId, pseudo: pseudo.get(l.joueurId) ?? '?' } : null, jouee: l.jouee };
        }),
      );
      return { ok: true as const, cartes };
    });
  });
}
