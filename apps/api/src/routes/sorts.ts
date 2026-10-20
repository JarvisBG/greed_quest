// Sorts (RG-10) et pouvoir de Transformation (RG-5.4). Le serveur calcule portée, protections et effets (P1).
import {
  castAnalyse,
  castBarrier,
  castDuplication,
  castOffensive,
  castRadar,
  castRegard,
  castRetour,
  castRevelation,
  cartesParEmplacement,
  estInvisible,
  playersInRange,
  rechargesNenMs,
  transform,
  type Book,
  type BookItem,
  type NenPower,
  type SpellNotice,
  type SpellPlayer,
  type SpellRefusal,
} from '@gq/engine';
import type { NenType } from '@gq/shared';
import { SortIntent, TransformationIntent } from '@gq/shared';
import { and, desc, eq, gt, isNotNull, ne, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { requireRole } from '../auth/guard.js';
import { ENGAGEE, activeSession, engagedItems } from '../core/echanges.js';
import { paramsOf } from '../core/params.js';
import { recordPosition } from '../core/position.js';
import { noterRencontre, rencontresDe, seSontRencontres } from '../core/rencontres.js';
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

  saveBooks,
  updateJoueur,
  vueCarte,
  type JoueurRow,
} from '../core/state.js';
import { joueurs, journal, zones } from '../db/schema.js';
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
    pouvoirsA: j.pouvoirsA,
    pouvoirSpe: j.pouvoirSpe,
    speA: j.speA,
    zetsuJusqua: j.zetsuJusqua,
    immuniteJusqua: j.immuniteJusqua,
    dernierOffensifA: j.dernierOffensifA,
    geleJusqua: j.geleJusqua,
    accompagneJusqua: j.accompagneJusqua,
    // RG-8.19, RG-8.20 : états posés par les cartes de Maître du jeu.
    figeJusqua: j.figeJusqua,
    scelleJusqua: j.scelleJusqua,
    intouchableJusqua: j.intouchableJusqua,
    livreGele: await isLivreGele(c.tx, j.id),
  };
}

const playerPatch = (p: SpellPlayer) => ({
  pouvoirsA: { ...p.pouvoirsA } as Partial<Record<NenPower, number>>,
  immuniteJusqua: p.immuniteJusqua,
  dernierOffensifA: p.dernierOffensifA,
  geleJusqua: p.geleJusqua,
  speA: p.speA ?? null,
  zetsuJusqua: p.zetsuJusqua ?? null,
  accompagneJusqua: p.accompagneJusqua ?? null,
});

/** Amendement 2026-10-10 : Accompagnement, position exacte de la cible envoyée au seul lanceur (dérogation à RG-10.12). */
export function positionAccompagnee(cible: { id: string; pseudo: string; position: { lat: number; lng: number; precisionM: number; a: number } | null; accompagneJusqua: number | null }) {
  return {
    cibleId: cible.id,
    pseudo: cible.pseudo,
    jusqua: cible.accompagneJusqua,
    position: cible.position ? { lat: cible.position.lat, lng: cible.position.lng, precisionM: cible.position.precisionM, a: cible.position.a } : null,
  };
}

/**
 * Page ⑪ (RG-10.5) : ce que la cible voit d'une carte qui quitte ou rejoint son Book : la carte telle qu'elle lui
 * paraissait (une contrefaçon non démasquée paraît vraie), et son emplacement avant le sort (fixe ou libre).
 */
function vueItemCible(item: BookItem, avant: Book, designees: readonly string[], cat: Parameters<typeof vueCarte>[0], limites: Parameters<typeof vueCarte>[2]) {
  if (item.kind === 'sort') return { kind: 'sort' as const, itemId: item.id, sort: item.spell, emplacement: 'libre' as const };
  if (item.kind === 'objet') return { kind: 'objet' as const, itemId: item.id, objet: item.objet, emplacement: 'libre' as const };
  if (item.kind === 'gm') return { kind: 'gm' as const, itemId: item.id, gm: item.gm, emplacement: 'libre' as const }; // RG-8.18
  const fixe = cartesParEmplacement(avant, designees).fixes.some((x) => x.id === item.id);
  return { kind: 'carte' as const, itemId: item.id, carteId: item.cardId, ...vueCarte(cat, item.cardId, limites), emplacement: fixe ? ('fixe' as const) : ('libre' as const) };
}

