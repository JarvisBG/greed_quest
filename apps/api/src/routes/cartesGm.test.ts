import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SYSTEME } from '../core/journal.js';
import { tickPartie } from '../core/taches.js';
import { balises, cartes, cartesGm, exemplaires, joueurs, sorts } from '../db/schema.js';
import { newId } from '../ids.js';
import { CENTRE, testApp } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
type J = { token: string; id: string };
let gon: J, kirua: J, leolio: J;
let gm: string;
let actives: string[];
const ici = { ...CENTRE, precisionM: 5 };
const loin = { lat: CENTRE.lat + 0.02, lng: CENTRE.lng, precisionM: 5 };
const recues: { a: string; evenement: string; data: any }[] = [];

beforeAll(async () => {
  t = await testApp();
  await t.setEtat('en_cours', { inscriptionsOuvertes: true, demarreeA: t.clock.t, j: { value: 18, lastDecreaseAt: null } });
  gon = await t.inscrire('Gon');
  kirua = await t.inscrire('Kirua');
  leolio = await t.inscrire('Leolio', loin);
  gm = t.app.gq.tokens.issue({ role: 'gm', sub: 'gm1', partieId: t.partieId });
  await t.db.delete(sorts); // kits retirés
  actives = t.baliseIds.slice(0, 6);
  await t.db.update(balises).set({ etat: 'active', type: 'standard', stock: 5 }).where(inArray(balises.id, actives));
  t.app.gq.bus.on((e) => recues.push({ a: e.a.type === 'joueur' ? e.a.id : e.a.type, evenement: e.evenement, data: e.data }));
});
afterAll(() => t.close());

