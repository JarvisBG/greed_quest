import { EXAMEN } from '@gq/engine';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { joueurs, journal, sorts } from '../db/schema.js';
import { testApp } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
beforeAll(async () => {
  t = await testApp();
});
afterAll(() => t.close());

describe('RG-5 inscription', () => {
  it('RG-4.1 : pas d’inscription en brouillon', async () => {
    const { res, body } = await t.inscrire('Gon');
    expect(res.statusCode).toBe(409);
    expect(body).toMatchObject({ ok: false, code: 'inscriptions_fermees', message: 'Les inscriptions sont fermées' });
  });

  it('RG-5.5 : inscription = kit (50 J + 1 sort) et jeton joueur', async () => {
    await t.setEtat('inscriptions', { inscriptionsOuvertes: true });
    const { body, id } = await t.inscrire('Gon');
    expect(body).toMatchObject({ ok: true, kit: { jenny: 50, rattrapage: 0 } });
    const [j] = await t.db.select().from(joueurs).where(eq(joueurs.id, id));
    expect(j?.jenny).toBe(50);
    expect(await t.db.select().from(sorts).where(eq(sorts.joueurId, id))).toHaveLength(1);
  });

  it('RG-5.1 : pseudo unique', async () => {
    const { body } = await t.inscrire('Gon');
    expect(body).toMatchObject({ ok: false, code: 'pseudo_pris' });
  });

  it('RG-5.1 + RG-15 : 2e inscription d’un appareil bloquée et alerte à l’équipe', async () => {
    const recues: string[] = [];
    t.app.gq.bus.on((e) => recues.push(`${e.a.type}:${e.evenement}`));
    const premier = await t.inscrire('Kirua');
    const res = await t.app.inject({
      method: 'POST',
      url: `/parties/${t.partieId}/inscription`,
      payload: { pseudo: 'Kirua2', appareilId: premier.appareilId, position: { lat: 0, lng: 0, precisionM: 5 } },
    });
    expect(res.json()).toMatchObject({ ok: false, code: 'appareil_deja_inscrit' });
    expect(recues).toContain('staff:alerte');
    const lignes = await t.db.select().from(journal).where(eq(journal.action, 'alerte'));
    expect(lignes).toHaveLength(1);
  });

  it('RG-5.1 : reconnexion par l’appareil', async () => {
    const { appareilId, id } = await t.inscrire('Leorio');
    const res = await t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/reconnexion`, payload: { appareilId } });
    expect(res.json()).toMatchObject({ ok: true, joueurId: id });
  });

  it('RG-5.6 : retardataire = kit + rattrapage proportionnel au temps de jeu', async () => {
    // Démarrée il y a 30 min réelles, sans pause : 30 min de jeu × 2 J.
    await t.setEtat('en_cours', { inscriptionsOuvertes: true, demarreeA: t.clock.t - 30 * 60_000 });
    const { body } = await t.inscrire('Kurapika');
    expect(body.kit).toMatchObject({ jenny: 50, rattrapage: 60 });
  });

  it('RG-5.3 : Examen une seule fois, bonus par bonne réponse', async () => {
    const { token, body } = await t.inscrire('Biscuit');
    const reponses = EXAMEN.map((q, i) => (i === 0 ? q.bonne : (q.bonne + 1) % q.choix.length));
    const res = await t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/examen`, headers: t.bearer(token), payload: { reponses } });
    expect(res.json()).toMatchObject({ ok: true, bonnes: 1, bonus: 10 });
    const moi = await t.app.inject({ url: `/parties/${t.partieId}/moi`, headers: t.bearer(token) });
    expect(moi.json().joueur).toMatchObject({ jenny: 50 + body.kit.rattrapage + 10, examenFait: true });
    const encore = await t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/examen`, headers: t.bearer(token), payload: { reponses } });
    expect(encore.json()).toMatchObject({ ok: false, code: 'deja_fait' });
  });

  it('RG-5.4 : test de Nen une seule fois', async () => {
    const { token } = await t.inscrire('Hisoka');
    const q = await t.app.inject({ url: `/parties/${t.partieId}/questionnaires` });
    expect(q.json().examen[0]).not.toHaveProperty('bonne');
    const res = await t.app.inject({
      method: 'POST',
      url: `/parties/${t.partieId}/nen`,
      headers: t.bearer(token),
      payload: { reponses: [2, 2, 2, 2, 2] },
    });
    expect(['transformation', 'specialisation']).toContain(res.json().nen);
    const encore = await t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/nen`, headers: t.bearer(token), payload: { reponses: [0, 0, 0, 0, 0] } });
    expect(encore.json().code).toBe('deja_fait');
  });
});
