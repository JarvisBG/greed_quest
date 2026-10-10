import type { PouvoirSpe } from '@gq/shared';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { balises, exemplaires, joueurs, sorts } from '../db/schema.js';
import { newId } from '../ids.js';
import { CENTRE, testApp } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
type J = { token: string; id: string };
let gon: J, kirua: J, leorio: J;
let gm: string;
const ici = { ...CENTRE, precisionM: 5 };
const MIN = 60_000;

beforeAll(async () => {
  t = await testApp();
  await t.setEtat('en_cours', { inscriptionsOuvertes: true, demarreeA: t.clock.t, j: { value: 18, lastDecreaseAt: null } });
  gon = await t.inscrire('Gon');
  kirua = await t.inscrire('Kirua');
  leorio = await t.inscrire('Leorio');
  gm = t.app.gq.tokens.issue({ role: 'gm', sub: 'gm1', partieId: t.partieId });
  await t.db.delete(sorts);
});
afterAll(() => t.close());

const post = (j: J, url: string, payload: Record<string, unknown>) =>
  t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/${url}`, headers: t.bearer(j.token), payload });
const moi = async (j: J) => (await t.app.inject({ url: `/parties/${t.partieId}/moi`, headers: t.bearer(j.token) })).json();
const donner = (j: J, pouvoirSpe: PouvoirSpe) => t.db.update(joueurs).set({ nen: 'specialisation', pouvoirSpe, speA: null }).where(eq(joueurs.id, j.id));
async function carte(joueurId: string, numero: number, obtenuA = 0) {
  const id = newId();
  await t.db.insert(exemplaires).values({ id, partieId: t.partieId, joueurId, carteId: t.carteIds[numero - 1]!, origine: { type: 'kit' }, obtenuA });
  return id;
}

describe('Amendement 2026-10-10 : pouvoirs de Spécialisation', () => {
  it('test de Nen : un Spécialiste reçoit un pouvoir secret ; l’équipe le voit, pas les autres joueurs', async () => {
    await t.app.inject({ method: 'PUT', url: `/parties/${t.partieId}/parametres`, headers: t.bearer(gm), payload: { cle: 'specialisationPct', reglage: { mode: 'verrouille', value: 100 } } });
    const r = await post(leorio, 'nen', { reponses: [0, 0, 0, 0, 0] });
    expect(r.json()).toMatchObject({ ok: true, nen: 'specialisation' });
    expect(['alchimie', 'bandit', 'zetsu', 'fortune']).toContain(r.json().pouvoirSpe);
    expect((await moi(leorio)).joueur.pouvoirSpe).toBe(r.json().pouvoirSpe);
    const equipe = (await t.app.inject({ url: `/parties/${t.partieId}/joueurs`, headers: t.bearer(gm) })).json();
    expect(equipe.joueurs.find((x: { id: string }) => x.id === leorio.id).pouvoirSpe).toBe(r.json().pouvoirSpe);
    // Les listes de cibles ne montrent que des pseudos.
    const portee = (await t.app.inject({ url: `/parties/${t.partieId}/a-portee`, headers: t.bearer(gon.token) })).json();
    expect(JSON.stringify(portee)).not.toContain('pouvoirSpe');
  });

  it('Zetsu : invisible 10 min, ni dans les listes, ni ciblable, ni joignable pour un échange ; recharge 40 min', async () => {
    await donner(kirua, 'zetsu');
    expect((await post(kirua, 'specialisation', { pouvoir: 'zetsu' })).json()).toMatchObject({ ok: true, dureeMs: 10 * MIN });
    const portee = (await t.app.inject({ url: `/parties/${t.partieId}/a-portee`, headers: t.bearer(gon.token) })).json();
    expect(portee.joueurs.map((x: { pseudo: string }) => x.pseudo)).not.toContain('Kirua');
    expect(portee.tous.map((x: { pseudo: string }) => x.pseudo)).not.toContain('Kirua');
    const vol = newId();
    await t.db.insert(sorts).values({ id: vol, partieId: t.partieId, joueurId: gon.id, type: 'vol', obtenuA: 0 });
    expect((await post(gon, 'sort', { sort: 'vol', source: { type: 'carte', itemId: vol }, cibleId: kirua.id, position: ici })).json()).toMatchObject({ ok: false, code: 'cible_hors_radar' });
    expect((await post(gon, 'echanges', { cibleId: kirua.id, position: ici })).json()).toMatchObject({ ok: false, code: 'hors_portee' });
    expect((await moi(kirua)).delais.specialisation).toBe(40 * MIN);
    expect((await post(kirua, 'specialisation', { pouvoir: 'zetsu' })).json()).toMatchObject({ ok: false, code: 'pouvoir_indisponible' });
    t.clock.t += 10 * MIN; // fin du Zetsu
    expect((await t.app.inject({ url: `/parties/${t.partieId}/a-portee`, headers: t.bearer(gon.token) })).json().tous.map((x: { pseudo: string }) => x.pseudo)).toContain('Kirua');
  });

  it('Bandit : un Vol sans carte de sort, sur la carte visée', async () => {
    await donner(gon, 'bandit');
    await t.db.update(joueurs).set({ dernierOffensifA: null, immuniteJusqua: null }).where(inArray(joueurs.id, [gon.id, kirua.id]));
    const visee = await carte(kirua.id, 12);
    await carte(kirua.id, 25);
    await carte(kirua.id, 26);
    const r = await post(gon, 'sort', { sort: 'vol', source: { type: 'pouvoir' }, cibleId: kirua.id, carteVoulueId: t.carteIds[11], position: ici });
    expect(r.json()).toMatchObject({ ok: true, resultat: 'reussi', recu: { itemId: visee } });
    expect((await t.db.select().from(exemplaires).where(eq(exemplaires.id, visee)))[0]?.joueurId).toBe(gon.id);
    expect((await moi(gon)).delais.specialisation).toBe(40 * MIN);
  });

  it('Fortune : le prochain scan donne un gain de plus', async () => {
    await donner(leorio, 'fortune');
    expect((await post(leorio, 'specialisation', { pouvoir: 'fortune' })).json()).toMatchObject({ ok: true });
    expect((await moi(leorio)).specialisation.fortuneArmee).toBe(true);
    const b = t.baliseIds[0]!;
    await t.db.update(balises).set({ etat: 'active', type: 'standard', stock: 5 }).where(eq(balises.id, b));
    const r = await post(leorio, 'scan', { baliseId: b, position: ici });
    expect(r.json().gains).toHaveLength(2);
    expect((await moi(leorio)).specialisation.fortuneArmee).toBe(false);
  });

  it('Alchimie : un doublon devient la carte choisie du même rang ou du rang au-dessus', async () => {
    await donner(kirua, 'alchimie');
    // Catalogue de démo : cartes 1-2 SS, 3-5 S, 6-10 A… La carte 6 (A) en double, vers la carte 3 (S).
    const range = await carte(kirua.id, 6, 1);
    const doublon = await carte(kirua.id, 6, 2);
    const r = await post(kirua, 'specialisation', { pouvoir: 'alchimie', doublonItemId: doublon, carteVoulueId: t.carteIds[2] });
    expect(r.json()).toMatchObject({ ok: true, resultat: 'reussi', carte: { carteId: t.carteIds[2], rang: 'S' } });
    expect(await t.db.select().from(exemplaires).where(eq(exemplaires.id, doublon))).toEqual([]);
    expect((await t.db.select().from(exemplaires).where(eq(exemplaires.id, range))).length).toBe(1);
    const livre = (await t.app.inject({ url: `/parties/${t.partieId}/livre`, headers: t.bearer(kirua.token) })).json();
    expect(JSON.stringify(livre)).toContain('Alchimie');
  });
});