export const rangeOf = (p: { porteeSortsM: number; margeGpsMaxM: number; ciblableMin: number }) => ({
  porteeM: p.porteeSortsM,
  margeMaxM: p.margeGpsMaxM,
  ciblableMs: p.ciblableMin * 60_000, // amendement RG-10.10
});

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
      // Zetsu (Spécialisation) : un joueur invisible n'apparaît dans aucune liste.
      // Colonnes utiles seulement (pas la fiche entière de chaque joueur) : offre gratuite de la base.
      const lus = await c.tx
        .select({ id: joueurs.id, pseudo: joueurs.pseudo, statut: joueurs.statut, position: joueurs.position, zetsuJusqua: joueurs.zetsuJusqua })
        .from(joueurs)
        .where(and(eq(joueurs.partieId, partieId), ne(joueurs.id, moi.id)));
      const autres = lus.filter((j) => !EXCLUS.has(j.statut) && !estInvisible(j, c.now));
      const proches = playersInRange(moi, autres, c.now, rangeOf(p));
      // `tous` : cibles du Radar (RG-10, « liste joueurs ») et de l'Émission (hors portée, RG-10.1) ; pseudos seulement.
      const tous = autres.map((j) => ({ id: j.id, pseudo: j.pseudo })).sort((a, b) => a.pseudo.localeCompare(b.pseudo, 'fr'));
      // `croises` : cibles de Regard, joueurs déjà rencontrés (amendement 2026-10-09).
      const deja = new Set(await rencontresDe(c.tx, moi.id));
      const croises = tous.filter((x) => deja.has(x.id));
      return { ok: true as const, joueurs: proches.map((j) => ({ id: j.id, pseudo: j.pseudo })), tous, croises };
    });
  });

  // Amendement 2026-10-10 : Accompagnement en cours lancé par ce joueur (reprise après rechargement de l'app).
  app.get<P>('/parties/:partieId/accompagnement', async (req) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    return runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
      const [cible] = await c.tx
        .select()
        .from(joueurs)
        .where(and(eq(joueurs.partieId, partieId), eq(joueurs.accompagnePar, s.sub), gt(joueurs.accompagneJusqua, c.now)));
      return { ok: true as const, accompagnement: cible ? { ...positionAccompagnee(cible), resteMs: cible.accompagneJusqua! - c.now } : null };
    });
  });

  // Page ⑪ (RG-10.5) : sorts reçus depuis la dernière alerte vue par l'app (app fermée, hors ligne). Sans `apres`,
  // seulement le repère actuel : l'app part de là. Lu dans le Journal, ce que la cible a le droit de savoir.
  app.get<P & { Querystring: { apres?: string } }>('/parties/:partieId/sorts-recus', async (req) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    const apres = Number(req.query.apres);
    return runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
      const [dernier] = await c.tx.select({ id: journal.id }).from(journal).where(eq(journal.partieId, partieId)).orderBy(desc(journal.id)).limit(1);
      const repere = dernier?.id ?? 0;
      if (!Number.isInteger(apres) || apres < 0) return { ok: true as const, repere, maintenant: c.now, recus: [] };
      const lignes = await c.tx
        .select()
        .from(journal)
        .where(
          and(
            eq(journal.partieId, partieId),
            eq(journal.action, 'sort'),
            gt(journal.id, apres),
            isNotNull(sql`${journal.details}->'alerte'`),
            sql`${journal.details}->>'cible' = ${s.sub}`,
          ),
        )
        .orderBy(journal.id)
        .limit(20);
      const recus = lignes.map((l) => ({ n: l.id, heureJeu: l.heureJeu, ...(l.details!.alerte as Record<string, unknown>) }));
      return { ok: true as const, repere, maintenant: c.now, recus };
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

      // Cartes engagées dans un échange en cours : verrouillées. RG-10.8 : pas d'Analyse pendant un échange.
      if (input.sort === 'echange_force' && (await engagedItems(c.tx, partieId, j.id, c.now)).has(input.carteDonneeId)) return deny(ENGAGEE);
      if (input.sort === 'analyse' && (await activeSession(c.tx, partieId, j.id, c.now))) {
        return deny({ ok: false, code: 'echange_en_cours', message: 'Pas d’Analyse pendant un échange' });
      }

      const cibleId = 'cibleId' in input ? input.cibleId : null;
      const cibleRow = cibleId ? await loadJoueur(c.tx, cibleId) : undefined;
      if (cibleId && (!cibleRow || cibleRow.partieId !== partieId)) return deny({ ok: false, code: 'cible_invalide', message: 'Cible invalide' });

      const [p, cat] = await Promise.all([paramsOf(c.tx, c.partie), loadCatalogue(c.tx, partieId)]);
      const books = await loadBooks(c.tx, cibleRow ? [j.id, cibleRow.id] : [j.id]);
      const lanceur = await spellPlayer(c, j, books.get(j.id)!);
      const cible = cibleRow ? await spellPlayer(c, cibleRow, books.get(cibleRow.id)!) : null;
      // Amendement 2026-10-10 : pouvoirs de Nen rechargeables (RG-14).
      const w = {
        now: c.now,
        gameState: c.partie.etat,
        portee: rangeOf(p),
        rangDe: cat.rangDe,
        newId,
        rechargeNenMs: rechargesNenMs(p),
        rechargeSpeMs: p.rechargeSpeMin * 60_000, // Bandit
        designees: cat.designees, // RG-8.5 amendé : Vol (fixes), Pickpocket (libres), Voyance, Clairvoyance
      };

      let res:
        | { ok: true; lanceur: SpellPlayer; cible?: SpellPlayer; notice: SpellNotice; prive: Record<string, unknown> }
        | SpellRefusal;
      // Page ⑪ (RG-10.5) : ce que la cible apprend en plus du lanceur, du sort et du résultat.
      let pourCible: Record<string, unknown> = {};
      switch (input.sort) {
        case 'vol':
        case 'gel':
        case 'echange_force':
        case 'pickpocket':
        case 'accompagnement': {
          const o = castOffensive(
            w,
            {
              sort: input.sort,
              source: input.sort === 'pickpocket' || input.sort === 'accompagnement' ? { type: 'carte', itemId: input.itemId } : input.source,
              lanceur,
              cible: cible!,
              ...('emission' in input && input.emission ? { emission: true } : {}),
              ...(input.sort === 'accompagnement' ? { rencontre: await seSontRencontres(c.tx, j.id, cible!.id) } : {}),
              ...(input.sort === 'echange_force' ? { carteDonneeId: input.carteDonneeId } : {}),
              ...(input.sort === 'vol' && input.carteVoulueId ? { carteVoulueId: input.carteVoulueId } : {}),
              ...(input.sort === 'vol' && input.viserCarteGm ? { viserCarteGm: true } : {}),
            },
            c.rng,
          );
          if (o.ok) {
            const avant = cible!.book, limites = limitesOf(p);
            pourCible = {
              // Vol, Pickpocket, Échange forcé : la carte qui part (et, pour l'échange, celle qui arrive).
              perdue: o.recu ? vueItemCible(o.recu, avant, cat.designees, cat, limites) : null,
              recue: o.donne ? vueItemCible(o.donne, o.cible.book, cat.designees, cat, limites) : null,
              protection: o.protection ?? null,
              // L'épée du vol (Bandit) ou Manipulation : un pouvoir, pas une carte de sort.
              pouvoir: 'source' in input && input.source.type === 'pouvoir' ? (input.sort === 'vol' ? 'bandit' : 'manipulation') : null,
            };
          }
          res = o.ok
            ? {
                ok: true,
                lanceur: o.lanceur,
                cible: o.cible,
                notice: o.notice,
                prive: {
                  resultat: o.resultat,
                  protection: o.protection ?? null,
                  // Page ⑧ : la carte prise se retourne chez le lanceur (numéro, rang, limite, texte).
                  recu: o.recu ? { itemId: o.recu.id, ...(o.recu.kind === 'carte' ? { carteId: o.recu.cardId, ...vueCarte(cat, o.recu.cardId, limitesOf(p)) } : {}) } : null,
                },
              }
            : o;
          break;
        }
        case 'radar': {
          const zs = await c.tx.select().from(zones).where(eq(zones.partieId, partieId));
          const o = castRadar(w, {
            lanceur,
            itemId: input.itemId,
            cible: { id: cible!.id, position: cible!.position, book: cible!.book, zetsuJusqua: cible!.zetsuJusqua ?? null, intouchableJusqua: cible!.intouchableJusqua ?? null },
            zones: zs.map((z) => ({ id: z.id, polygon: z.polygone })),
          });
          if (o.ok && o.voile) pourCible = { protection: 'voile' };
          res = o.ok
            ? {
                ok: true,
                lanceur: o.lanceur,
                // Voile d'ombre de la cible consommé (objet, amendement 2026-10-10).
                ...(o.voile ? { cible: { ...cible!, book: o.voile.cibleBook } } : {}),
                notice: o.notice,
                prive: {
                  zone: zs.find((z) => z.id === o.resultat.zoneId)?.nom ?? null,
                  // Page ⑨ : âge de cette position, en minutes (« il y a 3 min »), sans jamais la position elle-même (RG-10.12).
                  ageMin: o.resultat.zoneId && cible!.position ? Math.max(0, Math.floor((c.now - cible!.position.a) / 60_000)) : null,
                  protection: o.voile ? 'voile' : null,
                },
              }
            : o;
          break;
        }
        case 'regard':
        case 'clairvoyance': {
          const o = castRegard(w, {
            lanceur,
            itemId: input.itemId,
            cible: { id: cible!.id, book: cible!.book, livreGele: cible!.livreGele, zetsuJusqua: cible!.zetsuJusqua ?? null, intouchableJusqua: cible!.intouchableJusqua ?? null },
            rencontre: await seSontRencontres(c.tx, j.id, cible!.id),
            sort: input.sort,
          });
          if (o.ok && o.voile) pourCible = { protection: 'voile' };
          res = o.ok
            ? {
                ok: true,
                lanceur: o.lanceur,
                ...(o.voile ? { cible: { ...cible!, book: o.voile.cibleBook } } : {}),
                notice: o.notice,
                prive: {
                  protection: o.voile ? 'voile' : null,
                  cartes: o.resultat.cartes
                    .map((x) => ({ carteId: x.cardId, numero: cat.numeroDe(x.cardId), nom: cat.nomDe(x.cardId), rang: cat.rangDe(x.cardId), n: x.n, contrefacon: x.contrefacon }))
                    .sort((x, y) => x.numero - y.numero),
                },
              }
            : o;
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
          // RG-8.9 : ce que chaque contrefaçon démasquée était (lu avant la révélation) : un doublon déguisé redevient
          // sa vraie carte, une copie de Duplication reste « Contrefaçon de… ». Page ⑨ : la cinématique le montre.
          const demasquees = o.ok
            ? o.resultat.contrefacons.map((id) => {
                const i = lanceur.book.items.find((x) => x.id === id);
                const faux = i?.kind === 'carte' ? i.faux : undefined;
                return { itemId: id, nature: faux?.nature ?? 'copie', vraie: faux?.nature === 'deguise' ? vueCarte(cat, faux.vraieCarteId, limitesOf(p)) : null };
              })
            : [];
          res = o.ok ? { ok: true, lanceur: o.lanceur, notice: o.notice, prive: { contrefacons: o.resultat.contrefacons, demasquees } } : o; // RG-10.8 : privé
          break;
        }
        case 'retour': {
          const o = castRetour(w, { lanceur, itemId: input.itemId, ville: input.ville, visitees: j.villesVisitees });
          res = o.ok ? { ok: true, lanceur: o.lanceur, notice: o.notice, prive: { ville: o.resultat.ville, jusqua: c.now + p.retourMin * 60_000 } } : o;
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
      await updateJoueur(c.tx, j.id, {
        ...actionPatch(j, c.now),
        ...playerPatch(res.lanceur),
        // Retour : visite à distance de la ville (boutique, enchères) pendant `retourMin`.
        ...(input.sort === 'retour' ? { retourVille: input.ville, retourJusqua: res.prive.jusqua as number } : {}),
      });
      if (res.cible && cibleRow) {
        const accompagne = input.sort === 'accompagnement' && res.notice.resultat === 'reussi';
        await updateJoueur(c.tx, cibleRow.id, { ...playerPatch(res.cible), ...(accompagne ? { accompagnePar: j.id } : {}) });
        if (accompagne) {
          // Position exacte de la cible, au lanceur seulement, tout de suite puis à chaque nouvelle position (scan.ts).
          const vue = positionAccompagnee({ ...cibleRow, accompagneJusqua: res.cible.accompagneJusqua ?? null });
          res.prive.accompagnement = vue;
          c.emit({ type: 'joueur', id: j.id }, 'accompagnement', vue);
        }
      }

      const { notice } = res;
      // Amendement 2026-10-09 : Voyance (et Clairvoyance) restent anonymes (la cible sait qu'on l'a regardée, pas qui ; l'écran ne nomme personne).
      const anonyme = notice.sort === 'regard' || notice.sort === 'clairvoyance';
      // RG-10.5 : alerte à la cible (lanceur, sort, résultat), gardée dans le Journal pour le rattrapage (page ⑪).
      const alerte = notice.cible ? { lanceur: anonyme ? null : j.pseudo, sort: notice.sort, resultat: notice.resultat, ...pourCible } : null;
      const ligne = await c.log({ action: 'sort', resultat: notice.resultat, details: { ...notice, ...res.prive, ...(alerte ? { alerte } : {}) } });
      // RG-10.6 écran géant (lanceur, cible, résultat).
      const pseudoCible = cibleRow?.pseudo ?? null;
      if (notice.cible && alerte) {
        c.emit({ type: 'joueur', id: notice.cible }, 'sort_recu', { n: ligne.id, heureJeu: c.now, ...alerte });
        await noterRencontre(c, j.id, notice.cible); // un sort ciblé vaut rencontre (Radar, Émission)
      }
      c.emit({ type: 'tracker' }, 'fil', {
        type: 'sort',
        lanceur: anonyme ? null : j.pseudo,
        cible: anonyme ? null : pseudoCible,
        sort: notice.sort,
        resultat: notice.resultat,
        heureJeu: c.now,
      });
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
      if ((await engagedItems(c.tx, partieId, j.id, c.now)).has(input.itemId)) return refus(ENGAGEE.code, ENGAGEE.message);
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
      // Décision 2026-10-12 : sur une contrefaçon ignorée, le déguisement échoue (pouvoir utilisé, carte démasquée).
      await c.log({ action: 'transformation', resultat: o.resultat === 'reussi' ? 'ok' : 'contrefacon', details: { itemId: o.item.id, imite: o.resultat === 'reussi' ? o.item.cardId : null } });
      return { ok: true as const, resultat: o.resultat, itemId: o.item.id, carteId: o.item.cardId, disponibleA: o.disponibleA };
    });
    return send(reply, r);
  });
}
