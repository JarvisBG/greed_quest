// Intentions de terrain : envoi de position (RG-10.9) et scan de balise (RG-7, tirage RG-8.3).
import {
  ROTATION_INTERVAL_MS,
  SCAN_RATE_WINDOW_MS,
  SHARED_PHOTO_WINDOW_MS,
  isAbnormalScanRate,
  addItem,
  checkScan,
  closedZones,
  consumeDraw,
  draw,
  gainsPerDraw,
  isBookFull,
  isSharedPhotoSuspect,
  estInvisible,
  isValidPosition,
  layoutBook,
  objetDeRepli,
  objetDuType,
  previousDrawsOn,
  replaceExhausted,
  type BeaconChange,
  type BookItem,
  type DrawResult,
  type Position,
} from '@gq/engine';
import { RANK_POINTS, ScanIntent, PositionInput } from '@gq/shared';
import { and, eq, gte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { requireRole } from '../auth/guard.js';
import { alerte } from '../core/alertes.js';
import { balisesParZone } from '../core/ecran.js';
import { paramsOf } from '../core/params.js';
import { recordPosition } from '../core/position.js';
import type { ActionCtx } from '../core/runner.js';
import {
  actionPatch,
  catalogForDraw,
  limitesOf,
  loadActiveEvents,
  loadBeacons,
  loadBook,
  loadCatalogue,
  loadJoueur,
  saveBeacons,
  saveBooks,
  updateJoueur,
} from '../core/state.js';
import { journal } from '../db/schema.js';
import { introuvable } from '../errors.js';
import { refus, send } from '../http.js';
import { newId } from '../ids.js';
import { parse } from '../validation.js';

type P = { Params: { partieId: string } };

export const OFFLINE_MAX_AGE_REAL_MS = 10 * 60_000; // RG-7.5

/** RG-6.4 : visites récentes par zone (tirages réussis depuis la dernière période de rotation). */
export async function visitesParZone(c: ActionCtx): Promise<Map<string, number>> {
  const rows = await c.tx
    .select({ zoneId: sql<string>`${journal.details}->>'zoneId'` })
    .from(journal)
    .where(
      and(
        eq(journal.partieId, c.partie.id),
        eq(journal.action, 'scan'),
        eq(journal.resultat, 'ok'),
        gte(journal.heureJeu, c.now - ROTATION_INTERVAL_MS),
      ),
    );
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.zoneId, (m.get(r.zoneId) ?? 0) + 1);
  return m;
}

/** Diffusion des changements de balises : carte des balises (équipe), nombre d'actives par zone (écran, RG-6.5). */
export async function emitBeaconChanges(c: ActionCtx, changes: readonly BeaconChange[]): Promise<void> {
  if (changes.length === 0) return;
  for (const ch of changes) await c.log({ action: 'balise', resultat: ch.to, details: { ...ch } });
  c.emit({ type: 'staff' }, 'balises', changes);
  c.emit({ type: 'tracker' }, 'balises_par_zone', await balisesParZone(c));
}

