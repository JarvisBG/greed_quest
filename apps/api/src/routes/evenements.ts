// Événements du Game Master (RG-12) : lancement, annulation (RG-12.2), raid, mission secrète.
import {
  RAID_QUESTIONS,
  addItem,
  announce,
  answerRaid,
  cancelEvent,
  isActive,
  startApparition,
  startCurse,
  startMission,
  startRaid,
  startSimpleEvent,
  validateMission,
  type GameEvent,
  type StartResult,
} from '@gq/engine';
import { EvenementIntent, RaidReponse } from '@gq/shared';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { STAFF, requireRole } from '../auth/guard.js';
import { finishEvent, zoneNames } from '../core/evenements.js';
import { paramsOf } from '../core/params.js';
import type { ActionCtx } from '../core/runner.js';
import {
  actionPatch,
  eventOf,
  isLivreGele,
  loadActiveEvents,
  loadBeacons,
  loadBook,
  loadCatalogue,
  loadJoueur,
  loadJoueurs,
  saveBeacons,
  saveBooks,
  saveEvent,
  updateJoueur,
} from '../core/state.js';
import { evenements } from '../db/schema.js';
import { introuvable } from '../errors.js';
import { refus, send } from '../http.js';
import { newId } from '../ids.js';
import { parse } from '../validation.js';
import { emitBeaconChanges } from './scan.js';

type P = { Params: { partieId: string } };
type PI = { Params: { partieId: string; id: string } };

/** Vue publique d'un événement (bannière, compte à rebours ; PV du raid). Une mission secrète n'est jamais publique. */
export async function publicEvent(c: ActionCtx, e: GameEvent) {
  const a = announce(e, await zoneNames(c));
  return {
    id: e.id,
    type: e.data.type,
    zoneId: e.zoneId,
    texte: a?.texte ?? null,
    fin: e.fin,
    ...(e.data.type === 'raid' ? { pv: e.data.pv, pvMax: e.data.pvMax } : {}),
  };
}

async function loadEvent(c: ActionCtx, id: string): Promise<GameEvent | null> {
  const [row] = await c.tx.select().from(evenements).where(and(eq(evenements.id, id), eq(evenements.partieId, c.partie.id)));
  return row ? eventOf(row) : null;
}

