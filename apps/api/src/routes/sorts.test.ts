import type { SpellType } from '@gq/shared';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exemplaires, joueurs, pertes, sorts } from '../db/schema.js';
import { newId } from '../ids.js';
import { CENTRE, testApp } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
type J = { token: string; id: string };
let gon: J, kirua: J, leorio: J, hisoka: J;
const ici = { ...CENTRE, precisionM: 5 };
const loin = { lat: CENTRE.lat + 0.005, lng: CENTRE.lng, precisionM: 5 };
const recues: { a: string; evenement: string; data: unknown }[] = [];

beforeAll(async () => {
  t = await testApp();
  await t.setEtat('en_cours', { inscriptionsOuvertes: true, demarreeA: t.clock.t });
  t.app.gq.bus.on((e) => recues.push({ a: e.a.type === 'joueur' ? e.a.id : e.a.type, evenement: e.evenement, data: e.data }));
  gon = await t.inscrire('Gon');
  kirua = await t.inscrire('Kirua');
  leorio = await t.inscrire('Leorio');
  hisoka = await t.inscrire('Hisoka', loin);
  await t.db.delete(sorts); // kits retirés : chaque test donne ce dont il a besoin
});
afterAll(() => t.close());

async function donnerSort(joueurId: string, type: SpellType) {
  const id = newId();
  await t.db.insert(sorts).values({ id, partieId: t.partieId, joueurId, type, obtenuA: 0 });
  return id;
}
async function donnerCarte(joueurId: string, numero = 30) {
  const id = newId();
  await t.db.insert(exemplaires).values({ id, partieId: t.partieId, joueurId, carteId: t.carteIds[numero - 1]!, origine: { type: 'kit' }, obtenuA: 0 });
  return id;
}
const lancer = (j: J, payload: Record<string, unknown>, position = ici) =>
  t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/sort`, headers: t.bearer(j.token), payload: { position, ...payload } });
const bouger = (j: J, position = ici) =>
  t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/position`, headers: t.bearer(j.token), payload: position });

