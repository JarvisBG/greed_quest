// Équipe (RG-3) : connexion PNJ / GM, ajout de membres par un GM, lecture du journal.
import { StaffCreate, StaffLogin } from '@gq/shared';
import { and, desc, eq, gt } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { STAFF, requireRole } from '../auth/guard.js';
import { checkCode, hashCode } from '../auth/tokens.js';
import { joueurs, journal, livres, staff } from '../db/schema.js';
import { Refus } from '../errors.js';
import { newId } from '../ids.js';
import { parse } from '../validation.js';

type P = { Params: { partieId: string } };

export async function staffRoutes(app: FastifyInstance) {
  app.post<P>('/parties/:partieId/staff/connexion', async (req) => {
    const { code } = parse(StaffLogin, req.body);
    const membres = await app.gq.db.select().from(staff).where(eq(staff.partieId, req.params.partieId));
    const m = membres.find((s) => checkCode(code, s.codeHash));
    if (!m) throw new Refus('code_invalide', 'Code invalide', 401);
    return { ok: true, id: m.id, role: m.role, nom: m.nom, token: app.gq.tokens.issue({ role: m.role, sub: m.id, partieId: m.partieId }) };
  });

  // RG-3.2 : plusieurs GM possibles, même poids ; chaque membre est distingué au journal.
  app.post<P>('/parties/:partieId/staff', async (req) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'gm');
    const body = parse(StaffCreate, req.body);
    return app.gq.runner.run(partieId, { type: 'gm', id: s.sub }, async (c) => {
      const id = newId();
      await c.tx.insert(staff).values({ id, partieId, nom: body.nom, role: body.role, codeHash: hashCode(body.code) });
      await c.log({ action: 'ajout_staff', resultat: 'ok', details: { id, nom: body.nom, role: body.role } });
      return { ok: true, id };
    });
  });

  // RG-3.2 : l'équipe de la partie, pour le GM (jamais les codes).
  app.get<P>('/parties/:partieId/staff', async (req) => {
    const { partieId } = req.params;
    requireRole(req, partieId, 'gm');
    const rows = await app.gq.db.select({ id: staff.id, nom: staff.nom, role: staff.role }).from(staff).where(eq(staff.partieId, partieId)).orderBy(staff.nom);
    return { ok: true, equipe: rows };
  });

  // Joueurs de la partie pour la console (sanction après une alerte, mission) : jamais de position (RG-10.12).
  // `livreGele` (RG-13.1) : Clear déclaré, en attente du GM ; retrouvé ainsi par une console rechargée.
  app.get<P>('/parties/:partieId/joueurs', async (req) => {
    const { partieId } = req.params;
    requireRole(req, partieId, ...STAFF);
    const rows = await app.gq.db
      .select({
        id: joueurs.id,
        pseudo: joueurs.pseudo,
        statut: joueurs.statut,
        nen: joueurs.nen,
        pouvoirSpe: joueurs.pouvoirSpe,
        jenny: joueurs.jenny,
        geleJusqua: joueurs.geleJusqua,
        livreGele: livres.gele,
      })
      .from(joueurs)
      .leftJoin(livres, eq(livres.joueurId, joueurs.id))
      .where(eq(joueurs.partieId, partieId))
      .orderBy(joueurs.pseudo);
    return { ok: true, joueurs: rows.map((r) => ({ ...r, livreGele: r.livreGele ?? false })) };
  });

  // RG-15 : alertes anti-triche pour la console (le moteur alerte, l'équipe décide).
  app.get<P>('/parties/:partieId/alertes', async (req) => {
    const { partieId } = req.params;
    requireRole(req, partieId, ...STAFF);
    const rows = await app.gq.db
      .select()
      .from(journal)
      .where(and(eq(journal.partieId, partieId), eq(journal.action, 'alerte')))
      .orderBy(desc(journal.id))
      .limit(200);
    return { ok: true, alertes: rows.map((r) => ({ id: r.id, type: r.resultat, heureJeu: r.heureJeu, creeLe: r.creeLe, ...r.details })) };
  });

  // Journal pour la console PNJ / GM (diffusion « PNJ/GM : journal »).
  app.get<P & { Querystring: { apres?: string; limite?: string } }>('/parties/:partieId/journal', async (req) => {
    const { partieId } = req.params;
    requireRole(req, partieId, ...STAFF);
    const apres = Number(req.query.apres ?? 0);
    const limite = Math.min(500, Number(req.query.limite ?? 100));
    const rows = await app.gq.db
      .select()
      .from(journal)
      .where(and(eq(journal.partieId, partieId), gt(journal.id, apres)))
      .orderBy(desc(journal.id))
      .limit(limite);
    return { ok: true, lignes: rows };
  });
}
