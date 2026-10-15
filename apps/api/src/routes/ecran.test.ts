import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HALO_DECALAGE_M } from '../core/ecran.js';
import { SYSTEME } from '../core/journal.js';
import { balises } from '../db/schema.js';
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

describe('Écran géant : balises en halos (amendement RG-6.5 du 2026-10-15)', () => {
  const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
    Math.hypot((a.lat - b.lat) * 111_320, (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180));
  const posees = async () => (await t.db.select().from(balises).where(eq(balises.partieId, t.partieId))).map((b) => b.position!).filter(Boolean);

  it('RG-6.5 : un halo par balise posée, décalé de 8 à 32 m, jamais la vraie place ni l’identifiant', async () => {
    const vraies = await posees();
    const e = (await get('/ecran')).json();
    expect(e.halos).toHaveLength(vraies.length);
    for (const h of e.halos as { lat: number; lng: number }[]) {
      // La balise la plus proche peut être une voisine : au moins un peu décalé, jamais plus loin que le décalage maximal.
      const d = Math.min(...vraies.map((v) => metres(h, v)));
      expect(d).toBeGreaterThan(1);
      expect(d).toBeLessThan(HALO_DECALAGE_M.max + 1);
      expect(Object.keys(h)).toEqual(['lat', 'lng']);
    }
    const brut = JSON.stringify(e);
    for (const v of vraies) expect(brut).not.toContain(String(v.lat));
    for (const b of await t.db.select({ id: balises.id }).from(balises)) expect(brut).not.toContain(b.id);
    expect(e.balisesRevelees).toEqual([]);
  });

  it('RG-6.5 : les halos restent en place jusqu’à la rotation, puis changent (et l’écran les reçoit)', async () => {
    const avant = (await get('/ecran')).json().halos;
    expect((await get('/ecran')).json().halos).toEqual(avant);
    const recues: { evenement: string; data: unknown }[] = [];
    const off = t.app.gq.bus.on((x) => x.a.type === 'tracker' && recues.push({ evenement: x.evenement, data: x.data }));
    t.clock.t += 21 * MIN;
    await t.app.gq.runner.run(t.partieId, SYSTEME, (c) => tickPartie(c));
    off();
    const apres = (await get('/ecran')).json().halos;
    expect(apres).not.toEqual(avant);
    expect(recues.find((r) => r.evenement === 'halos')?.data).toEqual(apres);
  });

  it('RG-6.5 / RG-10.12 : un scan allume sa zone sur l’écran, avec 2 min de retard', async () => {
    const [b] = await t.db.select().from(balises).where(and(eq(balises.partieId, t.partieId), eq(balises.etat, 'active')));
    const recues: { evenement: string; data: unknown }[] = [];
    const off = t.app.gq.bus.on((x) => x.a.type === 'tracker' && recues.push({ evenement: x.evenement, data: x.data }));
    t.clock.t += 61_000; // délai entre deux scans
    const res = await t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/scan`, headers: t.bearer(gon.token), payload: { baliseId: b!.id, position: { ...CENTRE, precisionM: 5 } } });
    expect(res.json()).toMatchObject({ ok: true });
    const tick = () => t.app.gq.runner.run(t.partieId, SYSTEME, (c) => tickPartie(c));
    t.clock.t += 31_000;
    await tick();
    expect(recues.filter((r) => r.evenement === 'scans_zones')).toEqual([]); // trop tôt
    t.clock.t += 150_000;
    await tick();
    off();
    expect(recues.filter((r) => r.evenement === 'scans_zones').flatMap((r) => r.data as string[])).toEqual([b!.zoneId]);
  });

  it('accueil : cartes rares à gagner, nombre de cartes du Book, derniers Hunters entrés', async () => {
    const e = (await get('/ecran')).json();
    expect(e.nCartes).toBe(30);
    expect(e.vitrine.length).toBeGreaterThan(0);
    for (const k of e.vitrine) expect(['SS', 'S', 'A']).toContain(k.rang);
    expect(e.vitrine[0]).toMatchObject({ numero: expect.any(Number), nom: expect.any(String), limite: expect.any(Number) });
    expect(e.arrivants).toEqual(['Kirua', 'Gon']); // le dernier entré d'abord
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
