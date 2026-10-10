import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { exemplaires, livres, pertes } from '../db/schema.js';
import { newId } from '../ids.js';
import { testApp } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
let gon: { token: string; id: string };
let kirua: { token: string; id: string };

beforeAll(async () => {
  t = await testApp();
  await t.setEtat('en_cours', { inscriptionsOuvertes: true, demarreeA: t.clock.t });
  gon = await t.inscrire('Gon');
  kirua = await t.inscrire('Kirua');
  await t.db.insert(exemplaires).values([
    { id: newId(), partieId: t.partieId, joueurId: gon.id, carteId: t.carteIds[0]!, origine: { type: 'vol', sur: kirua.id }, obtenuA: 0 },
    { id: newId(), partieId: t.partieId, joueurId: gon.id, carteId: t.carteIds[0]!, origine: { type: 'balise', baliseId: 'x' }, obtenuA: 1 },
    { id: newId(), partieId: t.partieId, joueurId: gon.id, carteId: t.carteIds[5]!, origine: { type: 'duplication' }, obtenuA: 2, faux: { nature: 'copie' }, marque: 'creee' },
  ]);
  await t.db.insert(pertes).values({ joueurId: gon.id, carteId: t.carteIds[29]!, cause: 'vol', par: kirua.id, a: 0 });
});
afterAll(() => t.close());

describe('RG-8.5 Book du joueur', () => {
  it('pages de 10 : 3 pages de cartes désignées puis les emplacements libres ; provenance, perte, contrefaçon marquée pour son créateur', async () => {
    const res = await t.app.inject({ url: `/parties/${t.partieId}/livre`, headers: t.bearer(gon.token) });
    const l = res.json();
    expect(l).toMatchObject({ ok: true, gele: false, total: 30, cartesDesignees: 2 });
    expect(l.pages).toHaveLength(5); // 30 désignés + 15 libres (sort du kit et doublon dedans)
    expect(l.pages[0][0]).toMatchObject({ etat: 'plein', numero: 0, nom: 'Le bonheur du détenteur', provenance: 'Volée à Kirua' });
    expect(l.pages[1][6]).toMatchObject({ badge: 'contrefacon', provenance: 'Duplication' });
    expect(l.pages[1][8]).toMatchObject({ etat: 'perdu', message: expect.stringMatching(/^Volée par Kirua à \d\dh\d\d$/) });
    expect(l.libresUtilises).toBe(2);
  });

  it('RG-8.2 : chaque carte montre son texte d’ambiance et la limite d’exemplaires de la partie (« SS-1 »)', async () => {
    const l = (await t.app.inject({ url: `/parties/${t.partieId}/livre`, headers: t.bearer(gon.token) })).json();
    expect(l.pages[0][0]).toMatchObject({ rang: 'SS', texte: expect.stringContaining('10 000 habitants'), limite: expect.any(Number) });
    expect(l.pages[0][1]).toMatchObject({ etat: 'vide', carte: { texte: expect.any(String), limite: expect.any(Number) } });
  });

  it('RG-8.5 : un emplacement désigné vide montre la carte qui manque ; un emplacement libre non', async () => {
    const l = (await t.app.inject({ url: `/parties/${t.partieId}/livre`, headers: t.bearer(gon.token) })).json();
    expect(l.pages[0][1]).toMatchObject({ etat: 'vide', designe: true, carte: { numero: 3 } });
    expect(l.pages[0][0]).toMatchObject({ designe: true });
    expect(l.pages[3][0]).toMatchObject({ etat: 'plein', designe: false });
    expect(l.pages[4][4]).toEqual({ etat: 'vide', designe: false });
  });
});

describe('RG-3.1 Book d’un joueur pour le GM', () => {
  it('RG-3.1 : le GM voit le Book de Gon et la vérité de chaque carte ; un PNJ ou un joueur, non', async () => {
    const gm = t.app.gq.tokens.issue({ role: 'gm', sub: 'gm1', partieId: t.partieId });
    const pnj = t.app.gq.tokens.issue({ role: 'pnj', sub: 'pnj1', partieId: t.partieId });
    const url = `/parties/${t.partieId}/joueurs/${gon.id}/livre`;
    const l = (await t.app.inject({ url, headers: t.bearer(gm) })).json();
    expect(l).toMatchObject({ ok: true, pseudo: 'Gon', cartesDesignees: 2, total: 30 });
    expect(l.pages[1][6]).toMatchObject({ itemId: expect.any(String), verite: { contrefacon: 'copie', marque: 'creee', maudite: false } });
    expect(l.pages[0][0]).toMatchObject({ verite: { contrefacon: null } });
    expect((await t.app.inject({ url, headers: t.bearer(pnj) })).statusCode).toBe(403);
    expect((await t.app.inject({ url, headers: t.bearer(kirua.token) })).statusCode).toBe(403);
    // Le joueur ne reçoit jamais la vérité.
    const propre = (await t.app.inject({ url: `/parties/${t.partieId}/livre`, headers: t.bearer(gon.token) })).json();
    expect(propre.pages[1][6].verite).toBeUndefined();
  });

  it('RG-13.1 : un Book gelé (Clear déclaré) apparaît dans la liste des joueurs de l’équipe', async () => {
    const pnj = t.app.gq.tokens.issue({ role: 'pnj', sub: 'pnj1', partieId: t.partieId });
    await t.db.update(livres).set({ gele: true, geleA: 0 }).where(eq(livres.joueurId, gon.id));
    const js = (await t.app.inject({ url: `/parties/${t.partieId}/joueurs`, headers: t.bearer(pnj) })).json().joueurs;
    expect(js.find((j: { pseudo: string }) => j.pseudo === 'Gon')).toMatchObject({ livreGele: true });
    expect(js.find((j: { pseudo: string }) => j.pseudo === 'Kirua')).toMatchObject({ livreGele: false });
    await t.db.update(livres).set({ gele: false, geleA: null }).where(eq(livres.joueurId, gon.id));
  });
});
