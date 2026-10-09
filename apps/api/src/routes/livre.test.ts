import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exemplaires, pertes } from '../db/schema.js';
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

describe('RG-8.5 Livre du joueur', () => {
  it('pages de 10 : 3 pages de cartes désignées puis les emplacements libres ; provenance, perte, contrefaçon marquée pour son créateur', async () => {
    const res = await t.app.inject({ url: `/parties/${t.partieId}/livre`, headers: t.bearer(gon.token) });
    const l = res.json();
    expect(l).toMatchObject({ ok: true, gele: false, total: 30, cartesDesignees: 2 });
    expect(l.pages).toHaveLength(5); // 30 désignés + 15 libres (sort du kit et doublon dedans)
    expect(l.pages[0][0]).toMatchObject({ etat: 'plein', numero: 1, nom: 'Couronne du Roi-Dragon', provenance: 'Volée à Kirua' });
    expect(l.pages[0][5]).toMatchObject({ badge: 'contrefacon', provenance: 'Duplication' });
    expect(l.pages[2][9]).toMatchObject({ etat: 'perdu', message: expect.stringMatching(/^Volée par Kirua à \d\dh\d\d$/) });
    expect(l.libresUtilises).toBe(2);
  });

  it('RG-8.5 : un emplacement désigné vide montre la carte qui manque ; un emplacement libre non', async () => {
    const l = (await t.app.inject({ url: `/parties/${t.partieId}/livre`, headers: t.bearer(gon.token) })).json();
    expect(l.pages[0][1]).toMatchObject({ etat: 'vide', designe: true, carte: { numero: 2 } });
    expect(l.pages[0][0]).toMatchObject({ designe: true });
    expect(l.pages[3][0]).toMatchObject({ etat: 'plein', designe: false });
    expect(l.pages[4][4]).toEqual({ etat: 'vide', designe: false });
  });
});
