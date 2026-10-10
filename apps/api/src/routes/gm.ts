// Console du Game Master (RG-3) : cycle de vie (RG-4), paramètres (RG-14), préréglages (RG-14.5),
// balises (RG-6), zones et catalogue (préparation RG-4.1). Chaque action est journalisée avec son auteur (RG-3.1).
import {
  PARAM_KEYS,
  applyGmAction,
  initialStock,
  presetFromSettings,
  presetSettings,
  remainingMs,
  rollBeaconType,
  rotate,
  type ParamKey,
} from '@gq/engine';
import {
  BaliseCreation,
  BaliseEtatIntent,
  CarteModification,
  CatalogueComposition,
  CycleIntent,
  ParamIntent,
  PrereglageApplication,
  PrereglageCreation,
  ZoneCreation,
  carteDeBanque,
} from '@gq/shared';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { STAFF, requireRole } from '../auth/guard.js';
import { applyLifecycle } from '../core/cycle.js';
import { paramsOf, paramsView, settingsOf } from '../core/params.js';
import { lifecycleOf } from '../core/partie.js';
import type { ActionCtx } from '../core/runner.js';
import { loadBeacons, saveBeacons } from '../core/state.js';
import { tickPartie } from '../core/taches.js';
import { balises, cartes, checkpoints, exemplaires, joueurs, parties, prereglages, zones } from '../db/schema.js';
import { introuvable } from '../errors.js';
import { refus, send } from '../http.js';
import { newBeaconId, newId, newSecret } from '../ids.js';
import { parse } from '../validation.js';
import { visitesParZone, emitBeaconChanges } from './scan.js';

/** Texte d'ambiance de la banque quand le GM reprend une carte de l'anime telle quelle (même numéro, même nom). */
const texteDeBanque = (numero: number | undefined, nom: string): string | null => {
  const b = numero === undefined ? undefined : carteDeBanque(numero);
  return b && b.nom === nom ? b.texte : null;
};

type P = { Params: { partieId: string } };
type PI = { Params: { partieId: string; id: string } };

