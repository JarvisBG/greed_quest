// Amendements « fidélité à l'anime » du 2026-10-10 (REGLES.md) côté API : Book, cartes cachées (RG-8.5),
// Vol / Pickpocket, Voyance / Clairvoyance, Accompagnement (position au seul lanceur), Retour.
import type { SpellType } from '@gq/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exemplaires, joueurs, sorts, zones } from '../db/schema.js';
import { newId } from '../ids.js';
import { CENTRE, testApp } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
type J = { token: string; id: string };
let gon: J, kirua: J, leorio: J;
const ici = { ...CENTRE, precisionM: 5 };
const loin = { lat: CENTRE.lat + 0.005, lng: CENTRE.lng, precisionM: 5 };
const recues: { a: string; evenement: string; data: unknown }[] = [];
let qrMasadora: string;

beforeAll(async () => {
  t = await testApp();
  await t.setEtat('en_cours', { inscriptionsOuvertes: true, demarreeA: t.clock.t });
  t.app.gq.bus.on((e) => recues.push({ a: e.a.type === 'joueur' ? e.a.id : e.a.type, evenement: e.evenement, data: e.data }));
  gon = await t.inscrire('Gon');
  kirua = await t.inscrire('Kirua');
  leorio = await t.inscrire('Leorio');
  await t.db.delete(sorts);
  qrMasadora = (await t.db.select().from(zones).where(eq(zones.partieId, t.partieId))).find((z) => z.type === 'masadora')!.qr!;
});
afterAll(() => t.close());

const url = (u: string) => `/parties/${t.partieId}${u}`;
const post = (j: J, u: string, payload: Record<string, unknown>) => t.app.inject({ method: 'POST', url: url(u), headers: t.bearer(j.token), payload });
const get = (j: J, u: string) => t.app.inject({ url: url(u), headers: t.bearer(j.token) });
const lancer = (j: J, payload: Record<string, unknown>, position = ici) => post(j, '/sort', { position, ...payload });
async function donnerSort(joueurId: string, type: SpellType) {
  const id = newId();
  await t.db.insert(sorts).values({ id, partieId: t.partieId, joueurId, type, obtenuA: 0 });
  return id;
}
let ordre = 0; // heures d'obtention croissantes : le premier exemplaire donné occupe l'emplacement fixe
async function donnerCarte(joueurId: string, numero: number) {
  const id = newId();
  await t.db.insert(exemplaires).values({ id, partieId: t.partieId, joueurId, carteId: t.carteIds[numero - 1]!, origine: { type: 'kit' }, obtenuA: ordre++ });
  return id;
}
const passer = (min: number) => {
  t.clock.t += min * 60_000;
};

describe('RG-8.5 amendé : cacher une carte (POST /book/deplacer)', () => {
  it('RG-8.5 : la carte cachée passe dans les emplacements libres, marquée ; elle se remet en place', async () => {
    const x = await donnerCarte(gon.id, 3);
    expect((await post(gon, '/book/deplacer', { itemId: x, cacher: true })).json()).toMatchObject({ ok: true, cachee: true });
    const l = (await get(gon, '/livre')).json();
    expect(l.pages[2][9]).toMatchObject({ etat: 'vide', designe: true }); // carteIds[2] = 099, dernière place fixe
    expect(l.pages.flat().find((s: { itemId?: string }) => s.itemId === x)).toMatchObject({ designe: false, cachee: true });
    expect(l.cartesDesignees).toBe(0); // RG-13 : une carte cachée ne compte pas
    expect((await post(gon, '/book/deplacer', { itemId: x, cacher: false })).json()).toMatchObject({ ok: true, cachee: false });
    expect((await get(gon, '/livre')).json().cartesDesignees).toBe(1);
  });

  it('RG-8.5 : refus en clair (carte pas en place)', async () => {
    const x = await donnerCarte(gon.id, 3); // doublon : déjà dans les libres
    expect((await post(gon, '/book/deplacer', { itemId: x, cacher: true })).json()).toMatchObject({
      ok: false,
      message: 'Seule une carte rangée dans son emplacement fixe peut être cachée',
    });
  });
});

