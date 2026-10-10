import type { ObjetType } from '@gq/shared';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { balises, exemplaires, joueurs, objets, sorts, zones } from '../db/schema.js';
import { newId } from '../ids.js';
import { CENTRE, testApp } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
type J = { token: string; id: string };
let gon: J, kirua: J;
let gm: string;
let actives: string[];
const ici = { ...CENTRE, precisionM: 5 };

beforeAll(async () => {
  t = await testApp();
  await t.setEtat('en_cours', { inscriptionsOuvertes: true, demarreeA: t.clock.t, j: { value: 18, lastDecreaseAt: null } });
  gon = await t.inscrire('Gon');
  kirua = await t.inscrire('Kirua');
  gm = t.app.gq.tokens.issue({ role: 'gm', sub: 'gm1', partieId: t.partieId });
  await t.db.delete(sorts); // kits retirés
  actives = t.baliseIds.slice(0, 6);
  await t.db.update(balises).set({ etat: 'active', type: 'standard', stock: 5 }).where(inArray(balises.id, actives));
});
afterAll(() => t.close());

const post = (j: J, url: string, payload: Record<string, unknown>) =>
  t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/${url}`, headers: t.bearer(j.token), payload });
const scan = (j: J, baliseId: string, extra: Record<string, unknown> = {}) => post(j, 'scan', { baliseId, position: ici, ...extra });
const parametre = (cle: string, value: number) =>
  t.app.inject({ method: 'PUT', url: `/parties/${t.partieId}/parametres`, headers: t.bearer(gm), payload: { cle, reglage: { mode: 'verrouille', value } } });
async function donnerObjet(joueurId: string, type: ObjetType) {
  const id = newId();
  await t.db.insert(objets).values({ id, partieId: t.partieId, joueurId, type, obtenuA: 0 });
  return id;
}
const utilise = async (id: string) => (await t.db.select().from(objets).where(eq(objets.id, id)))[0]?.utilise;
const jennyDe = async (id: string) => (await t.db.select().from(joueurs).where(eq(joueurs.id, id)))[0]!.jenny;

describe('Amendement 2026-10-10 : cartes objets', () => {
  it('repli « carte épuisée » : un objet en plus des 10 J ; le Book a sa section des objets', async () => {
    // Limites à 0 : chaque tirage de carte se replie en jenny ; 100 % des replis donnent un objet.
    for (const cle of ['limiteSS', 'limiteS', 'limiteA', 'limiteB', 'limiteCD']) expect((await parametre(cle, 0)).statusCode).toBe(200);
    expect((await parametre('objetsReplisPct', 100)).statusCode).toBe(200);
    const recus: { kind: string; objet?: string }[] = [];
    for (const b of actives) {
      const r = await scan(gon, b);
      expect(r.json().ok).toBe(true);
      recus.push(...r.json().gains);
      t.clock.t += 31_000;
    }
    const nbObjets = recus.filter((g) => g.kind === 'objet').length;
    expect(nbObjets).toBeGreaterThan(0);
    // Chaque objet accompagne un repli en jenny.
    expect(recus.filter((g) => g.kind === 'jenny').length).toBeGreaterThanOrEqual(nbObjets);
    const livre = (await t.app.inject({ url: `/parties/${t.partieId}/livre`, headers: t.bearer(gon.token) })).json();
    expect(livre.objets).toHaveLength(nbObjets);
    expect(livre.placesObjets).toBe(8);
    // Les objets ne prennent pas les places libres : seuls les sorts tirés y sont.
    expect(livre.libresUtilises).toBe(recus.filter((g) => g.kind === 'sort').length);
    expect((await parametre('objetsReplisPct', 0)).statusCode).toBe(200);
  });

  it('Second souffle : consommé seulement quand la boucle refuserait le scan (RG-7.1)', async () => {
    await t.db.delete(objets).where(eq(objets.joueurId, gon.id));
    t.clock.t += 31_000;
    // Sans Second souffle : boucle.
    expect((await scan(gon, actives[5]!, { secondSouffle: true })).json()).toMatchObject({ ok: false, code: 'boucle' });
    const souffle = await donnerObjet(gon.id, 'souffle');
    const r = await scan(gon, actives[5]!, { secondSouffle: true });
    expect(r.json()).toMatchObject({ ok: true, secondSouffle: true });
    expect(await utilise(souffle)).toBe(true);
  });

  it('Ticket de la Fortune : gratté, il rapporte des jenny et disparaît', async () => {
    const ticket = await donnerObjet(gon.id, 'ticket');
    const avant = await jennyDe(gon.id);
    const r = await post(gon, 'objet', { objet: 'ticket', itemId: ticket });
    expect(r.json()).toMatchObject({ ok: true, nom: 'Ticket de la Fortune' });
    expect([0, 10, 30, 100]).toContain(r.json().gain);
    expect(await jennyDe(gon.id)).toBe(avant + r.json().gain);
    expect(await utilise(ticket)).toBe(true);
    expect((await post(gon, 'objet', { objet: 'ticket', itemId: ticket })).json()).toMatchObject({ ok: false, code: 'objet_absent' });
  });

  it('Boussole du chercheur : une direction, jamais une distance ni une position (RG-10.12)', async () => {
    const boussole = await donnerObjet(gon.id, 'boussole');
    // Aucune balise posée avec sa position : refus, la Boussole reste.
    await t.db.update(balises).set({ position: null });
    expect((await post(gon, 'objet', { objet: 'boussole', itemId: boussole, position: ici })).json()).toMatchObject({ ok: false, code: 'aucune_balise' });
    expect(await utilise(boussole)).toBe(false);
    // Une balise active jamais scannée, au nord.
    const nouvelle = t.baliseIds[7]!;
    await t.db.update(balises).set({ etat: 'active', type: 'standard', stock: 5, position: { lat: CENTRE.lat + 0.002, lng: CENTRE.lng } }).where(eq(balises.id, nouvelle));
    const r = await post(gon, 'objet', { objet: 'boussole', itemId: boussole, position: ici });
    expect(r.json()).toMatchObject({ ok: true, direction: 'N', message: 'L’aiguille pointe vers le nord' });
    expect(Object.keys(r.json()).sort()).toEqual(['direction', 'jenny', 'message', 'nom', 'objet', 'ok']);
    expect(await utilise(boussole)).toBe(true);
  });

  it('Coffre scellé : la carte protégée ne peut pas être volée pendant 20 min', async () => {
    const carte = newId();
    await t.db.insert(exemplaires).values({ id: carte, partieId: t.partieId, joueurId: kirua.id, carteId: t.carteIds[29]!, origine: { type: 'kit' }, obtenuA: 0 });
    const coffre = await donnerObjet(kirua.id, 'coffre');
    expect((await post(kirua, 'objet', { objet: 'coffre', itemId: coffre, carteItemId: carte })).json()).toMatchObject({ ok: true });
    const livre = (await t.app.inject({ url: `/parties/${t.partieId}/livre`, headers: t.bearer(kirua.token) })).json();
    const vue = livre.pages.flat().find((s: { itemId?: string }) => s.itemId === carte);
    expect(vue.coffreJusqua).toMatch(/h/);
    const vol = newId();
    await t.db.insert(sorts).values({ id: vol, partieId: t.partieId, joueurId: gon.id, type: 'vol', obtenuA: 0 });
    const r = await post(gon, 'sort', { sort: 'vol', source: { type: 'carte', itemId: vol }, cibleId: kirua.id, position: ici });
    expect(r.json()).toMatchObject({ ok: true, resultat: 'sans_effet' });
    expect((await t.db.select().from(exemplaires).where(eq(exemplaires.id, carte)))[0]?.joueurId).toBe(kirua.id);
  });

  it('Voile d’ombre : le prochain Radar sur son porteur est bloqué, le voile est consommé', async () => {
    const voile = await donnerObjet(kirua.id, 'voile');
    const radar = newId();
    await t.db.insert(sorts).values({ id: radar, partieId: t.partieId, joueurId: gon.id, type: 'radar', obtenuA: 0 });
    const r = await post(gon, 'sort', { sort: 'radar', itemId: radar, cibleId: kirua.id, position: ici });
    expect(r.json()).toMatchObject({ ok: true, resultat: 'bloque', zone: null, protection: 'voile' });
    expect(await utilise(voile)).toBe(true);
    expect((await t.db.select().from(sorts).where(eq(sorts.id, radar)))[0]?.utilise).toBe(true);
  });

  it('revente à Masadora : Pépite d’or 30 J ; le Ticket ne se revend pas', async () => {
    const zs = await t.db.select().from(zones).where(eq(zones.partieId, t.partieId));
    const qr = zs.find((z) => z.type === 'masadora')!.qr!;
    const pepite = await donnerObjet(gon.id, 'pepite');
    const avant = await jennyDe(gon.id);
    expect((await post(gon, 'boutique/revente', { qr, itemId: pepite, position: ici })).json()).toMatchObject({ ok: true, prix: 30 });
    expect(await jennyDe(gon.id)).toBe(avant + 30);
    const ticket = await donnerObjet(gon.id, 'ticket');
    expect((await post(gon, 'boutique/revente', { qr, itemId: ticket, position: ici })).json()).toMatchObject({ ok: false, code: 'revente_interdite' });
  });
});
