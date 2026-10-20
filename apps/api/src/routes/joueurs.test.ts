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

  it('RG-5.6 amendé (2026-10-10) : un retardataire reçoit le kit normal, sans bonus de rattrapage par défaut', async () => {
    // Démarrée il y a 30 min réelles : le rattrapage (`rattrapageJParMin`, 0 par défaut) reste réglable par le GM.
    await t.setEtat('en_cours', { inscriptionsOuvertes: true, demarreeA: t.clock.t - 30 * 60_000 });
    const { body } = await t.inscrire('Kurapika');
    expect(body.kit).toMatchObject({ jenny: 50, rattrapage: 0 });
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

  it('RG-14 / RG-5.4 : /moi donne la durée complète des recharges, pour la jauge du pouvoir (page ⑩)', async () => {
    const { token } = await t.inscrire('Wing');
    const moi = (await t.app.inject({ url: `/parties/${t.partieId}/moi`, headers: t.bearer(token) })).json();
    expect(moi.recharges).toEqual({ pouvoir: null, transformation: 20 * 60_000, reserve: 40 * 60_000, specialisation: 40 * 60_000, zetsu: 10 * 60_000 });
  });
});

describe('RG-5.1 amendé (2026-10-20) : code de secours, partie reprise sur un autre téléphone', () => {
  const nouveauTel = 'nouveau-telephone-de-morel-xxx';
  const reprendre = (pseudo: string, code: string, appareilId = nouveauTel) =>
    t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/reconnexion-code`, payload: { pseudo, code, appareilId } });

  it('RG-5.1 : l’inscription donne un code de secours de 6 caractères (sans O, 0, I, 1), rappelé par /moi', async () => {
    const { body, token } = await t.inscrire('Morel');
    expect(body.codeSecours).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const moi = (await t.app.inject({ url: `/parties/${t.partieId}/moi`, headers: t.bearer(token) })).json();
    expect(moi.codeSecours).toBe(body.codeSecours);
  });

  it('RG-5.1 : pseudo + code (minuscules acceptées) → même joueur sur le nouveau téléphone ; l’ancien est déconnecté ; l’équipe est alertée', async () => {
    const recues: string[] = [];
    const off = t.app.gq.bus.on((e) => recues.push(`${e.a.type}:${e.evenement}`));
    const [j] = await t.db.select().from(joueurs).where(eq(joueurs.pseudo, 'Morel'));
    const ancien = t.app.gq.tokens.issue({ role: 'joueur', sub: j!.id, partieId: t.partieId, v: 0 });
    const res = await reprendre('Morel', j!.codeSecours!.toLowerCase());
    off();
    expect(res.json()).toMatchObject({ ok: true, joueurId: j!.id });
    const nouveau = res.json().token as string;
    expect((await t.app.inject({ url: `/parties/${t.partieId}/moi`, headers: t.bearer(nouveau) })).json().joueur.pseudo).toBe('Morel');
    const refuse = await t.app.inject({ url: `/parties/${t.partieId}/moi`, headers: t.bearer(ancien) });
    expect(refuse.statusCode).toBe(401);
    expect(refuse.json()).toMatchObject({ code: 'session_remplacee', message: 'Ta partie a été ouverte sur un autre téléphone' });
    expect(recues).toEqual(expect.arrayContaining(['staff:alerte', 'joueur:session_remplacee']));
    // Le nouveau téléphone se reconnecte aussi tout seul (même appareil).
    const parAppareil = await t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/reconnexion`, payload: { appareilId: nouveauTel } });
    expect((await t.app.inject({ url: `/parties/${t.partieId}/moi`, headers: t.bearer(parAppareil.json().token) })).statusCode).toBe(200);
  });

  it('RG-5.1 : 5 codes faux → 10 min de blocage, même avec le bon code ensuite', async () => {
    const { body } = await t.inscrire('Pariston');
    for (let i = 0; i < 4; i++) expect((await reprendre('Pariston', 'AAAAAA', 'tel-de-pariston-xxxxxxx')).json().code).toBe('code_invalide');
    expect((await reprendre('Pariston', 'AAAAAA', 'tel-de-pariston-xxxxxxx')).json().message).toContain('Trop d’essais');
    expect((await reprendre('Pariston', body.codeSecours, 'tel-de-pariston-xxxxxxx')).json().code).toBe('code_bloque');
    t.clock.t += 10 * 60_000 + 1;
    expect((await reprendre('Pariston', body.codeSecours, 'tel-de-pariston-xxxxxxx')).json().ok).toBe(true);
  });

  it('RG-5.1 : pseudo inconnu = même message qu’un code faux (on ne devine pas les pseudos)', async () => {
    expect((await reprendre('Personne', 'AAAAAA')).json()).toMatchObject({ code: 'code_invalide', message: 'Pseudo ou code de secours incorrect' });
  });

  it('RG-5.1 : le GM lit le code d’un joueur qui l’a oublié (consultation au journal, sans le code) ; pas un PNJ', async () => {
    const { body, id } = await t.inscrire('Kite');
    const gm = t.app.gq.tokens.issue({ role: 'gm', sub: 'gm1', partieId: t.partieId });
    const pnj = t.app.gq.tokens.issue({ role: 'pnj', sub: 'pnj1', partieId: t.partieId });
    const url = `/parties/${t.partieId}/joueurs/${id}/code-secours`;
    expect((await t.app.inject({ url, headers: t.bearer(pnj) })).statusCode).toBe(403);
    expect((await t.app.inject({ url, headers: t.bearer(gm) })).json()).toMatchObject({ ok: true, pseudo: 'Kite', code: body.codeSecours });
    const [ligne] = (await t.db.select().from(journal).where(eq(journal.action, 'code_secours'))).filter((l) => l.resultat === 'consulte');
    expect(ligne).toMatchObject({ acteurType: 'gm', details: { joueurId: id } });
    expect(JSON.stringify(ligne?.details)).not.toContain(body.codeSecours);
  });

  it('RG-5.1 / RG-3.1 : le GM donne un nouveau code (motif au journal, sans le code) ; l’ancien ne marche plus', async () => {
    const { body, id } = await t.inscrire('Cheadle');
    const gm = t.app.gq.tokens.issue({ role: 'gm', sub: 'gm1', partieId: t.partieId });
    const pnj = t.app.gq.tokens.issue({ role: 'pnj', sub: 'pnj1', partieId: t.partieId });
    const url = `/parties/${t.partieId}/joueurs/code-secours`;
    expect((await t.app.inject({ method: 'POST', url, headers: t.bearer(pnj), payload: { joueurId: id, motif: 'Code perdu' } })).statusCode).toBe(403);
    const r = (await t.app.inject({ method: 'POST', url, headers: t.bearer(gm), payload: { joueurId: id, motif: 'Code perdu' } })).json();
    expect(r).toMatchObject({ ok: true, pseudo: 'Cheadle' });
    expect(r.code).not.toBe(body.codeSecours);
    const lignes = await t.db.select().from(journal).where(eq(journal.action, 'code_secours'));
    expect(lignes.at(-1)).toMatchObject({ motif: 'Code perdu' });
    expect(JSON.stringify(lignes.at(-1)?.details)).not.toContain(r.code);
    expect((await reprendre('Cheadle', body.codeSecours, 'tel-de-cheadle-xxxxxxxxx')).json().code).toBe('code_invalide');
    expect((await reprendre('Cheadle', r.code, 'tel-de-cheadle-xxxxxxxxx')).json().ok).toBe(true);
  });
});