export async function gmRoutes(app: FastifyInstance) {
  const { runner } = app.gq;

  /** Action du GM : rôle vérifié, exécutée sous son nom. */
  function gm<T extends { ok: boolean }>(
    req: { params: { partieId: string } } & Parameters<typeof requireRole>[0],
    fn: (c: ActionCtx) => Promise<T>,
  ): Promise<T> {
    const s = requireRole(req, req.params.partieId, 'gm');
    return runner.run(req.params.partieId, { type: 'gm', id: s.sub }, fn);
  }

  // État de la partie, public (écran, app joueur, console) : jamais de position ni de stock.
  app.get<P>('/parties/:partieId', async (req) => {
    const [p] = await app.gq.db.select().from(parties).where(eq(parties.id, req.params.partieId));
    if (!p) throw introuvable('Partie');
    const zs = await app.gq.db.select({ id: zones.id, nom: zones.nom, type: zones.type }).from(zones).where(eq(zones.partieId, p.id));
    const params = await paramsOf(app.gq.db, p);
    const g = lifecycleOf(p);
    return {
      ok: true,
      partie: {
        id: p.id,
        nom: p.nom,
        etat: p.etat,
        inscriptionsOuvertes: p.inscriptionsOuvertes,
        restantMs: p.demarreeA === null ? params.dureePartieMin * 60_000 : remainingMs(g, app.gq.now(), params.dureePartieMin * 60_000),
        zones: zs,
      },
    };
  });

  // RG-4 : le GM fait avancer l'état de la partie.
  app.post<P>('/parties/:partieId/cycle', async (req, reply) => {
    const input = parse(CycleIntent, req.body);
    const r = await gm(req, async (c) => {
      if (input.action === 'demarrer') {
        // RG-8.1 : le catalogue doit compter exactement N cartes désignées.
        const n = (await paramsOf(c.tx, c.partie)).cartesDesignees;
        const designees = (await c.tx.select({ id: cartes.id }).from(cartes).where(and(eq(cartes.partieId, c.partie.id), eq(cartes.designee, true)))).length;
        if (designees !== n) {
          await c.log({ action: 'cycle_de_vie', resultat: 'refus', details: { action: input.action, designees, n } });
          return refus('catalogue_incomplet', `Le catalogue compte ${designees} cartes désignées, le paramètre N en attend ${n}`);
        }
      }
      const res = applyGmAction(lifecycleOf(c.partie), input.action, c.realNow);
      if (!res.ok) {
        await c.log({ action: 'cycle_de_vie', resultat: 'refus', details: { action: input.action, message: res.message } });
        return refus('transition_impossible', res.message);
      }
      await applyLifecycle(c, res.game, res.transition ? [res.transition] : [], input.motif);
      if (!res.transition) await c.log({ action: 'cycle_de_vie', resultat: input.action, motif: input.motif });
      // Démarrage : balises activées et J calculé tout de suite (sans attendre la tâche planifiée).
      if (input.action === 'demarrer') await tickPartie({ ...c, now: 0 });
      return { ok: true as const, etat: res.game.etat, inscriptionsOuvertes: res.game.inscriptionsOuvertes };
    });
    return send(reply, r);
  });

  // RG-14.6 : J, valeur auto, mode, valeur appliquée.
  app.get<P>('/parties/:partieId/parametres', async (req) => {
    const s = requireRole(req, req.params.partieId, ...STAFF);
    return runner.run(req.params.partieId, { type: s.role === 'gm' ? 'gm' : 'pnj', id: s.sub }, async (c) => ({
      ok: true as const,
      J: c.partie.j.value,
      parametres: await paramsView(c.tx, c.partie),
    }));
  });

  // RG-14.2 : Auto / Verrouillé / Multiplicateur. RG-14.3 : pas de rétroactivité (seules les prochaines activations changent).
  app.put<P>('/parties/:partieId/parametres', async (req, reply) => {
    const input = parse(ParamIntent, req.body);
    const r = await gm(req, async (c) => {
      if (!PARAM_KEYS.includes(input.cle as ParamKey)) return refus('parametre_inconnu', 'Paramètre inconnu');
      // RG-8.1 / RG-14.3 : N se fixe avant le démarrage (cartes imprimées, Livres construits dessus).
      if (input.cle === 'cartesDesignees' && c.partie.demarreeA !== null) return refus('parametre_fige', 'N se fixe avant le démarrage de la partie');
      const settings = { ...settingsOf(c.partie), [input.cle]: input.reglage };
      await c.tx.update(parties).set({ parametres: settings }).where(eq(parties.id, c.partie.id));
      c.partie.parametres = settings;
      await c.log({ action: 'reglage_parametre', resultat: 'ok', details: { cle: input.cle, reglage: input.reglage } });
      const vue = (await paramsView(c.tx, c.partie)).find((p) => p.key === input.cle);
      c.emit({ type: 'staff' }, 'parametre', vue);
      return { ok: true as const, parametre: vue };
    });
    return send(reply, r);
  });

  app.get<P>('/parties/:partieId/prereglages', async (req) => {
    requireRole(req, req.params.partieId, 'gm');
    return { ok: true, prereglages: await app.gq.db.select().from(prereglages) };
  });

  // RG-14.5 : enregistrer les réglages courants comme nouveau préréglage.
  app.post<P>('/parties/:partieId/prereglages', async (req) => {
    const input = parse(PrereglageCreation, req.body);
    return gm(req, async (c) => {
      const p = presetFromSettings(newId(), input.nom, input.description, settingsOf(c.partie));
      await c.tx.insert(prereglages).values({ id: p.id, nom: p.nom, description: p.description, systeme: false, reglages: p.reglages });
      await c.log({ action: 'prereglage_creation', resultat: 'ok', details: { id: p.id, nom: p.nom } });
      return { ok: true as const, id: p.id };
    });
  });

  app.post<P>('/parties/:partieId/prereglages/appliquer', async (req, reply) => {
    const { id } = parse(PrereglageApplication, req.body);
    const r = await gm(req, async (c) => {
      const [p] = await c.tx.select().from(prereglages).where(eq(prereglages.id, id));
      if (!p) return refus('prereglage_inconnu', 'Préréglage inconnu');
      const settings = presetSettings(p);
      await c.tx.update(parties).set({ parametres: settings }).where(eq(parties.id, c.partie.id));
      await c.log({ action: 'prereglage_application', resultat: 'ok', details: { id, nom: p.nom } });
      return { ok: true as const };
    });
    return send(reply, r);
  });

  // RG-10.12 : positions exactes, GM seulement (carte des positions) ; le temps réel envoie ensuite `position`.
  app.get<P>('/parties/:partieId/positions', async (req) => {
    requireRole(req, req.params.partieId, 'gm');
    const rows = await app.gq.db
      .select({ joueurId: joueurs.id, pseudo: joueurs.pseudo, statut: joueurs.statut, position: joueurs.position })
      .from(joueurs)
      .where(eq(joueurs.partieId, req.params.partieId));
    return { ok: true, positions: rows.flatMap((r) => (r.position ? [{ joueurId: r.joueurId, pseudo: r.pseudo, statut: r.statut, ...r.position }] : [])) };
  });

  // --- Balises (RG-6) : carte des balises pour l'équipe ; le GM active, coupe, force la rotation ---

  app.get<P>('/parties/:partieId/balises', async (req) => {
    requireRole(req, req.params.partieId, ...STAFF);
    const rows = await app.gq.db.select().from(balises).where(eq(balises.partieId, req.params.partieId)).orderBy(balises.libelle);
    return { ok: true, balises: rows };
  });

  app.post<P>('/parties/:partieId/balises', async (req, reply) => {
    const input = parse(BaliseCreation, req.body);
    const r = await gm(req, async (c) => {
      const [z] = await c.tx.select().from(zones).where(and(eq(zones.id, input.zoneId), eq(zones.partieId, c.partie.id)));
      if (!z) return refus('zone_inconnue', 'Zone inconnue');
      const id = newBeaconId(); // RG-6.1 : à imprimer dans le QR
      await c.tx.insert(balises).values({ id, partieId: c.partie.id, zoneId: z.id, libelle: input.libelle, position: input.position ?? null });
      await c.log({ action: 'balise_creation', resultat: 'ok', details: { id, libelle: input.libelle, zoneId: z.id } });
      return { ok: true as const, id };
    });
    return send(reply, r);
  });

  app.post<PI>('/parties/:partieId/balises/:id/etat', async (req, reply) => {
    const input = parse(BaliseEtatIntent, req.body);
    const r = await gm(req, async (c) => {
      const before = await loadBeacons(c.tx, c.partie.id);
      const b = before.find((x) => x.id === req.params.id);
      if (!b) return refus('balise_inconnue', 'Balise inconnue');
      const p = await paramsOf(c.tx, c.partie);
      let next = b;
      if (input.action === 'activer') {
        const type = rollBeaconType(p.partRaresPct, c.rng);
        next = { ...b, state: 'active', type, stock: initialStock(type, p.stockBalise, c.rng), epuiseeA: null };
      } else {
        next = { ...b, state: input.action === 'couper' ? 'coupee' : 'dormante', type: null, stock: 0, epuiseeA: null };
      }
      const after = before.map((x) => (x.id === b.id ? next : x));
      await saveBeacons(c.tx, before, after);
      await c.log({ action: 'balise_gm', resultat: input.action, motif: input.motif, details: { baliseId: b.id } });
      await emitBeaconChanges(c, [
        { beaconId: b.id, zoneId: b.zoneId, from: b.state, to: next.state, cause: 'cible', ...(next.type ? { type: next.type, stock: next.stock } : {}) },
      ]);
      return { ok: true as const, etat: next.state, type: next.type, stock: next.stock };
    });
    return send(reply, r);
  });

  // RG-6.4 : le GM peut forcer une rotation.
  app.post<P>('/parties/:partieId/balises/rotation', async (req) =>
    gm(req, async (c) => {
      const p = await paramsOf(c.tx, c.partie);
      const before = await loadBeacons(c.tx, c.partie.id);
      const up = rotate(before, p.balisesActives, { stockBalise: p.stockBalise, partRaresPct: p.partRaresPct, visitesParZone: await visitesParZone(c) }, c.rng);
      await saveBeacons(c.tx, before, up.beacons);
      await c.log({ action: 'rotation_forcee', resultat: 'ok', details: { changements: up.changes.length } });
      await emitBeaconChanges(c, up.changes);
      return { ok: true as const, changements: up.changes.length };
    }),
  );

  // --- Préparation (RG-4.1) : zones et catalogue ---

  app.post<P>('/parties/:partieId/zones', async (req) => {
    const input = parse(ZoneCreation, req.body);
    return gm(req, async (c) => {
      const id = newId();
      const qr = input.type === 'sauvage' ? null : newSecret(12);
      await c.tx.insert(zones).values({ id, partieId: c.partie.id, nom: input.nom, type: input.type, polygone: input.polygone, qr });
      await c.log({ action: 'zone_creation', resultat: 'ok', details: { id, nom: input.nom, type: input.type } });
      return { ok: true as const, id, qr };
    });
  });

  app.get<P>('/parties/:partieId/zones', async (req) => {
    requireRole(req, req.params.partieId, ...STAFF);
    return { ok: true, zones: await app.gq.db.select().from(zones).where(eq(zones.partieId, req.params.partieId)) };
  });

  // Catalogue : public (noms, rangs) ; le lot réel n'est visible que de l'équipe.
  app.get<P>('/parties/:partieId/cartes', async (req) => {
    const staff = req.session?.partieId === req.params.partieId && req.session.role !== 'joueur';
    const rows = await app.gq.db.select().from(cartes).where(eq(cartes.partieId, req.params.partieId)).orderBy(cartes.numero);
    return { ok: true, cartes: rows.map((x) => ({ id: x.id, numero: x.numero, nom: x.nom, rang: x.rang, texte: x.texte, designee: x.designee, ...(staff ? { lotReel: x.lotReel } : {}) })) };
  });

  // RG-8.1 (N réglable) : le GM compose le catalogue avant le démarrage ; N = nombre de cartes (paramètre verrouillé).
  // Conseil de taille et de répartition : moteur conseils.ts (conseilCartesDesignees, repartitionCatalogue).
  app.put<P>('/parties/:partieId/catalogue', async (req, reply) => {
    const input = parse(CatalogueComposition, req.body);
    const r = await gm(req, async (c) => {
      if (c.partie.demarreeA !== null) return refus('partie_demarree', 'Le catalogue se compose avant le démarrage de la partie');
      if ((await c.tx.select({ id: exemplaires.id }).from(exemplaires).where(eq(exemplaires.partieId, c.partie.id)).limit(1)).length > 0) {
        return refus('cartes_en_jeu', 'Des cartes sont déjà dans des Books : le catalogue ne peut plus changer');
      }
      // Les stocks des checkpoints désignaient les anciennes cartes : ils sont vidés.
      const cps = await c.tx.select().from(checkpoints).where(eq(checkpoints.partieId, c.partie.id));
      const vides = cps.filter((x) => x.cartes.length > 0);
      for (const x of vides) await c.tx.update(checkpoints).set({ cartes: [] }).where(eq(checkpoints.id, x.id));
      await c.tx.delete(cartes).where(eq(cartes.partieId, c.partie.id));
      await c.tx.insert(cartes).values(
        // RG-8.1 amendé : numéro de l'anime s'il est donné, sinon 001..N dans l'ordre.
        input.cartes.map((x, i) => ({
          id: newId(),
          partieId: c.partie.id,
          numero: x.numero ?? i + 1,
          nom: x.nom,
          rang: x.rang,
          lotReel: x.lotReel ?? null,
          texte: x.texte ?? texteDeBanque(x.numero, x.nom),
        })),
      );
      const n = input.cartes.length;
      const settings = { ...settingsOf(c.partie), cartesDesignees: { mode: 'verrouille' as const, value: n } };
      await c.tx.update(parties).set({ parametres: settings }).where(eq(parties.id, c.partie.id));
      c.partie.parametres = settings;
      const parRang: Record<string, number> = {};
      for (const x of input.cartes) parRang[x.rang] = (parRang[x.rang] ?? 0) + 1;
      await c.log({ action: 'catalogue', resultat: 'ok', details: { n, parRang, checkpointsVides: vides.length } });
      return { ok: true as const, n, parRang, checkpointsVides: vides.length };
    });
    return send(reply, r);
  });

  app.patch<PI>('/parties/:partieId/cartes/:id', async (req, reply) => {
    const input = parse(CarteModification, req.body);
    const r = await gm(req, async (c) => {
      const [x] = await c.tx.select().from(cartes).where(and(eq(cartes.id, req.params.id), eq(cartes.partieId, c.partie.id)));
      if (!x) return refus('carte_inconnue', 'Carte inconnue');
      const patch = { ...(input.nom !== undefined ? { nom: input.nom } : {}), ...(input.lotReel !== undefined ? { lotReel: input.lotReel } : {}) };
      await c.tx.update(cartes).set(patch).where(eq(cartes.id, x.id));
      await c.log({ action: 'carte_modification', resultat: 'ok', details: { id: x.id, ...patch } });
      return { ok: true as const };
    });
    return send(reply, r);
  });
}