export async function scanRoutes(app: FastifyInstance) {
  const { runner } = app.gq;

  // RG-10.9 : position envoyée toutes les 15 s si déplacement > 10 m (décidé côté app).
  app.post<P>('/parties/:partieId/position', async (req) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    const input = parse(PositionInput, req.body);
    return runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
      const j = await loadJoueur(c.tx, s.sub);
      if (!j) throw introuvable('Joueur');
      const pos = await recordPosition(c, j, input);
      // Zetsu : la position est notée mais ne s'affiche pas sur la carte de chaleur (core/ecran.ts).
      await c.log({ action: 'position', resultat: 'ok', details: { ...pos, ...(estInvisible(j, c.now) ? { zetsu: true } : {}) } });
      return { ok: true as const };
    });
  });

  // RG-7 : scan d'une balise. Le client envoie seulement « j'ai scanné tel QR, ici, à telle heure » (P1).
  app.post<P>('/parties/:partieId/scan', async (req, reply) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    const input = parse(ScanIntent, req.body);
    const r = await runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
      const j = await loadJoueur(c.tx, s.sub);
      if (!j) throw introuvable('Joueur');
      // La position du scan est journalisée : elle sert à détecter les photos de balise partagées (RG-15).
      let position: Position | undefined;
      const deny = async (code: string, message: string, details: Record<string, unknown> = {}) => {
        await c.log({ action: 'scan', resultat: 'refus', details: { code, baliseId: input.baliseId, position, ...details } }); // RG-7.4
        return refus(code, message);
      };

      // RG-7.5 : scan hors ligne traité s'il a moins de 10 min, contre l'état serveur à la réception.
      const age = input.scanneA !== undefined ? Math.max(0, c.realNow - input.scanneA) : 0;
      if (age >= OFFLINE_MAX_AGE_REAL_MS) return deny('scan_perime', 'Scan trop ancien (plus de 10 min) : il n’a pas été pris en compte');
      const pos = await recordPosition(c, j, input.position, Math.max(0, c.now - age));
      position = pos;

      const beacons = await loadBeacons(c.tx, partieId);
      const beacon = beacons.find((b) => b.id === input.baliseId);
      if (!beacon) return deny('balise_inconnue', 'Ce QR code n’est pas une balise du jeu');

      await checkSharedPhoto(c, j.id, j.pseudo, beacon.id, pos);

      const [p, cat, events, book] = await Promise.all([
        paramsOf(c.tx, c.partie),
        loadCatalogue(c.tx, partieId),
        loadActiveEvents(c.tx, partieId),
        loadBook(c.tx, j.id),
      ]);
      const scanCtx = {
        now: c.now,
        gameState: c.partie.etat,
        player: {
          status: j.statut,
          geleJusqua: j.geleJusqua,
          // Position prise au moment du scan (RG-7.5 : un scan hors ligne garde la sienne).
          positionValide: isValidPosition(pos, pos.a),
          historiqueTirages: j.historiqueTirages,
          dernierTirageA: j.dernierTirageA,
          livrePlein: isBookFull(book, cat.designees),
        },
        beacon: { id: beacon.id, state: beacon.state, zoneId: beacon.zoneId, stock: beacon.stock },
        zonesFermees: closedZones(events, c.now),
        k: p.kBoucle,
      };
      let check = checkScan(scanCtx);
      // Second souffle (objet, amendement 2026-10-10) : consommé seulement si la boucle refuserait ce scan.
      let souffle = input.secondSouffle && !check.ok && check.code === 'boucle' ? objetDuType(book, 'souffle') : undefined;
      if (souffle) {
        check = checkScan({ ...scanCtx, ignorerBoucle: true });
        if (!check.ok) souffle = undefined;
      }
      if (!check.ok) return deny(check.code, check.message, { zoneId: beacon.zoneId });

      // RG-8.3 : tirage ; Double gain (RG-12) = 2 gains, le stock ne baisse qu'une fois.
      const catalogue = await catalogForDraw(c.tx, cat, partieId);
      const limites = limitesOf(p);
      const tiragesPrecedents = previousDrawsOn(j.historiqueTirages, beacon.id);
      let after = souffle ? { ...book, items: book.items.filter((i) => i.id !== souffle!.id) } : book;
      let jenny = j.jenny;
      const gains: DrawResult[] = [];
      const recus: BookItem[] = [];
      const objetsRecus: string[] = [];
      // Fortune (Spécialisation, amendement 2026-10-10) : un gain de plus, une fois.
      const nbGains = gainsPerDraw(events, beacon.zoneId, c.now) + (j.fortuneArmee ? 1 : 0);
      for (let n = 0; n < nbGains; n++) {
        const g = draw({ beaconType: beacon.type ?? 'standard', tiragesPrecedents, catalogue, limites }, c.rng);
        gains.push(g);
        if (g.kind === 'carte') {
          const item: BookItem = { kind: 'carte', id: newId(), cardId: g.cardId, origine: { type: 'balise', baliseId: beacon.id }, obtenuA: c.now };
          after = addItem(after, item);
          recus.push(item);
          const entry = catalogue.find((x) => x.id === g.cardId);
          if (entry) entry.enCirculation++;
        } else if (g.kind === 'sort') {
          const item: BookItem = { kind: 'sort', id: newId(), spell: g.spell, obtenuA: c.now };
          after = addItem(after, item);
          recus.push(item);
        } else {
          jenny += g.amount;
          // Amendement 2026-10-10 : une partie des replis « carte épuisée » donne un objet en plus des jenny.
          const o = g.repli ? objetDeRepli(after, p.objetsReplisPct, c.rng) : null;
          if (o) {
            const item: BookItem = { kind: 'objet', id: newId(), objet: o, obtenuA: c.now };
            after = addItem(after, item);
            recus.push(item);
            objetsRecus.push(o);
          }
        }
      }
      await saveBooks(c.tx, partieId, c.now, [{ joueurId: j.id, before: book, after }]);
      await updateJoueur(c.tx, j.id, {
        ...actionPatch(j, c.now),
        jenny,
        historiqueTirages: [...j.historiqueTirages, beacon.id],
        dernierTirageA: c.now,
        fortuneArmee: false,
      });

      // RG-6.2 / 6.3 : stock décrémenté ; épuisée → une dormante d'une autre zone prend le relais.
      const consumed = consumeDraw(beacon, c.now);
      let next = beacons.map((b) => (b.id === beacon.id ? consumed.beacon : b));
      const changes: BeaconChange[] = consumed.change ? [consumed.change] : [];
      if (consumed.change) {
        const rep = replaceExhausted(
          next,
          consumed.beacon,
          p.balisesActives,
          { stockBalise: p.stockBalise, partRaresPct: p.partRaresPct, visitesParZone: await visitesParZone(c) },
          c.rng,
        );
        next = rep.beacons;
        changes.push(...rep.changes);
      }
      await saveBeacons(c.tx, beacons, next);

      const vue = gains.map((g) =>
        g.kind === 'carte'
          ? { kind: 'carte' as const, carteId: g.cardId, nom: cat.nomDe(g.cardId), rang: g.rank }
          : g.kind === 'sort'
            ? { kind: 'sort' as const, sort: g.spell }
            : { kind: 'jenny' as const, montant: g.amount },
      );
      const vueObjets = objetsRecus.map((o) => ({ kind: 'objet' as const, objet: o }));
      await c.log({
        action: 'scan',
        resultat: 'ok',
        details: { baliseId: beacon.id, zoneId: beacon.zoneId, type: beacon.type, position, gains: vue, objets: vueObjets, secondSouffle: !!souffle },
      });
      await emitBeaconChanges(c, changes);
      await checkScanRate(c, j.id, j.pseudo);

      // Diffusion (REGLES.md) : détail au joueur ; fil de l'écran si rang ≥ A ; progression.
      c.emit({ type: 'joueur', id: j.id }, 'tirage', { gains: [...vue, ...vueObjets], jenny });
      for (const g of vue) {
        if (g.kind === 'carte' && RANK_POINTS[g.rang] >= RANK_POINTS.A) {
          c.emit({ type: 'tracker' }, 'fil', { type: 'tirage', pseudo: j.pseudo, carte: g.nom, rang: g.rang, heureJeu: c.now });
        }
      }
      const distinctes = layoutBook(after, cat.designees).designes.filter((d) => d.slot.etat === 'plein').length;
      c.emit({ type: 'tracker' }, 'progression', { joueurId: j.id, pseudo: j.pseudo, cartes: distinctes });

      return { ok: true as const, gains: [...vue, ...vueObjets], jenny, items: recus.map((i) => i.id), secondSouffle: !!souffle };
    });
    return send(reply, r);
  });
}