describe('RG-10 sorts', () => {
  it('RG-10.1 : liste des joueurs à portée, sans position', async () => {
    const res = await t.app.inject({ url: `/parties/${t.partieId}/a-portee`, headers: t.bearer(gon.token) });
    const pseudos = res.json().joueurs.map((j: { pseudo: string }) => j.pseudo).sort();
    expect(pseudos).toEqual(['Kirua', 'Leorio']);
    expect(res.json().joueurs[0]).not.toHaveProperty('position');
    // Radar et Émission : tous les autres joueurs, par pseudo, sans position (RG-10.12).
    expect(res.json().tous.map((j: { pseudo: string }) => j.pseudo)).toContain('Kirua');
    expect(res.json().tous.every((j: object) => Object.keys(j).sort().join() === 'id,pseudo')).toBe(true);
  });

  it('RG-10 Vol : la carte change de main, la cible est prévenue (RG-10.5), immunisée (RG-10.2), garde une trace (RG-8.13)', async () => {
    const vol = await donnerSort(gon.id, 'vol');
    const carte = await donnerCarte(kirua.id);
    const res = await lancer(gon, { sort: 'vol', source: { type: 'carte', itemId: vol }, cibleId: kirua.id });
    expect(res.json()).toMatchObject({ ok: true, resultat: 'reussi', recu: { itemId: carte } });
    const [ex] = await t.db.select().from(exemplaires).where(eq(exemplaires.id, carte));
    expect(ex?.joueurId).toBe(gon.id);
    expect(ex?.origine).toEqual({ type: 'vol', sur: kirua.id });
    const [s] = await t.db.select().from(sorts).where(eq(sorts.id, vol));
    expect(s?.utilise).toBe(true);
    expect(await t.db.select().from(pertes).where(eq(pertes.joueurId, kirua.id))).toMatchObject([{ cause: 'vol', par: gon.id }]);
    // RG-10.3 : le lanceur voit le délai avant son prochain sort offensif.
    const moi = (await t.app.inject({ url: `/parties/${t.partieId}/moi`, headers: t.bearer(gon.token) })).json();
    expect(moi.delais.offensif).toBeGreaterThan(0);
    expect(moi.delais.offensif).toBeLessThanOrEqual(120_000);
    expect(moi.pouvoirsUtilises).toEqual([]);
    const [k] = await t.db.select().from(joueurs).where(eq(joueurs.id, kirua.id));
    expect(k?.immuniteJusqua).toBeGreaterThan(0);
    expect(recues).toContainEqual({ a: kirua.id, evenement: 'sort_recu', data: { lanceur: 'Gon', sort: 'vol', resultat: 'reussi' } });
    expect(recues.some((e) => e.a === 'tracker' && e.evenement === 'fil')).toBe(true);
  });

  it('RG-10.3 : 2 min entre deux sorts offensifs du même lanceur ; un refus ne consomme rien', async () => {
    const gel = await donnerSort(gon.id, 'gel');
    const res = await lancer(gon, { sort: 'gel', source: { type: 'carte', itemId: gel }, cibleId: leorio.id });
    expect(res.json()).toMatchObject({ ok: false, code: 'delai_lanceur' });
    const [s] = await t.db.select().from(sorts).where(eq(sorts.id, gel));
    expect(s?.utilise).toBe(false);
  });

  it('RG-10.2 : cible immunisée 5 min', async () => {
    const gel = await donnerSort(leorio.id, 'gel');
    const res = await lancer(leorio, { sort: 'gel', source: { type: 'carte', itemId: gel }, cibleId: kirua.id });
    expect(res.json()).toMatchObject({ ok: false, code: 'cible_immunisee' });
  });

  it('RG-10.4 : la Barrière bloque et se consomme', async () => {
    t.clock.t += 3 * 60_000;
    await bouger(gon);
    await bouger(leorio);
    const barriere = await donnerSort(leorio.id, 'barriere');
    const gel = await donnerSort(gon.id, 'gel');
    const res = await lancer(gon, { sort: 'gel', source: { type: 'carte', itemId: gel }, cibleId: leorio.id });
    expect(res.json()).toMatchObject({ ok: true, resultat: 'bloque', protection: 'barriere' });
    const [b] = await t.db.select().from(sorts).where(eq(sorts.id, barriere));
    expect(b?.utilise).toBe(true);
  });

  it('RG-10.1 : hors de portée refusé', async () => {
    t.clock.t += 3 * 60_000;
    await bouger(hisoka, loin);
    const vol = await donnerSort(gon.id, 'vol');
    const res = await lancer(gon, { sort: 'vol', source: { type: 'carte', itemId: vol }, cibleId: hisoka.id });
    expect(res.json()).toMatchObject({ ok: false, code: 'cible_hors_portee', message: 'Ce joueur est hors de portée' });
  });

  it('Radar : zone de la dernière position de la cible', async () => {
    const radar = await donnerSort(gon.id, 'radar');
    const res = await lancer(gon, { sort: 'radar', itemId: radar, cibleId: hisoka.id });
    expect(res.json()).toMatchObject({ ok: true, sort: 'radar' });
    expect(res.json()).toHaveProperty('zone');
  });

  it('RG-10.7 Duplication sous la limite : vrai exemplaire', async () => {
    const dup = await donnerSort(leorio.id, 'duplication');
    const carte = await donnerCarte(leorio.id, 29);
    const res = await lancer(leorio, { sort: 'duplication', itemId: dup, carteItemId: carte });
    expect(res.json()).toMatchObject({ ok: true, copie: { contrefacon: false } });
    const copies = await t.db.select().from(exemplaires).where(and(eq(exemplaires.joueurId, leorio.id), eq(exemplaires.carteId, t.carteIds[28]!)));
    expect(copies).toHaveLength(2);
  });

  it('RG-10.8 Analyse : résultat privé, rien sur l’écran', async () => {
    const analyse = await donnerSort(leorio.id, 'analyse');
    const avant = recues.length;
    const res = await lancer(leorio, { sort: 'analyse', itemId: analyse, page: 3 });
    expect(res.json()).toMatchObject({ ok: true, contrefacons: [] });
    const fil = recues.slice(avant).find((e) => e.a === 'tracker');
    expect(fil?.data).not.toHaveProperty('contrefacons');
  });

  it('Barrière : ne se lance pas', async () => {
    const b = await donnerSort(leorio.id, 'barriere');
    expect((await lancer(leorio, { sort: 'barriere', itemId: b })).json()).toMatchObject({ ok: false, code: 'sort_passif' });
  });
});
