import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SYSTEME } from '../core/journal.js';
import { tickPartie } from '../core/taches.js';
import { CENTRE, testApp } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
let gm: string;
let pnj: string;
type J = { token: string; id: string };
let gon: J;
const MIN = 60_000;

beforeAll(async () => {
  t = await testApp();
  gm = t.app.gq.tokens.issue({ role: 'gm', sub: 'gm1', partieId: t.partieId });
  pnj = t.app.gq.tokens.issue({ role: 'pnj', sub: 'pnj1', partieId: t.partieId });
  await t.setEtat('en_cours', { inscriptionsOuvertes: true, demarreeA: t.clock.t });
  gon = await t.inscrire('Gon');
  await t.inscrire('Kirua');
  await t.app.gq.runner.run(t.partieId, SYSTEME, (c) => tickPartie(c)); // balises activées
});
afterAll(() => t.close());

const get = (url: string, token?: string) => t.app.inject({ url: `/parties/${t.partieId}${url}`, ...(token ? { headers: t.bearer(token) } : {}) });

describe('Écran géant : état à l’ouverture (GET /ecran, public)', () => {
  it('classement live, balises actives par zone, évènements, fil rejoué', async () => {
    await t.app.gq.runner.run(t.partieId, SYSTEME, async (c) => {
      c.emit({ type: 'tracker' }, 'fil', { type: 'tirage', pseudo: 'Gon', carte: "Le dragon qui s'emballe", rang: 'A', heureJeu: c.now });
    });
    const res = await get('/ecran');
    expect(res.statusCode).toBe(200);
    const e = res.json();
    expect(e.partie).toMatchObject({ etat: 'en_cours', zones: expect.any(Array) });
    // Contours des zones, pour que l'écran les dessine.
    expect(e.partie.zones[0]).toMatchObject({ nom: expect.any(String), polygone: expect.arrayContaining([expect.objectContaining({ lat: expect.any(Number) })]) });
    expect(e.classement.map((l: { pseudo: string }) => l.pseudo).sort()).toEqual(['Gon', 'Kirua']);
    expect(Object.values(e.balisesParZone as Record<string, number>).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(e.fil).toEqual([expect.objectContaining({ type: 'tirage', carte: "Le dragon qui s'emballe" })]);
    expect(e.clear).toBeNull();
  });

  it('RG-10.12 : heatmap anonyme, arrondie, décalée de 2 min ; aucune position exacte', async () => {
    const pos = { lat: CENTRE.lat + 0.000123, lng: CENTRE.lng, precisionM: 5 };
    await t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/position`, headers: t.bearer(gon.token), payload: pos });
    expect((await get('/ecran')).json().heatmap).toEqual([]); // trop récente
    t.clock.t += 3 * MIN;
    const e = (await get('/ecran')).json();
    expect(e.heatmap).toContainEqual({ lat: Number(pos.lat.toFixed(4)), lng: Number(pos.lng.toFixed(4)) });
    const brut = JSON.stringify(e);
    expect(brut).not.toContain('precisionM');
    expect(brut).not.toContain(gon.id);
    expect(brut).not.toContain(String(pos.lat));
  });
});

describe('Carte de l’île du joueur (GET /carte)', () => {
  it('RG-6.5 : contours des zones et nombre de balises actives par zone, jamais lesquelles ; RG-10.12 : aucune position', async () => {
    const res = await get('/carte', gon.token);
    expect(res.statusCode).toBe(200);
    const c = res.json();
    expect(c.zones.length).toBeGreaterThan(0);
    expect(c.zones[0]).toMatchObject({ id: expect.any(String), nom: expect.any(String), type: expect.any(String), polygone: expect.any(Array) });
    expect(Object.values(c.balisesParZone as Record<string, number>).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(Object.keys(c)).toEqual(['ok', 'zones', 'balisesParZone']);
    const balises = await t.app.gq.runner.run(t.partieId, SYSTEME, async (x) => (await import('../core/state.js')).loadBeacons(x.tx, t.partieId));
    const brut = JSON.stringify(c);
    for (const b of balises) expect(brut).not.toContain(b.id);
    expect(brut).not.toContain(gon.id);
  });
});

describe('Console GM : positions et équipe', () => {
  it('RG-10.12 : positions exactes pour le GM seulement', async () => {
    const res = await get('/positions', gm);
    expect(res.json().positions).toContainEqual(expect.objectContaining({ joueurId: gon.id, pseudo: 'Gon', precisionM: 5 }));
    expect((await get('/positions', pnj)).statusCode).toBe(403);
    expect((await get('/positions', gon.token)).statusCode).toBe(403);
  });

  it('RG-3.2 : le GM voit l’équipe, sans les codes', async () => {
    await t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/staff`, headers: t.bearer(gm), payload: { nom: 'Arbitre 1', role: 'pnj', code: 'pnj-code' } });
    const res = await get('/staff', gm);
    expect(res.json().equipe).toContainEqual(expect.objectContaining({ nom: 'Arbitre 1', role: 'pnj' }));
    expect(JSON.stringify(res.json())).not.toContain('code');
    expect((await get('/staff', pnj)).statusCode).toBe(403);
  });
});
