// Inscription et profil du joueur (RG-5).
import {
  EXAMEN,
  NEN_TEST,
  canRegister,
  catchUpBonus,
  kitSpell,
  nenFromAnswers,
  scoreExamen,
  validQuizAnswers,
} from '@gq/engine';
import { Inscription, Reconnexion, ReponsesQuiz } from '@gq/shared';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { requireRole } from '../auth/guard.js';
import { paramsOf } from '../core/params.js';
import { lifecycleOf } from '../core/partie.js';
import { joueurs, livres, sorts } from '../db/schema.js';
import { introuvable } from '../errors.js';
import { refus, send } from '../http.js';
import { newId, newSecret } from '../ids.js';
import { parse } from '../validation.js';

type P = { Params: { partieId: string } };

const sansReponse = <T extends { bonne?: number }>(q: T) => {
  const { bonne: _b, ...reste } = q;
  return reste;
};

export async function joueursRoutes(app: FastifyInstance) {
  const { runner, tokens } = app.gq;

  app.post<P>('/parties/:partieId/inscription', async (req, reply) => {
    const { partieId } = req.params;
    const body = parse(Inscription, req.body);
    const r = await runner.run(partieId, { type: 'systeme', id: null }, async (c) => {
      const deny = async (code: string, message: string) => {
        await c.log({ action: 'inscription', resultat: 'refus', details: { pseudo: body.pseudo, code } });
        return refus(code, message);
      };
      // RG-4.2 / 4.3 / 4.5
      if (!canRegister(lifecycleOf(c.partie))) return deny('inscriptions_fermees', 'Les inscriptions sont fermées');

      // RG-5.1 + RG-15 : 2e inscription d'un appareil bloquée, avec alerte à l'équipe.
      const [memeAppareil] = await c.tx
        .select({ id: joueurs.id, pseudo: joueurs.pseudo })
        .from(joueurs)
        .where(and(eq(joueurs.partieId, partieId), eq(joueurs.appareilId, body.appareilId)));
      if (memeAppareil) {
        const alerte = { type: 'double_inscription', joueurId: memeAppareil.id, pseudo: memeAppareil.pseudo, pseudoTente: body.pseudo };
        await c.log({ action: 'alerte', resultat: 'double_inscription', details: alerte });
        c.emit({ type: 'staff' }, 'alerte', alerte);
        return deny('appareil_deja_inscrit', 'Ce téléphone est déjà inscrit : reconnecte-toi');
      }
      const [memePseudo] = await c.tx
        .select({ id: joueurs.id })
        .from(joueurs)
        .where(and(eq(joueurs.partieId, partieId), eq(joueurs.pseudo, body.pseudo)));
      if (memePseudo) return deny('pseudo_pris', 'Ce pseudo est déjà pris');

      // RG-5.5 kit ; RG-5.6 rattrapage si la partie a commencé.
      const p = await paramsOf(c.tx, c.partie);
      const enRetard = c.partie.etat !== 'inscriptions';
      const rattrapage = enRetard ? catchUpBonus(c.now, p.rattrapageJParMin) : 0;
      const id = newId();
      await c.tx.insert(joueurs).values({
        id,
        partieId,
        pseudo: body.pseudo,
        appareilId: body.appareilId,
        licenceSecret: newSecret(),
        jenny: p.kitJenny + rattrapage,
        position: { ...body.position, a: c.now },
        derniereActionA: c.now,
        inscritA: c.now,
      });
      await c.tx.insert(livres).values({ joueurId: id });
      const sort = kitSpell(c.rng);
      await c.tx.insert(sorts).values({ id: newId(), partieId, joueurId: id, type: sort, obtenuA: c.now });
      await c.log({
        action: 'inscription',
        resultat: 'ok',
        details: { joueurId: id, pseudo: body.pseudo, kitJenny: p.kitJenny, rattrapage, sort },
      });
      c.emit({ type: 'staff' }, 'joueur_inscrit', { joueurId: id, pseudo: body.pseudo });
      return {
        ok: true as const,
        joueurId: id,
        token: tokens.issue({ role: 'joueur', sub: id, partieId }),
        kit: { jenny: p.kitJenny, rattrapage, sort },
      };
    });
    return send(reply, r);
  });

  // RG-5.1 : l'appareil inscrit retrouve son joueur (app réinstallée, jeton perdu).
  app.post<P>('/parties/:partieId/reconnexion', async (req, reply) => {
    const { appareilId } = parse(Reconnexion, req.body);
    const [j] = await app.gq.db
      .select({ id: joueurs.id })
      .from(joueurs)
      .where(and(eq(joueurs.partieId, req.params.partieId), eq(joueurs.appareilId, appareilId)));
    if (!j) return send(reply, refus('inconnu', 'Aucun joueur inscrit avec ce téléphone'));
    return { ok: true, joueurId: j.id, token: tokens.issue({ role: 'joueur', sub: j.id, partieId: req.params.partieId }) };
  });

  // RG-5.3 / RG-5.4 : questionnaires (sans les bonnes réponses).
  app.get<P>('/parties/:partieId/questionnaires', async () => ({
    ok: true,
    examen: EXAMEN.map(sansReponse),
    nen: NEN_TEST,
  }));

  app.post<P>('/parties/:partieId/examen', async (req, reply) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    const { reponses } = parse(ReponsesQuiz, req.body);
    const r = await runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
      const [j] = await c.tx.select().from(joueurs).where(eq(joueurs.id, s.sub));
      if (!j) throw introuvable('Joueur');
      if (j.examenScore !== null) return refus('deja_fait', 'Tu as déjà passé l’Examen');
      if (!validQuizAnswers(EXAMEN, reponses)) return refus('reponses_invalides', 'Réponds aux 3 questions');
      const bonnes = scoreExamen(reponses);
      const bonus = bonnes * (await paramsOf(c.tx, c.partie)).bonusExamenJ; // RG-5.3
      await c.tx.update(joueurs).set({ examenScore: bonnes, jenny: j.jenny + bonus }).where(eq(joueurs.id, j.id));
      await c.log({ action: 'examen', resultat: 'ok', details: { bonnes, bonus } });
      return { ok: true as const, bonnes, bonus, corrige: EXAMEN.map((q) => q.bonne) };
    });
    return send(reply, r);
  });

  app.post<P>('/parties/:partieId/nen', async (req, reply) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    const { reponses } = parse(ReponsesQuiz, req.body);
    const r = await runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
      const [j] = await c.tx.select().from(joueurs).where(eq(joueurs.id, s.sub));
      if (!j) throw introuvable('Joueur');
      if (j.nen !== null) return refus('deja_fait', 'Ton type de Nen est déjà connu');
      if (!validQuizAnswers(NEN_TEST, reponses)) return refus('reponses_invalides', 'Réponds aux 5 questions');
      const nen = nenFromAnswers(reponses, (await paramsOf(c.tx, c.partie)).specialisationPct, c.rng); // RG-5.4
      await c.tx.update(joueurs).set({ nen }).where(eq(joueurs.id, j.id));
      await c.log({ action: 'test_nen', resultat: 'ok', details: { nen } });
      return { ok: true as const, nen };
    });
    return send(reply, r);
  });

  app.get<P>('/parties/:partieId/moi', async (req) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    const [j] = await app.gq.db.select().from(joueurs).where(eq(joueurs.id, s.sub));
    if (!j) throw introuvable('Joueur');
    return {
      ok: true,
      joueur: { id: j.id, pseudo: j.pseudo, jenny: j.jenny, nen: j.nen, statut: j.statut, examenFait: j.examenScore !== null },
    };
  });
}