/** RG-15 : même balise scannée par deux joueurs à moins de 10 s d'écart et à plus de 200 m l'un de l'autre. */
async function checkSharedPhoto(c: ActionCtx, joueurId: string, pseudo: string, baliseId: string, pos: Position): Promise<void> {
  const recents = await c.tx
    .select({ acteurId: journal.acteurId, details: journal.details })
    .from(journal)
    .where(
      and(
        eq(journal.partieId, c.partie.id),
        eq(journal.action, 'scan'),
        gte(journal.heureJeu, c.now - SHARED_PHOTO_WINDOW_MS),
        sql`${journal.details}->>'baliseId' = ${baliseId}`,
      ),
    );
  for (const r of recents) {
    const autre = r.details?.position as Position | undefined;
    if (!r.acteurId || !autre) continue;
    const a = { playerId: joueurId, beaconId: baliseId, position: pos };
    const b = { playerId: r.acteurId, beaconId: baliseId, position: autre };
    if (isSharedPhotoSuspect(a, b)) {
      await alerte(c, 'photo_partagee', { baliseId, joueurs: [joueurId, r.acteurId], pseudo });
      return;
    }
  }
}

/** RG-15 : rythme de scan anormal (au plus une alerte par joueur et par fenêtre de 10 min). */
async function checkScanRate(c: ActionCtx, joueurId: string, pseudo: string): Promise<void> {
  const depuis = c.now - SCAN_RATE_WINDOW_MS;
  const recents = await c.tx
    .select({ a: journal.heureJeu, action: journal.action, resultat: journal.resultat, details: journal.details })
    .from(journal)
    .where(and(eq(journal.partieId, c.partie.id), gte(journal.heureJeu, depuis), sql`(${journal.acteurId} = ${joueurId} or ${journal.details}->>'joueurId' = ${joueurId})`));
  const tirages = recents.filter((r) => r.action === 'scan' && r.resultat === 'ok').map((r) => r.a);
  if (!isAbnormalScanRate(tirages, c.now)) return;
  if (recents.some((r) => r.action === 'alerte' && r.resultat === 'rythme_scan')) return;
  await alerte(c, 'rythme_scan', { joueurId, pseudo, tirages: tirages.length, fenetreMin: SCAN_RATE_WINDOW_MS / 60_000 });
}
