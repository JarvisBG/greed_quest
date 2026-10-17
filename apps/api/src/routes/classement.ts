// Page ⑱ : le classement final lu par le joueur (RG-4.6, RG-13.5 à 13.7). Figé à la fin de la partie ; chacun voit
// la place, le pseudo, les cartes désignées et les points de tous, mais seulement ses propres jenny et heure.
import { layoutBook } from '@gq/engine';
import type { FastifyInstance } from 'fastify';
import { requireRole, STAFF } from '../auth/guard.js';
import { eq } from 'drizzle-orm';
import { loadBook, loadCatalogue, loadJoueurs } from '../core/state.js';
import { cartes } from '../db/schema.js';
import { refus, send } from '../http.js';

type P = { Params: { partieId: string } };

export async function classementRoutes(app: FastifyInstance) {
  const { runner } = app.gq;

  app.get<P>('/parties/:partieId/classement', async (req, reply) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    const r = await runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
      const p = c.partie;
      if (p.etat !== 'terminee' || !p.classementFinal) return refus('pas_terminee', 'Le classement final arrive à la fin de la partie');
      const joueurs = await loadJoueurs(c.tx, partieId);
      const statut = new Map(joueurs.map((j) => [j.id, j.statut]));
      const cat = await loadCatalogue(c.tx, partieId);
      const lignes = p.classementFinal.map((l) => ({
        place: l.place,
        pseudo: l.pseudo,
        cartes: l.cartes,
        points: l.points,
        abandon: statut.get(l.playerId) === 'abandon',
        moi: l.playerId === s.sub,
      }));
      const mien = p.classementFinal.find((l) => l.playerId === s.sub);
      // RG-13.7 : les contrefaçons posées sur un emplacement désigné ne comptent pas au final ; on dit combien.
      const contrefacons = mien
        ? layoutBook(await loadBook(c.tx, s.sub), cat.designees).designes.filter((d) => d.slot.etat === 'plein' && d.slot.item.kind === 'carte' && d.slot.item.faux)
            .length
        : 0;
      return {
        ok: true as const,
        partieNom: p.nom,
        designees: cat.designees.length,
        termineeA: p.termineeA,
        gagnant: p.gagnantId ? (joueurs.find((j) => j.id === p.gagnantId)?.pseudo ?? null) : null,
        lignes,
        moi: mien
          ? { place: mien.place, cartes: mien.cartes, points: mien.points, jenny: mien.jenny, derniereCarteA: mien.derniereCarteA, contrefacons, abandon: statut.get(s.sub) === 'abandon' }
          : null,
      };
    });
    return send(reply, r);
  });

  // RG-13.5 / 13.6 : classement final complet pour l'équipe (console rechargée), avec le gagnant du Clear et les lots
  // réels de ses 3 récompenses (RG-13.3) à remettre.
  app.get<P>('/parties/:partieId/classement-final', async (req, reply) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, ...STAFF);
    const r = await runner.run(partieId, { type: s.role === 'gm' ? 'gm' : 'pnj', id: s.sub }, async (c) => {
      const p = c.partie;
      if (p.etat !== 'terminee' || !p.classementFinal) return refus('pas_terminee', 'Le classement final arrive à la fin de la partie');
      const joueurs = await loadJoueurs(c.tx, partieId);
      const rows = p.recompenses ? await c.tx.select().from(cartes).where(eq(cartes.partieId, partieId)) : [];
      const lots = (p.recompenses ?? []).map((id) => {
        const x = rows.find((r) => r.id === id);
        return { carte: x?.nom ?? '?', lotReel: x?.lotReel ?? null };
      });
      return {
        ok: true as const,
        gagnant: p.gagnantId ? (joueurs.find((j) => j.id === p.gagnantId)?.pseudo ?? null) : null,
        lots,
        lignes: p.classementFinal.map((l) => ({ place: l.place, pseudo: l.pseudo, cartes: l.cartes, points: l.points, jenny: l.jenny })),
      };
    });
    return send(reply, r);
  });
}
