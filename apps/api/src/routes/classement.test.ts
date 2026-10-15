import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exemplaires } from '../db/schema.js';
import { newId } from '../ids.js';
import { testApp } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
let gm: string;
type J = { token: string; id: string };
let gon: J, kirua: J, leolio: J;

const carte = (joueurId: string, i: number, faux = false) =>
  t.db.insert(exemplaires).values({
    id: newId(),
    partieId: t.partieId,
    joueurId,
    carteId: t.carteIds[i]!,
    origine: { type: 'kit' },
    obtenuA: 1000 * (i + 1),
    ...(faux ? { faux: { nature: 'copie' as const } } : {}),
  });

beforeAll(async () => {
  t = await testApp();
  gm = t.app.gq.tokens.issue({ role: 'gm', sub: 'gm1', partieId: t.partieId });
  await t.setEtat('en_cours', { inscriptionsOuvertes: true, demarreeA: t.clock.t });
  gon = await t.inscrire('Gon');
  kirua = await t.inscrire('Kirua');
  leolio = await t.inscrire('Leolio');
  // Gon : 3 vraies cartes désignées et une contrefaçon ; Kirua : 4 vraies ; Leolio : 1 vraie, puis abandonne.
  for (const i of [0, 1, 2]) await carte(gon.id, i);
  await carte(gon.id, 3, true);
  for (const i of [0, 1, 2, 3]) await carte(kirua.id, i);
  await carte(leolio.id, 0);
});
afterAll(() => t.close());

const get = (token: string) => t.app.inject({ method: 'GET', url: `/parties/${t.partieId}/classement`, headers: t.bearer(token) });
const post = (url: string, token: string, payload: Record<string, unknown> = {}) =>
  t.app.inject({ method: 'POST', url: `/parties/${t.partieId}${url}`, headers: t.bearer(token), payload });

describe('Page ⑱ classement final lu par le joueur', () => {
  it('RG-4.6 : pas de classement final avant la fin', async () => {
    expect((await get(gon.token)).json()).toMatchObject({ ok: false, code: 'pas_terminee' });
  });

  it('RG-5.7 : le joueur qui abandonne reste classé, marqué « abandon »', async () => {
    expect((await post('/abandon', leolio.token)).json().ok).toBe(true);
    expect((await post('/cycle', gm, { action: 'terminer' })).json().ok).toBe(true);
    const r = (await get(leolio.token)).json();
    expect(r.lignes.find((l: { pseudo: string }) => l.pseudo === 'Leolio')).toMatchObject({ abandon: true, moi: true, cartes: 1 });
    expect(r.moi).toMatchObject({ abandon: true, cartes: 1 });
  });

  it('RG-13.5 / RG-13.7 : vraies cartes seulement ; ni jenny ni heure des autres ; son propre détail', async () => {
    const r = (await get(gon.token)).json();
    expect(r).toMatchObject({ ok: true, gagnant: null, designees: t.carteIds.length });
    expect(r.lignes.map((l: { pseudo: string; place: number }) => [l.place, l.pseudo])).toEqual([
      [1, 'Kirua'],
      [2, 'Gon'],
      [3, 'Leolio'],
    ]);
    for (const l of r.lignes) expect(Object.keys(l).sort()).toEqual(['abandon', 'cartes', 'moi', 'place', 'points', 'pseudo']);
    expect(r.lignes[1]).toMatchObject({ moi: true, cartes: 3, abandon: false });
    // La contrefaçon de Gon n'a pas compté ; il le sait.
    expect(r.moi).toMatchObject({ place: 2, cartes: 3, contrefacons: 1, derniereCarteA: 3000, abandon: false });
    expect(typeof r.moi.jenny).toBe('number');
  });
});
