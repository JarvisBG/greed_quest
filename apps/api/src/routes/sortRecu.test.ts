// Page ⑪ (RG-10.5) : ce que la cible apprend d'un sort reçu, en direct et au rattrapage.
import type { SpellType } from '@gq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exemplaires, sorts } from '../db/schema.js';
import { newId } from '../ids.js';
import { CENTRE, testApp } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
type J = { token: string; id: string };
let gon: J, kirua: J, leorio: J;
const ici = { ...CENTRE, precisionM: 5 };
const recues: { a: string; evenement: string; data: Record<string, unknown> }[] = [];

beforeAll(async () => {
  t = await testApp();
  await t.setEtat('en_cours', { inscriptionsOuvertes: true, demarreeA: t.clock.t });
  t.app.gq.bus.on((e) => recues.push({ a: e.a.type === 'joueur' ? e.a.id : e.a.type, evenement: e.evenement, data: e.data as Record<string, unknown> }));
  gon = await t.inscrire('Gon');
  kirua = await t.inscrire('Kirua');
  leorio = await t.inscrire('Leorio');
  await t.db.delete(sorts);
  await t.db.delete(exemplaires);
});
afterAll(() => t.close());

async function donnerSort(joueurId: string, type: SpellType) {
  const id = newId();
  await t.db.insert(sorts).values({ id, partieId: t.partieId, joueurId, type, obtenuA: 0 });
  return id;
}
async function donnerCarte(joueurId: string, numero: number) {
  const id = newId();
  await t.db.insert(exemplaires).values({ id, partieId: t.partieId, joueurId, carteId: t.carteIds[numero - 1]!, origine: { type: 'kit' }, obtenuA: 0 });
  return id;
}
const lancer = (j: J, payload: Record<string, unknown>) =>
  t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/sort`, headers: t.bearer(j.token), payload: { position: ici, ...payload } });
const bouger = (j: J) => t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/position`, headers: t.bearer(j.token), payload: ici });
/** Passe le délai entre offensifs (RG-10.3) et l'immunité (RG-10.2), positions fraîches. */
async function plusTard() {
  t.clock.t += 6 * 60_000;
  for (const j of [gon, kirua, leorio]) await bouger(j);
}
const dernierPour = (id: string) => recues.filter((e) => e.a === id && e.evenement === 'sort_recu').at(-1)?.data;
const rattrapage = (j: J, apres?: number) =>
  t.app.inject({ url: `/parties/${t.partieId}/sorts-recus${apres === undefined ? '' : `?apres=${apres}`}`, headers: t.bearer(j.token) });

describe('Page ⑪ : sort reçu (RG-10.5)', () => {
  let repere = 0;

  it('RG-10.5 rattrapage : sans repère, seulement le repère actuel', async () => {
    const r = (await rattrapage(kirua)).json();
    expect(r).toMatchObject({ ok: true, recus: [] });
    expect(r.repere).toEqual(expect.any(Number));
    repere = r.repere;
  });

  it('RG-10.5 Vol : la cible apprend la carte perdue et son emplacement fixe', async () => {
    const carte = await donnerCarte(kirua.id, 3);
    const vol = await donnerSort(gon.id, 'vol');
    expect((await lancer(gon, { sort: 'vol', source: { type: 'carte', itemId: vol }, cibleId: kirua.id })).json()).toMatchObject({ resultat: 'reussi' });
    expect(dernierPour(kirua.id)).toMatchObject({
      lanceur: 'Gon',
      sort: 'vol',
      resultat: 'reussi',
      n: expect.any(Number),
      perdue: { kind: 'carte', itemId: carte, emplacement: 'fixe', nom: expect.any(String), rang: expect.any(String), limite: expect.any(Number) },
      recue: null,
      protection: null,
      pouvoir: null,
    });
  });

  it('RG-10.5 Pickpocket : carte perdue dans les emplacements libres (doublon)', async () => {
    await plusTard();
    // Deux exemplaires de la même carte : l'un occupe l'emplacement fixe, l'autre un emplacement libre.
    const deux = [await donnerCarte(leorio.id, 5), await donnerCarte(leorio.id, 5)];
    const pick = await donnerSort(gon.id, 'pickpocket');
    expect((await lancer(gon, { sort: 'pickpocket', itemId: pick, cibleId: leorio.id })).json()).toMatchObject({ resultat: 'reussi' });
    expect(dernierPour(leorio.id)).toMatchObject({ sort: 'pickpocket', perdue: { kind: 'carte', itemId: expect.toBeOneOf(deux), emplacement: 'libre' } });
  });

  it('RG-10.5 Échange forcé : la cible voit ce qu’elle perd et ce qu’elle reçoit', async () => {
    await plusTard();
    const sienne = await donnerCarte(kirua.id, 7);
    const donnee = await donnerCarte(gon.id, 9);
    const ef = await donnerSort(gon.id, 'echange_force');
    const res = await lancer(gon, { sort: 'echange_force', source: { type: 'carte', itemId: ef }, cibleId: kirua.id, carteDonneeId: donnee });
    expect(res.json()).toMatchObject({ resultat: 'reussi' });
    expect(dernierPour(kirua.id)).toMatchObject({
      sort: 'echange_force',
      perdue: { itemId: sienne, emplacement: 'fixe' },
      recue: { itemId: donnee, kind: 'carte', nom: expect.any(String) },
    });
  });

  it('RG-10.4 / RG-10.5 : la protection consommée est annoncée à la cible', async () => {
    await plusTard();
    await donnerSort(leorio.id, 'barriere');
    const gel = await donnerSort(gon.id, 'gel');
    expect((await lancer(gon, { sort: 'gel', source: { type: 'carte', itemId: gel }, cibleId: leorio.id })).json()).toMatchObject({ resultat: 'bloque' });
    expect(dernierPour(leorio.id)).toMatchObject({ sort: 'gel', resultat: 'bloque', protection: 'barriere', perdue: null });
  });

  it('RG-10.5 rattrapage : les sorts reçus depuis le repère, sans ceux des autres', async () => {
    const r = (await rattrapage(kirua, repere)).json();
    expect(r.recus.map((x: { sort: string }) => x.sort)).toEqual(['vol', 'echange_force']);
    expect(r.recus[0]).toMatchObject({ lanceur: 'Gon', perdue: { emplacement: 'fixe' }, heureJeu: expect.any(Number) });
    expect(r.maintenant).toBeGreaterThanOrEqual(r.recus[1].heureJeu);
    // Après le dernier vu : plus rien.
    expect((await rattrapage(kirua, r.recus[1].n)).json().recus).toEqual([]);
    // Le repère suit le Journal.
    expect(r.repere).toBeGreaterThanOrEqual(r.recus[1].n);
  });
});