describe('RG-10 amendé : Vol, Pickpocket, Clairvoyance', () => {
  it('RG-10 : Vol prend la carte en place, Pickpocket le doublon', async () => {
    const enPlace = await donnerCarte(kirua.id, 5);
    const doublon = await donnerCarte(kirua.id, 5);
    passer(6);
    const vol = await donnerSort(leorio.id, 'vol');
    expect((await lancer(leorio, { sort: 'vol', source: { type: 'carte', itemId: vol }, cibleId: kirua.id })).json()).toMatchObject({
      ok: true,
      resultat: 'reussi',
      recu: { itemId: enPlace },
    });
    passer(6);
    await post(kirua, '/position', ici); // Kirua reste ciblable (RG-10.10)
    const pick = await donnerSort(leorio.id, 'pickpocket');
    // Après le Vol, l'ancien doublon a repris l'emplacement fixe : Pickpocket ne trouve plus rien dans les libres.
    expect((await lancer(leorio, { sort: 'pickpocket', itemId: pick, cibleId: kirua.id })).json()).toMatchObject({ ok: true, resultat: 'sans_effet' });
    void doublon;
  });

  it('RG-10 : Clairvoyance montre les emplacements fixes d’un joueur croisé, anonyme', async () => {
    await donnerCarte(leorio.id, 7);
    passer(1);
    await post(gon, '/position', ici);
    await post(leorio, '/position', ici); // rencontre
    const clair = await donnerSort(gon.id, 'clairvoyance');
    recues.length = 0;
    const res = await lancer(gon, { sort: 'clairvoyance', itemId: clair, cibleId: leorio.id });
    expect(res.json()).toMatchObject({ ok: true, sort: 'clairvoyance', resultat: 'reussi' });
    expect(res.json().cartes).toContainEqual(expect.objectContaining({ numero: 94 }));
    expect(recues).toContainEqual({ a: leorio.id, evenement: 'sort_recu', data: { lanceur: null, sort: 'clairvoyance', resultat: 'reussi' } });
  });
});

describe('RG-10 amendé : Accompagnement', () => {
  it('RG-10 / RG-10.12 : la cible croisée est gelée 3 min ; sa position exacte va au seul lanceur', async () => {
    passer(6);
    await post(gon, '/position', ici);
    await post(kirua, '/position', ici); // Gon et Kirua se croisent
    await post(kirua, '/position', loin); // Kirua s'éloigne
    const acc = await donnerSort(gon.id, 'accompagnement');
    recues.length = 0;
    const res = await lancer(gon, { sort: 'accompagnement', itemId: acc, cibleId: kirua.id });
    expect(res.json()).toMatchObject({ ok: true, resultat: 'reussi', accompagnement: { cibleId: kirua.id, pseudo: 'Kirua' } });
    expect(res.json().accompagnement.position.lat).toBeCloseTo(loin.lat, 5);
    const [k] = await t.db.select().from(joueurs).where(eq(joueurs.id, kirua.id));
    expect(k?.accompagnePar).toBe(gon.id);
    // Kirua bouge : sa position part à Gon, et à personne d'autre.
    recues.length = 0;
    await post(kirua, '/position', ici);
    const envois = recues.filter((e) => e.evenement === 'accompagnement');
    expect(envois).toHaveLength(1);
    expect(envois[0]).toMatchObject({ a: gon.id, data: { cibleId: kirua.id } });
    // Sous Accompagnement : ni scan, ni sort, ni échange.
    const vol = await donnerSort(kirua.id, 'vol');
    expect((await lancer(kirua, { sort: 'vol', source: { type: 'carte', itemId: vol }, cibleId: leorio.id })).json()).toMatchObject({ ok: false, code: 'lanceur_bloque' });
    expect((await post(kirua, '/echanges', { cibleId: leorio.id, position: ici })).json()).toMatchObject({ ok: false, code: 'accompagne' });
    expect((await get(kirua, '/moi')).json().accompagne).toBeGreaterThan(0);
    expect((await get(gon, '/accompagnement')).json().accompagnement).toMatchObject({ cibleId: kirua.id });
    passer(4);
    expect((await get(gon, '/accompagnement')).json().accompagnement).toBeNull();
    await post(kirua, '/position', ici);
    expect(recues.filter((e) => e.evenement === 'accompagnement')).toHaveLength(1); // plus rien après 3 min
  });
});

describe('RG-10 amendé : Retour', () => {
  it('RG-10 : Retour exige une ville visitée, puis ouvre Masadora à distance (sans QR)', async () => {
    const r1 = await donnerSort(leorio.id, 'retour');
    expect((await lancer(leorio, { sort: 'retour', itemId: r1, ville: 'masadora' })).json()).toMatchObject({ ok: false, code: 'ville_inconnue' });
    expect((await post(leorio, '/boutique/achat', { position: loin })).json()).toMatchObject({ ok: false, code: 'pas_sur_place' });
    await t.db.update(joueurs).set({ jenny: 500 }).where(eq(joueurs.id, leorio.id));
    await post(leorio, '/boutique/achat', { qr: qrMasadora, position: ici }); // sur place : la visite est notée
    expect((await get(leorio, '/moi')).json().villesVisitees).toEqual(['masadora']);
    expect((await lancer(leorio, { sort: 'retour', itemId: r1, ville: 'masadora' }, loin)).json()).toMatchObject({ ok: true, sort: 'retour', ville: 'masadora' });
    expect((await get(leorio, '/moi')).json().retour).toMatchObject({ ville: 'masadora' });
    await donnerCarte(leorio.id, 9);
    const doublon = await donnerCarte(leorio.id, 9);
    expect((await post(leorio, '/boutique/revente', { itemId: doublon, position: loin })).json()).toMatchObject({ ok: true }); // à distance, sans QR
    passer(11); // la visite à distance dure 10 min
    const autre = await donnerCarte(leorio.id, 9);
    expect((await post(leorio, '/boutique/revente', { itemId: autre, position: loin })).json()).toMatchObject({ ok: false, code: 'pas_sur_place' });
  });
});