export async function evenementsRoutes(app: FastifyInstance) {
  const { runner } = app.gq;

  app.post<P>('/parties/:partieId/evenements', async (req, reply) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'gm');
    const input = parse(EvenementIntent, req.body);
    const r = await runner.run(partieId, { type: 'gm', id: s.sub }, async (c) => {
      const events = await loadActiveEvents(c.tx, partieId);
      const base = {
        id: newId(),
        now: c.now,
        gameState: c.partie.etat,
        events,
        ...(input.dureeMin ? { dureeMs: input.dureeMin * 60_000 } : {}),
      };
      const zoneId = input.zoneId ?? null;
      let res: StartResult;
      let porteur: string | null = null;
      switch (input.type) {
        case 'apparition': {
          if (!zoneId) return refus('zone_requise', 'Choisis une zone');
          const before = await loadBeacons(c.tx, partieId);
          res = startApparition(base, zoneId, before, c.rng);
          if (res.ok && res.beacons) {
            await saveBeacons(c.tx, before, res.beacons.beacons);
            await emitBeaconChanges(c, res.beacons.changes);
          }
          break;
        }
        case 'double_gain':
        case 'zone_maudite':
        case 'krach':
          res = startSimpleEvent(base, input.type, zoneId);
          break;
        case 'raid':
          res = startRaid(base, (await paramsOf(c.tx, c.partie)).pvBoss);
          break;
        case 'carte_maudite': {
          const joueurs = await loadJoueurs(c.tx, partieId);
          const etats = await Promise.all(joueurs.map(async (j) => ({ id: j.id, status: j.statut, livreGele: await isLivreGele(c.tx, j.id) })));
          const cat = await loadCatalogue(c.tx, partieId);
          const cr = startCurse({ ...base, newId }, etats, cat.designees, c.rng);
          if (cr.ok) {
            const book = await loadBook(c.tx, cr.porteur);
            await saveBooks(c.tx, partieId, c.now, [{ joueurId: cr.porteur, before: book, after: addItem(book, cr.carte) }]);
            porteur = cr.porteur;
          }
          res = cr;
          break;
        }
        case 'mission_secrete': {
          if (!input.joueurId || !input.objectif) return refus('mission_incomplete', 'Choisis un joueur et un objectif');
          const j = await loadJoueur(c.tx, input.joueurId);
          if (!j || j.partieId !== partieId) return refus('joueur_inconnu', 'Joueur inconnu');
          res = startMission(base, j.id, input.objectif, input.recompenseJenny ?? 0);
          break;
        }
      }
      if (!res.ok) {
        await c.log({ action: 'evenement', resultat: 'refus', details: { type: input.type, message: res.message } });
        return refus('evenement_impossible', res.message);
      }
      const e = res.event;
      await saveEvent(c.tx, partieId, e, s.sub);
      await c.log({ action: 'evenement', resultat: 'lance', details: { evenementId: e.id, type: e.data.type, zoneId: e.zoneId, fin: e.fin, porteur } });
      // Annonces du tableau RG-12 (écran, push), console toujours.
      const vue = await publicEvent(c, e);
      const a = announce(e, await zoneNames(c));
      if (a?.ecran) c.emit({ type: 'tracker' }, 'evenement', vue);
      if (a?.push) c.emit({ type: 'joueurs' }, 'evenement', vue);
      c.emit({ type: 'staff' }, 'evenement', { ...vue, data: e.data });
      if (e.data.type === 'mission_secrete') {
        c.emit({ type: 'joueur', id: e.data.joueurId }, 'mission', { id: e.id, objectif: e.data.objectif, recompenseJenny: e.data.recompenseJenny, fin: e.fin });
      }
      if (porteur) c.emit({ type: 'joueur', id: porteur }, 'carte_maudite', { fin: e.fin });
      return { ok: true as const, evenement: { ...vue, data: e.data } };
    });
    return send(reply, r);
  });

  // RG-12.2 : le GM annule ; les gains déjà obtenus restent.
  app.post<PI>('/parties/:partieId/evenements/:id/annuler', async (req, reply) => {
    const { partieId, id } = req.params;
    const s = requireRole(req, partieId, 'gm');
    const r = await runner.run(partieId, { type: 'gm', id: s.sub }, async (c) => {
      const e = await loadEvent(c, id);
      if (!e) throw introuvable('Événement');
      if (e.etat !== 'actif') return refus('evenement_termine', 'Cet événement est déjà terminé');
      await finishEvent(c, cancelEvent(e, c.now), true);
      return { ok: true as const };
    });
    return send(reply, r);
  });

  // Mission secrète validée par un PNJ (ou le GM) : récompense en jenny.
  app.post<PI>('/parties/:partieId/evenements/:id/valider', async (req, reply) => {
    const { partieId, id } = req.params;
    const s = requireRole(req, partieId, ...STAFF);
    const r = await runner.run(partieId, { type: s.role === 'gm' ? 'gm' : 'pnj', id: s.sub }, async (c) => {
      const e = await loadEvent(c, id);
      if (!e) throw introuvable('Événement');
      const v = validateMission(e, c.now);
      if (!v.ok) return refus('mission_invalide', v.message);
      const j = await loadJoueur(c.tx, v.joueurId);
      if (j) await updateJoueur(c.tx, j.id, { jenny: j.jenny + v.jenny });
      await finishEvent(c, v.event, false);
      c.emit({ type: 'joueur', id: v.joueurId }, 'mission_reussie', { jenny: v.jenny });
      return { ok: true as const, jenny: v.jenny };
    });
    return send(reply, r);
  });

  // Événements publics en cours (bannières) ; l'équipe voit aussi le détail.
  app.get<P>('/parties/:partieId/evenements', async (req) => {
    const { partieId } = req.params;
    const s = req.session?.partieId === partieId ? req.session : null;
    return runner.run(partieId, { type: 'systeme', id: null }, async (c) => {
      const actifs = (await loadActiveEvents(c.tx, partieId)).filter((e) => isActive(e, c.now));
      const staff = s?.role === 'gm' || s?.role === 'pnj';
      const vues = [];
      for (const e of actifs) {
        if (e.data.type === 'mission_secrete' && !staff && e.data.joueurId !== s?.sub) continue;
        vues.push({ ...(await publicEvent(c, e)), ...(staff ? { data: e.data } : {}) });
      }
      return { ok: true as const, evenements: vues };
    });
  });

  // Raid : questions (sans réponses) et réponses des joueurs.
  app.get<P>('/parties/:partieId/raid', async (req) => {
    requireRole(req, req.params.partieId, 'joueur');
    return { ok: true, questions: RAID_QUESTIONS.map(({ bonne: _b, ...q }) => q) };
  });

  app.post<P>('/parties/:partieId/raid/reponse', async (req, reply) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    const input = parse(RaidReponse, req.body);
    const r = await runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
      const raid = (await loadActiveEvents(c.tx, partieId)).find((e) => e.data.type === 'raid' && isActive(e, c.now));
      if (!raid) return refus('pas_de_raid', 'Aucun raid en cours');
      const q = RAID_QUESTIONS.find((x) => x.id === input.questionId);
      if (!q) return refus('question_inconnue', 'Question inconnue');
      const j = await loadJoueur(c.tx, s.sub);
      if (!j) throw introuvable('Joueur');
      if (j.statut === 'disqualifie' || j.statut === 'abandon') return refus('joueur_bloque', 'Tu ne participes plus');
      const correcte = q.bonne === input.choix;
      const next = answerRaid(raid, j.id, q.id, correcte, c.now);
      if (next === raid) return refus('deja_repondu', 'Tu as déjà répondu à cette question');
      await updateJoueur(c.tx, j.id, actionPatch(j, c.now));
      await c.log({ action: 'raid_reponse', resultat: correcte ? 'bonne' : 'fausse', details: { evenementId: raid.id, questionId: q.id } });
      if (next.data.type === 'raid') {
        const barre = { id: next.id, pv: next.data.pv, pvMax: next.data.pvMax };
        c.emit({ type: 'tracker' }, 'raid', barre); // barre de vie
        c.emit({ type: 'staff' }, 'raid', barre);
      }
      if (next.etat === 'termine') await finishEvent(c, next, false);
      else await saveEvent(c.tx, partieId, next);
      return { ok: true as const, correcte, pv: next.data.type === 'raid' ? next.data.pv : 0, vaincu: next.etat === 'termine' };
    });
    return send(reply, r);
  });
}
