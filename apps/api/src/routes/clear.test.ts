import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { licenceCode } from '../core/licence.js';
import { cartes, exemplaires, joueurs, parties, sorts } from '../db/schema.js';
import { newId } from '../ids.js';
import { CENTRE, testApp } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
let gm: string;
type J = { token: string; id: string };
let gon: J, kirua: J;
let faux: string;
const items: string[] = [];
const ici = { ...CENTRE, precisionM: 5 };
const recues: { a: string; evenement: string }[] = [];

beforeAll(async () => {
  t = await testApp();
  t.app.gq.bus.on((e) => recues.push({ a: e.a.type === 'joueur' ? e.a.id : e.a.type, evenement: e.evenement }));
  gm = t.app.gq.tokens.issue({ role: 'gm', sub: 'gm1', partieId: t.partieId });
  await t.setEtat('en_cours', { inscriptionsOuvertes: true, demarreeA: t.clock.t });
  gon = await t.inscrire('Gon');
  kirua = await t.inscrire('Kirua');
  // Gon a 29 vraies cartes désignées et une contrefaçon de la 15e du catalogue (n° 010, page 1 du Book).
  for (const [i, carteId] of t.carteIds.entries()) {
    const id = newId();
    items.push(id);
    await t.db.insert(exemplaires).values({
      id,
      partieId: t.partieId,
      joueurId: gon.id,
      carteId,
      origine: { type: 'kit' },
      obtenuA: i,
      ...(i === 14 ? { faux: { nature: 'copie' as const } } : {}),
    });
  }
  faux = items[14]!;
  await t.db.update(cartes).set({ lotReel: 'Lot n°1' }).where(eq(cartes.id, t.carteIds[0]!));
});
afterAll(() => t.close());

const post = (url: string, token: string, payload: Record<string, unknown> = {}) =>
  t.app.inject({ method: 'POST', url: `/parties/${t.partieId}${url}`, headers: t.bearer(token), payload });
const get = async (token: string) => (await t.app.inject({ method: 'GET', url: `/parties/${t.partieId}/clear`, headers: t.bearer(token) })).json();
const licence = async (j: J) => licenceCode(j.id, (await t.db.select().from(joueurs).where(eq(joueurs.id, j.id)))[0]!.licenceSecret, t.clock.t).qr;

describe('RG-13 Clear', () => {
  it('Book incomplet : refusé avec le nombre de cartes manquantes', async () => {
    expect((await post('/clear', kirua.token)).json()).toMatchObject({ ok: false, code: 'incomplet', message: 'Il te manque 30 cartes' });
  });

  it('RG-13.1 : contrefaçon présente → refus, la page est indiquée mais pas la carte', async () => {
    expect((await post('/clear', gon.token)).json()).toMatchObject({ ok: false, code: 'contrefacon', message: 'Une contrefaçon se cache en page 1' });
  });

  it('RG-13.1 : Book complet → Book gelé, insensible aux sorts ; l’équipe est prévenue', async () => {
    await t.db.update(exemplaires).set({ faux: null }).where(eq(exemplaires.id, faux));
    expect((await post('/clear', gon.token)).json()).toMatchObject({ ok: true });
    expect(recues.some((e) => e.a === 'staff' && e.evenement === 'demande_clear')).toBe(true);
    const vol = newId();
    await t.db.insert(sorts).values({ id: vol, partieId: t.partieId, joueurId: kirua.id, type: 'vol', obtenuA: 0 });
    await post('/position', gon.token, ici);
    const res = await post('/sort', kirua.token, { sort: 'vol', source: { type: 'carte', itemId: vol }, cibleId: gon.id, position: ici });
    expect(res.json()).toMatchObject({ ok: false, code: 'cible_livre_gele' });
  });

  it('Page ⑰ : Clear déclaré lisible par le joueur (reprise), rien pour les autres', async () => {
    expect(await get(gon.token)).toEqual({ ok: true, etat: 'declare', gagnant: null });
    expect(await get(kirua.token)).toEqual({ ok: true, etat: 'aucun', gagnant: null });
  });

  it('RG-13.3 : avant confirmation, pas de choix de récompenses', async () => {
    expect((await post('/clear/recompenses', gon.token, { itemIds: items.slice(0, 3) })).json().code).toBe('pas_gagnant');
  });

  it('RG-13.2 : le GM scanne la licence → partie terminée, classement figé, annonce plein écran', async () => {
    expect((await post('/clear/confirmer', gm, { licence: await licence(kirua) })).json().code).toBe('pas_de_clear');
    const res = await post('/clear/confirmer', gm, { licence: await licence(gon) });
    expect(res.json()).toMatchObject({ ok: true, gagnant: 'Gon' });
    const [p] = await t.db.select().from(parties).where(eq(parties.id, t.partieId));
    expect(p).toMatchObject({ etat: 'terminee', gagnantId: gon.id });
    expect(p!.classementFinal![0]).toMatchObject({ pseudo: 'Gon', place: 1, cartes: 30 });
    expect(recues.some((e) => e.a === 'tracker' && e.evenement === 'clear')).toBe(true);
  });

  it('RG-13.3 : le gagnant choisit 3 cartes désignées distinctes = lots réels', async () => {
    expect((await post('/clear/recompenses', gon.token, { itemIds: [items[0], items[0], items[1]] })).json()).toMatchObject({ ok: false, message: 'Choisis 3 cartes différentes' });
    const res = await post('/clear/recompenses', gon.token, { itemIds: items.slice(0, 3) });
    expect(res.json().lots[0]).toEqual({ carte: 'Le bonheur du détenteur', lotReel: 'Lot n°1' });
    expect((await post('/clear/recompenses', gon.token, { itemIds: items.slice(3, 6) })).json().code).toBe('deja_choisi');
  });

  it('RG-13.3 / page ⑰ : le gagnant lit les lots réels de ses cartes désignées et ses lots choisis ; les autres, le gagnant', async () => {
    const v = await get(gon.token);
    expect(v).toMatchObject({ etat: 'gagne', gagnant: 'Gon' });
    expect(v.lots).toHaveLength(30);
    type L = { itemId: string; carteId: string; lotReel: string | null };
    expect(v.lots.find((l: L) => l.itemId === items[0])).toMatchObject({ nom: 'Le bonheur du détenteur', lotReel: 'Lot n°1' });
    expect(v.lots.find((l: L) => l.itemId === items[1]).lotReel).toBeNull();
    expect(v.recompenses.map((r: L) => r.carteId)).toEqual(t.carteIds.slice(0, 3));
    expect(v.recompenses[0]).toMatchObject({ nom: 'Le bonheur du détenteur', lotReel: 'Lot n°1' });
    expect(await get(kirua.token)).toEqual({ ok: true, etat: 'autre', gagnant: 'Gon' });
  });
});
