// Sorts (RG-10) et pouvoir de Transformation (RG-5.4). Le serveur calcule portée, protections et effets (P1).
import {
  castAnalyse,
  castBarrier,
  castDuplication,
  castOffensive,
  castRadar,
  castRevelation,
  playersInRange,
  transform,
  type Book,
  type NenPower,
  type SpellNotice,
  type SpellPlayer,
  type SpellRefusal,
} from '@gq/engine';
import type { NenType } from '@gq/shared';
import { SortIntent, TransformationIntent } from '@gq/shared';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { requireRole } from '../auth/guard.js';
import { paramsOf } from '../core/params.js';
import { recordPosition } from '../core/position.js';
import type { ActionCtx } from '../core/runner.js';
import {
  actionPatch,
  circulation,
  isLivreGele,
  limitesOf,
  loadBeacons,
  loadBooks,
  loadCatalogue,
  loadJoueur,
  loadJoueurs,
  saveBooks,
  updateJoueur,
  type JoueurRow,
} from '../core/state.js';
import { zones } from '../db/schema.js';
import { introuvable } from '../errors.js';
import { refus, send } from '../http.js';
import { newId } from '../ids.js';
import { parse } from '../validation.js';

type P = { Params: { partieId: string } };

const EXCLUS = new Set(['disqualifie', 'abandon']);

/** Joueur vu par le module des sorts. Sans test de Nen passé, aucun passif ne s'applique. */
async function spellPlayer(c: ActionCtx, j: JoueurRow, book: Book): Promise<SpellPlayer> {
  return {
    id: j.id,
    status: j.statut,
    position: j.position,
    book,
    nen: (j.nen ?? 'aucun') as NenType,
    pouvoirsUtilises: j.pouvoirsUtilises,
    immuniteJusqua: j.immuniteJusqua,
    dernierOffensifA: j.dernierOffensifA,
    geleJusqua: j.geleJusqua,
    livreGele: await isLivreGele(c.tx, j.id),
  };
}

const playerPatch = (p: SpellPlayer) => ({
  pouvoirsUtilises: [...p.pouvoirsUtilises] as NenPower[],
  immuniteJusqua: p.immuniteJusqua,
  dernierOffensifA: p.dernierOffensifA,
  geleJusqua: p.geleJusqua,
});

export const rangeOf = (p: { porteeSortsM: number; margeGpsMaxM: number }) => ({ porteeM: p.porteeSortsM, margeMaxM: p.margeGpsMaxM });

