// Boutique de Masadora (RG-9) : paquets de sorts par vague, revente de cartes (contrefaçons révélées, RG-8.9).
import {
  DEFAULT_SHOP_CONFIG,
  buyPack,
  currentWave,
  sellCard,
  shopPriceMultiplier,
  type ShopConfig,
  type ShopPlayer,
} from '@gq/engine';
import { AchatIntent, ReventeIntent } from '@gq/shared';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { requireRole } from '../auth/guard.js';
import { ENGAGEE, engagedItems } from '../core/echanges.js';
import { paramsOf } from '../core/params.js';
import type { PartieRow } from '../core/partie.js';
import { recordPosition } from '../core/position.js';
import type { ActionCtx } from '../core/runner.js';
import { actionPatch, isLivreGele, loadActiveEvents, loadBook, loadCatalogue, loadJoueur, saveBooks, updateJoueur, type JoueurRow } from '../core/state.js';
import type { DbOrTx } from '../db/client.js';
import { parties, zones, type ZoneType } from '../db/schema.js';
import { introuvable } from '../errors.js';
import { refus, send } from '../http.js';
import { newId } from '../ids.js';
import { parse } from '../validation.js';

type P = { Params: { partieId: string } };

/** RG-9 : prix et limites, réglables par le GM. */
export const shopConfigOf = (p: PartieRow): ShopConfig => ({ ...DEFAULT_SHOP_CONFIG, ...p.reglagesBoutique });

/** Le QR scanné est-il celui d'un lieu de ce type, dans cette partie ? */
export async function isPlaceQr(db: DbOrTx, partieId: string, qr: string, type: ZoneType): Promise<boolean> {
  const [z] = await db.select({ id: zones.id }).from(zones).where(and(eq(zones.partieId, partieId), eq(zones.qr, qr), eq(zones.type, type)));
  return z !== undefined;
}

const shopper = (j: JoueurRow, book: ShopPlayer['book']): ShopPlayer => ({ id: j.id, status: j.statut, position: j.position, jenny: j.jenny, book });

async function wave(c: ActionCtx) {
  const p = await paramsOf(c.tx, c.partie);
  return currentWave(c.partie.vagueBoutique, c.now, 0, p.paquetsParVague); // RG-9.3, vagues comptées depuis le démarrage
}

export async function boutiqueRoutes(app: FastifyInstance) {
  const { runner } = app.gq;

  app.get<P>('/parties/:partieId/boutique', async (req) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    return runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
      const w = await wave(c);
      const config = shopConfigOf(c.partie);
      const mult = shopPriceMultiplier(await loadActiveEvents(c.tx, partieId), c.now);
      return {
        ok: true as const,
        prixPaquet: Math.ceil(config.prixPaquet * mult),
        paquetsRestants: w.stock,
        mesAchats: w.achats[s.sub] ?? 0,
        maxParVague: config.maxPaquetsParJoueurParVague,
        revente: config.revente,
      };
    });
  });

  app.post<P>('/parties/:partieId/boutique/achat', async (req, reply) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    const input = parse(AchatIntent, req.body);
    const r = await runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
      const j = await loadJoueur(c.tx, s.sub);
      if (!j) throw introuvable('Joueur');
      await recordPosition(c, j, input.position);
      const [book, cat, events, w] = await Promise.all([loadBook(c.tx, j.id), loadCatalogue(c.tx, partieId), loadActiveEvents(c.tx, partieId), wave(c)]);
      const res = buyPack(
        {
          now: c.now,
          gameState: c.partie.etat,
          qrBoutiqueScanne: await isPlaceQr(c.tx, partieId, input.qr, 'masadora'),
          designees: cat.designees,
          config: shopConfigOf(c.partie),
          wave: w,
          multiplicateurPrix: shopPriceMultiplier(events, c.now), // Krach de Masadora (RG-12)
          newId,
        },
        shopper(j, book),
        c.rng,
      );
      if (!res.ok) {
        await c.log({ action: 'achat', resultat: 'refus', details: { code: res.code } });
        return refus(res.code, res.message);
      }
      await saveBooks(c.tx, partieId, c.now, [{ joueurId: j.id, before: book, after: res.player.book }]);
      await updateJoueur(c.tx, j.id, { ...actionPatch(j, c.now), jenny: res.player.jenny });
      await c.tx.update(parties).set({ vagueBoutique: res.wave }).where(eq(parties.id, partieId));
      const sorts = res.sorts.map((x) => ({ itemId: x.id, sort: x.spell }));
      await c.log({ action: 'achat', resultat: 'ok', details: { prix: res.prix, sorts, vague: res.wave.index } });
      return { ok: true as const, prix: res.prix, sorts, jenny: res.player.jenny };
    });
    return send(reply, r);
  });

  app.post<P>('/parties/:partieId/boutique/revente', async (req, reply) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    const input = parse(ReventeIntent, req.body);
    const r = await runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
      const j = await loadJoueur(c.tx, s.sub);
      if (!j) throw introuvable('Joueur');
      await recordPosition(c, j, input.position);
      const [book, cat] = await Promise.all([loadBook(c.tx, j.id), loadCatalogue(c.tx, partieId)]);
      if ((await engagedItems(c.tx, partieId, j.id, c.now)).has(input.itemId)) return refus(ENGAGEE.code, ENGAGEE.message);
      // RG-13.1 : un Livre gelé (Clear provisoire) ne change plus.
      if (await isLivreGele(c.tx, j.id)) return refus('livre_gele', 'Ton Livre est gelé : va voir le Game Master');
      const res = sellCard(
        {
          now: c.now,
          gameState: c.partie.etat,
          qrBoutiqueScanne: await isPlaceQr(c.tx, partieId, input.qr, 'masadora'),
          designees: cat.designees,
          config: shopConfigOf(c.partie),
        },
        shopper(j, book),
        input.itemId,
        cat.rangDe,
      );
      if (!res.ok) {
        await c.log({ action: 'revente', resultat: 'refus', details: { code: res.code } });
        return refus(res.code, res.message);
      }
      await saveBooks(c.tx, partieId, c.now, [{ joueurId: j.id, before: book, after: res.player.book }]);
      await updateJoueur(c.tx, j.id, { ...actionPatch(j, c.now), jenny: res.player.jenny });
      await c.log({ action: 'revente', resultat: 'ok', details: { itemId: input.itemId, carteId: res.cardId, prix: res.prix, contrefacon: res.contrefacon } });
      // RG-8.9 : Masadora révèle la contrefaçon au vendeur.
      return { ok: true as const, prix: res.prix, contrefacon: res.contrefacon, jenny: res.player.jenny };
    });
    return send(reply, r);
  });
}