const post = (token: string, url: string, payload: Record<string, unknown>) =>
  t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/${url}`, headers: t.bearer(token), payload });
const get = (token: string, url: string) => t.app.inject({ url: `/parties/${t.partieId}/${url}`, headers: t.bearer(token) });
const parametre = (cle: string, value: number) =>
  t.app.inject({ method: 'PUT', url: `/parties/${t.partieId}/parametres`, headers: t.bearer(gm), payload: { cle, reglage: { mode: 'verrouille', value } } });
const ligne = async (type: 'jarvis' | 'ange') => (await t.db.select().from(cartesGm).where(eq(cartesGm.type, type)))[0];
const joueur = async (id: string) => (await t.db.select().from(joueurs).where(eq(joueurs.id, id)))[0]!;
const livre = async (j: J) => (await get(j.token, 'livre')).json();

describe('RG-8.15 à 8.21 : cartes de Maître du jeu', () => {
  it('RG-8.16 : au scan, une carte encore au Maître du jeu peut tomber ; elle va dans la page Objets, hors des 8 places', async () => {
    expect((await parametre('chanceCarteGmPct', 100)).statusCode).toBe(200);
    const r = await post(gon.token, 'scan', { baliseId: actives[0], position: ici });
    expect(r.json().ok).toBe(true);
    const gmGain = r.json().gains.find((g: { kind: string }) => g.kind === 'gm');
    expect(gmGain).toBeDefined();
    const l = await livre(gon);
    expect(l.cartesGm).toHaveLength(1);
    expect(l.objets).toHaveLength(0);
    expect(recues.some((x) => x.a === 'tracker' && x.evenement === 'fil' && x.data.type === 'carte_gm')).toBe(true);
  });

  it('RG-8.15 : chacune est unique ; la seconde tombe à un autre, puis plus rien', async () => {
    t.clock.t += 31_000;
    const r = await post(kirua.token, 'scan', { baliseId: actives[1], position: ici });
    expect(r.json().gains.filter((g: { kind: string }) => g.kind === 'gm')).toHaveLength(1);
    t.clock.t += 31_000;
    const r2 = await post(kirua.token, 'scan', { baliseId: actives[2], position: ici });
    expect(r2.json().gains.filter((g: { kind: string }) => g.kind === 'gm')).toHaveLength(0);
    expect((await parametre('chanceCarteGmPct', 0)).statusCode).toBe(200);
    // Le GM ne peut pas donner une carte déjà en jeu.
    expect((await post(gm, 'cartes-gm/donner', { gm: 'jarvis', joueurId: leolio.id, motif: 'essai' })).json()).toMatchObject({ ok: false, code: 'deja_en_jeu' });
  });

  it('RG-8.17 : le GM voit qui détient chaque carte', async () => {
    const r = (await get(gm, 'cartes-gm')).json();
    expect(r.cartes.map((x: { detenteur: { pseudo: string } | null }) => x.detenteur?.pseudo).sort()).toEqual(['Gon', 'Kirua']);
  });

  it('RG-8.19 : Jarvis tout-puissant, Décret (sans la SS) et Jugement ; la carte revient au Maître du jeu', async () => {
    // On range Jarvis chez Gon et Ange chez Kirua, quel que soit le tirage.
    const jarvis = (await ligne('jarvis'))!;
    const ange = (await ligne('ange'))!;
    await t.db.update(cartesGm).set({ joueurId: gon.id }).where(eq(cartesGm.id, jarvis.id));
    await t.db.update(cartesGm).set({ joueurId: kirua.id }).where(eq(cartesGm.id, ange.id));

    const decret = (await get(gon.token, 'cartes-gm/decret')).json();
    expect(decret.ok).toBe(true);
    expect(decret.cartes.some((x: { rang: string }) => x.rang === 'SS')).toBe(false);
    const voulue = decret.cartes[0];

    await post(kirua.token, 'position', ici);
    const r = await post(gon.token, 'cartes-gm/jouer', { gm: 'jarvis', itemId: jarvis.id, carteId: voulue.carteId, position: ici });
    expect(r.json()).toMatchObject({ ok: true, gm: 'jarvis', figes: ['Kirua'] });
    expect(r.json().carte.carteId).toBe(voulue.carteId);
    expect((await ligne('jarvis'))!.joueurId).toBeNull(); // revenue au Maître du jeu
    expect((await ligne('jarvis'))!.jouee).toBe(1);
    const ex = await t.db.select().from(exemplaires).where(eq(exemplaires.joueurId, gon.id));
    expect(ex.some((e) => e.carteId === voulue.carteId && e.origine.type === 'decret')).toBe(true);
    // Annonce à tous, Kirua prévenu ; Leolio, loin, n'est pas figé.
    expect(recues.some((x) => x.a === 'joueurs' && x.evenement === 'carte_gm_jouee')).toBe(true);
    expect(recues.some((x) => x.a === kirua.id && x.evenement === 'carte_gm_recue' && x.data.figeMs > 0)).toBe(true);
    expect((await joueur(leolio.id)).figeJusqua).toBeNull();
    expect((await joueur(gon.id)).intouchableJusqua).toBeGreaterThan(0);
  });

  it('RG-8.19 : figé, Kirua ne scanne plus ; il ne peut pas jouer sa carte ; Gon est intouchable', async () => {
    t.clock.t += 31_000;
    expect((await post(kirua.token, 'scan', { baliseId: actives[3], position: ici })).json()).toMatchObject({ ok: false, message: expect.stringMatching(/Jugement de Jarvis/) });
    const ange = (await ligne('ange'))!;
    expect((await post(kirua.token, 'cartes-gm/jouer', { gm: 'ange', itemId: ange.id, cibleId: gon.id, position: ici })).json()).toMatchObject({ ok: false, code: 'joueur_bloque' });
    const me = (await get(gon.token, 'moi')).json();
    expect(me.etatsGm.intouchable).toBeGreaterThan(0);
  });

  it('RG-8.20 : Le Sceau d’Ange scelle le Book de la cible 5 min (pas de rangement ni d’échange), puis immunité', async () => {
    t.clock.t += 4 * 60_000; // le Jugement est levé
    const ange = (await ligne('ange'))!;
    await post(leolio.token, 'position', ici);
    const r = await post(kirua.token, 'cartes-gm/jouer', { gm: 'ange', itemId: ange.id, cibleId: leolio.id, position: ici });
    expect(r.json()).toMatchObject({ ok: true, gm: 'ange', cible: 'Leolio' });
    expect(recues.some((x) => x.a === leolio.id && x.evenement === 'carte_gm_recue' && x.data.scelleMs === 5 * 60_000)).toBe(true);
    const l = await joueur(leolio.id);
    expect(l.scelleJusqua).toBeGreaterThan(0);
    expect(l.immuniteJusqua).toBe(l.scelleJusqua! + 5 * 60_000);
    // Book scellé : ni rangement, ni échange, ni scan.
    const [c1] = await t.db.select().from(cartes).where(eq(cartes.partieId, t.partieId)).limit(1);
    const ex = newId();
    await t.db.insert(exemplaires).values({ id: ex, partieId: t.partieId, joueurId: leolio.id, carteId: c1!.id, origine: { type: 'kit' }, obtenuA: 0 });
    expect((await post(leolio.token, 'book/deplacer', { itemId: ex, cacher: true })).json()).toMatchObject({ ok: false, code: 'livre_scelle' });
    expect((await post(leolio.token, 'echanges', { cibleId: gon.id, position: ici })).json()).toMatchObject({ ok: false });
    t.clock.t += 31_000;
    expect((await post(leolio.token, 'scan', { baliseId: actives[4], position: ici })).json()).toMatchObject({ ok: false, message: expect.stringMatching(/scellé par Ange/) });
  });

  it('RG-8.16 : le GM donne une carte libre, motif journalisé ; RG-8.17 : rendue à l’abandon', async () => {
    const r = await post(gm, 'cartes-gm/donner', { gm: 'ange', joueurId: leolio.id, motif: 'Mission secrète réussie' });
    expect(r.json()).toMatchObject({ ok: true });
    expect((await ligne('ange'))!.joueurId).toBe(leolio.id);
    expect((await post(leolio.token, 'abandon', {})).json()).toMatchObject({ ok: true });
    await t.app.gq.runner.run(t.partieId, SYSTEME, tickPartie);
    expect((await ligne('ange'))!.joueurId).toBeNull();
  });

  it('RG-8.16 : un raid peut promettre une carte libre au meilleur chasseur ; refusé si elle est en jeu', async () => {
    const jarvis = (await ligne('jarvis'))!;
    await t.db.update(cartesGm).set({ joueurId: gon.id }).where(eq(cartesGm.id, jarvis.id));
    expect((await post(gm, 'evenements', { type: 'raid', carteGm: 'jarvis' })).json()).toMatchObject({ ok: false, code: 'deja_en_jeu' });
    await t.db.update(cartesGm).set({ joueurId: null }).where(eq(cartesGm.id, jarvis.id));
  });

  it('RG-8.16 : seul le GM met une carte de Maître du jeu aux enchères', async () => {
    const pnj = t.app.gq.tokens.issue({ role: 'pnj', sub: 'pnj1', partieId: t.partieId });
    expect((await post(pnj, 'encheres', { carteGm: 'jarvis', prixDepart: 10 })).json()).toMatchObject({ ok: false, code: 'interdit' });
    const r = await post(gm, 'encheres', { carteGm: 'jarvis', prixDepart: 10 });
    expect(r.json()).toMatchObject({ ok: true, enchere: { carte: { gm: 'jarvis', nom: 'Jarvis tout-puissant' } } });
  });
});