export async function sortsRoutes(app: FastifyInstance) {
  const { runner } = app.gq;

  // RG-10.1 / RG-11.1 : joueurs à portée, calculés par le serveur. Ni position ni distance (RG-10.12).
  app.get<P>('/parties/:partieId/a-portee', async (req) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    return runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
      const moi = await loadJoueur(c.tx, s.sub);
      if (!moi) throw introuvable('Joueur');
      const p = await paramsOf(c.tx, c.partie);
      const autres = (await loadJoueurs(c.tx, partieId, [moi.id])).filter((j) => !EXCLUS.has(j.statut));
      const proches = playersInRange(moi, autres, c.now, rangeOf(p));
      return { ok: true as const, joueurs: proches.map((j) => ({ id: j.id, pseudo: j.pseudo })) };
    });
  });

  app.post<P>('/parties/:partieId/sort', async (req, reply) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    const input = parse(SortIntent, req.body);
    const r = await runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
      const j = await loadJoueur(c.tx, s.sub);
      if (!j) throw introuvable('Joueur');
      await recordPosition(c, j, input.position);
      const deny = async (e: SpellRefusal | { ok: false; code: string; message: string }) => {
        await c.log({ action: 'sort', resultat: 'refus', details: { sort: input.sort, code: e.code } });
        return refus(e.code, e.message);
      };

      const cibleId = 'cibleId' in input ? input.cibleId : null;
      const cibleRow = cibleId ? await loadJoueur(c.tx, cibleId) : undefined;
      if (cibleId && (!cibleRow || cibleRow.partieId !== partieId)) return deny({ ok: false, code: 'cible_invalide', message: 'Cible invalide' });

      const [p, cat] = await Promise.all([paramsOf(c.tx, c.partie), loadCatalogue(c.tx, partieId)]);
      const books = await loadBooks(c.tx, cibleRow ? [j.id, cibleRow.id] : [j.id]);
      const lanceur = await spellPlayer(c, j, books.get(j.id)!);
      const cible = cibleRow ? await spellPlayer(c, cibleRow, books.get(cibleRow.id)!) : null;
      const w = { now: c.now, gameState: c.partie.etat, portee: rangeOf(p), rangDe: cat.rangDe, newId };

      let res:
        | { ok: true; lanceur: SpellPlayer; cible?: SpellPlayer; notice: SpellNotice; prive: Record<string, unknown> }
        | SpellRefusal;
      switch (input.sort) {
        case 'vol':
        case 'gel':
        case 'echange_force': {
          const o = castOffensive(
            w,
            {
              sort: input.sort,
              source: input.source,
              lanceur,
              cible: cible!,
              ...(input.emission ? { emission: true } : {}),
              ...(input.sort === 'echange_force' ? { carteDonneeId: input.carteDonneeId } : {}),
            },
            c.rng,
          );
          res = o.ok
            ? {
                ok: true,
                lanceur: o.lanceur,
                cible: o.cible,
                notice: o.notice,
                prive: {
                  resultat: o.resultat,
                  protection: o.protection ?? null,
                  recu: o.recu ? { itemId: o.recu.id, ...(o.recu.kind === 'carte' ? { carteId: o.recu.cardId, nom: cat.nomDe(o.recu.cardId) } : {}) } : null,
                },
              }
            : o;
          break;
        }
        case 'radar': {
          const zs = await c.tx.select().from(zones).where(eq(zones.partieId, partieId));
          const o = castRadar(w, { lanceur, itemId: input.itemId, cible: { id: cible!.id, position: cible!.position }, zones: zs.map((z) => ({ id: z.id, polygon: z.polygone })) });
          res = o.ok ? { ok: true, lanceur: o.lanceur, notice: o.notice, prive: { zone: zs.find((z) => z.id === o.resultat.zoneId)?.nom ?? null } } : o;
          break;
        }
        case 'revelation': {
          const rares = (await loadBeacons(c.tx, partieId)).filter((b) => b.state === 'active' && b.type === 'rare');
          const o = castRevelation(w, { lanceur, itemId: input.itemId, balisesRaresActives: rares }, c.rng);
          let zone: string | null = null;
          if (o.ok && o.resultat.zoneId) {
            const [z] = await c.tx.select().from(zones).where(and(eq(zones.id, o.resultat.zoneId)));
            zone = z?.nom ?? null;
          }
          res = o.ok ? { ok: true, lanceur: o.lanceur, notice: o.notice, prive: { zone } } : o;
          break;
        }
        case 'duplication': {
          const n = await circulation(c.tx, partieId);
          const limites = limitesOf(p);
          const o = castDuplication(w, {
            lanceur,
            itemId: input.itemId,
            carteItemId: input.carteItemId,
            sousLimite: (cardId) => (n.get(cardId) ?? 0) < limites[cat.rangDe(cardId)], // RG-10.7
          });
          res = o.ok
            ? { ok: true, lanceur: o.lanceur, notice: o.notice, prive: { copie: { itemId: o.resultat.copie.id, carteId: o.resultat.copie.cardId, contrefacon: !!o.resultat.copie.faux } } }
            : o;
          break;
        }
        case 'analyse': {
          const o = castAnalyse(w, { lanceur, itemId: input.itemId, page: input.page, designees: cat.designees });
          res = o.ok ? { ok: true, lanceur: o.lanceur, notice: o.notice, prive: { contrefacons: o.resultat.contrefacons } } : o; // RG-10.8 : privé
          break;
        }
        case 'barriere':
          res = castBarrier();
          break;
      }
      if (!res.ok) return deny(res);

      const changes = [{ joueurId: j.id, before: books.get(j.id)!, after: res.lanceur.book }];
      if (res.cible && cibleRow) changes.push({ joueurId: cibleRow.id, before: books.get(cibleRow.id)!, after: res.cible.book });
      await saveBooks(c.tx, partieId, c.now, changes);
      await updateJoueur(c.tx, j.id, { ...actionPatch(j, c.now), ...playerPatch(res.lanceur) });
      if (res.cible && cibleRow) await updateJoueur(c.tx, cibleRow.id, playerPatch(res.cible));

      const { notice } = res;
      await c.log({ action: 'sort', resultat: notice.resultat, details: { ...notice, ...res.prive } });
      // RG-10.5 alerte à la cible ; RG-10.6 écran géant (lanceur, cible, résultat).
      const pseudoCible = cibleRow?.pseudo ?? null;
      if (notice.cible) {
        c.emit({ type: 'joueur', id: notice.cible }, 'sort_recu', { lanceur: j.pseudo, sort: notice.sort, resultat: notice.resultat });
      }
      c.emit({ type: 'tracker' }, 'fil', { type: 'sort', lanceur: j.pseudo, cible: pseudoCible, sort: notice.sort, resultat: notice.resultat, heureJeu: c.now });
      return { ok: true as const, sort: notice.sort, resultat: notice.resultat, ...res.prive };
    });
    return send(reply, r);
  });

  // RG-5.4 : Texture Surprise (Transformation) : déguise un doublon en carte de même rang.
  app.post<P>('/parties/:partieId/transformation', async (req, reply) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    const input = parse(TransformationIntent, req.body);
    const r = await runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
      const j = await loadJoueur(c.tx, s.sub);
      if (!j) throw introuvable('Joueur');
      const cat = await loadCatalogue(c.tx, partieId);
      const book = (await loadBooks(c.tx, [j.id])).get(j.id)!;
      const rangs = new Map(cat.cartes.map((x) => [x.id, x.rang]));
      const o = transform({
        now: c.now,
        gameState: c.partie.etat,
        nen: (j.nen ?? 'aucun') as NenType,
        disponibleA: j.transformationDispoA,
        book,
        itemId: input.itemId,
        cibleCardId: input.cibleCarteId,
        rangDe: (id) => rangs.get(id),
      });
      if (!o.ok) {
        await c.log({ action: 'transformation', resultat: 'refus', details: { code: o.code } });
        return refus(o.code, o.message);
      }
      await saveBooks(c.tx, partieId, c.now, [{ joueurId: j.id, before: book, after: o.book }]);
      await updateJoueur(c.tx, j.id, { ...actionPatch(j, c.now), transformationDispoA: o.disponibleA });
      await c.log({ action: 'transformation', resultat: 'ok', details: { itemId: o.item.id, imite: o.item.cardId } });
      return { ok: true as const, itemId: o.item.id, carteId: o.item.cardId, disponibleA: o.disponibleA };
    });
    return send(reply, r);
  });
}
