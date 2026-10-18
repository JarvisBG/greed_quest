// Organisateur (code admin) : création d'une partie avec son premier GM, liste de toutes les parties (depuis n'importe
// quel appareil), statistiques et export du Journal pour les rapports (une partie : son GM ou l'organisateur).
import { conseilCartesDesignees, tirerCatalogue } from '@gq/engine';
import { BANQUE_CARTES, PartieCreate } from '@gq/shared';
import { count, desc, eq } from 'drizzle-orm';
import { paramsOf, settingsOf } from '../core/params.js';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requireRole } from '../auth/guard.js';
import { contacts, journalExport, statistiquesDe } from '../core/statistiques.js';
import { hashCode } from '../auth/tokens.js';
import { writeLog } from '../core/journal.js';
import { createPartie, seedDemoContent } from '../db/seed.js';
import { cartes, joueurs, parties, staff } from '../db/schema.js';
import { Refus } from '../errors.js';
import { newId } from '../ids.js';
import { parse } from '../validation.js';

type P = { Params: { partieId: string } };

export async function adminRoutes(app: FastifyInstance) {
  const orga = (req: FastifyRequest) => req.headers['x-code-admin'] === app.gq.adminCode;
  const exigerOrga = (req: FastifyRequest) => {
    if (!orga(req)) throw new Refus('interdit', 'Code organisateur invalide', 403);
  };
  /** Une partie : son GM, ou l'organisateur. */
  const gmOuOrga = (req: FastifyRequest, partieId: string) => {
    if (!orga(req)) requireRole(req, partieId, 'gm');
  };

  // Toutes les parties, les plus récentes d'abord (page « Mes parties » sur un nouvel appareil).
  app.get('/admin/parties', async (req) => {
    exigerOrga(req);
    const rows = await app.gq.db
      .select({ id: parties.id, nom: parties.nom, etat: parties.etat, creeLe: parties.creeLe, joueurs: count(joueurs.id) })
      .from(parties)
      .leftJoin(joueurs, eq(joueurs.partieId, parties.id))
      .groupBy(parties.id)
      .orderBy(desc(parties.creeLe));
    return { ok: true, parties: rows.map((r) => ({ ...r, creeLe: r.creeLe.toISOString() })) };
  });

  // Statistiques de toutes les parties (rapport « tous les festivals »).
  app.get('/admin/statistiques', async (req) => {
    exigerOrga(req);
    const ids = await app.gq.db.select({ id: parties.id }).from(parties).orderBy(desc(parties.creeLe));
    const stats = [];
    for (const { id } of ids) stats.push(await statistiquesDe(app.gq.db, id));
    return { ok: true, parties: stats.filter((s) => s !== null) };
  });

  app.get<P>('/parties/:partieId/statistiques', async (req) => {
    gmOuOrga(req, req.params.partieId);
    const stats = await statistiquesDe(app.gq.db, req.params.partieId);
    if (!stats) throw new Refus('introuvable', 'Partie introuvable', 404);
    return { ok: true, statistiques: stats };
  });

  // RG-5.3 : contacts qui acceptent d'être recontactés (organisateur et GM de la partie, décision 2026-10-18).
  app.get<P>('/parties/:partieId/contacts', async (req) => {
    gmOuOrga(req, req.params.partieId);
    return { ok: true, contacts: await contacts(app.gq.db, req.params.partieId) };
  });
  app.get('/admin/contacts', async (req) => {
    exigerOrga(req);
    return { ok: true, contacts: await contacts(app.gq.db) };
  });

  // Journal complet (export CSV des données brutes), sans positions.
  app.get<P>('/parties/:partieId/journal/export', async (req) => {
    gmOuOrga(req, req.params.partieId);
    return { ok: true, lignes: await journalExport(app.gq.db, req.params.partieId) };
  });

  app.post('/admin/parties', async (req) => {
    if (req.headers['x-code-admin'] !== app.gq.adminCode) throw new Refus('interdit', 'Code organisateur invalide', 403);
    const body = parse(PartieCreate, req.body);
    return app.gq.db.transaction(async (tx) => {
      const partieId = await createPartie(tx, { nom: body.nom, prereglage: body.prereglage });
      // Démo créée depuis la console : posée à Douala (Akwa), le jeu se joue au Cameroun (les tests gardent leur centre).
      if (body.demo) await seedDemoContent(tx, partieId, { centre: { lat: 4.0511, lng: 9.7679 } });
      else {
        // RG-8.1 (amendement 2026-10-17) : la plateforme propose tout de suite un catalogue tiré au hasard, avec le
        // nombre de cartes conseillé (durée du préréglage, joueurs attendus) ; le GM peut retirer ou retoucher.
        const [p] = await tx.select().from(parties).where(eq(parties.id, partieId));
        const n = conseilCartesDesignees(body.joueursAttendus, (await paramsOf(tx, p!)).dureePartieMin);
        const tirage = tirerCatalogue(BANQUE_CARTES, n, app.gq.rng);
        await tx.insert(cartes).values(tirage.map((c) => ({ id: newId(), partieId, numero: c.numero, nom: c.nom, rang: c.rang, texte: c.texte })));
        const settings = { ...settingsOf(p!), cartesDesignees: { mode: 'verrouille' as const, value: tirage.length } };
        await tx.update(parties).set({ parametres: settings }).where(eq(parties.id, partieId));
      }
      const gmId = newId();
      await tx.insert(staff).values({ id: gmId, partieId, nom: body.gm.nom, role: 'gm', codeHash: hashCode(body.gm.code) });
      await writeLog(tx, partieId, 0, { type: 'systeme', id: null }, {
        action: 'creation_partie',
        resultat: 'ok',
        details: { nom: body.nom, prereglage: body.prereglage, gm: body.gm.nom, joueursAttendus: body.joueursAttendus },
      });
      return { ok: true, partieId, token: app.gq.tokens.issue({ role: 'gm', sub: gmId, partieId }) };
    });
  });
}
