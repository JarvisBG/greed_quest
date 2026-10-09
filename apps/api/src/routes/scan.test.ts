import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { balises, exemplaires, joueurs, journal, sorts } from '../db/schema.js';
import { CENTRE, testApp } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
let gon: { token: string; id: string };
let actives: string[];
const ici = { ...CENTRE, precisionM: 5 };

beforeAll(async () => {
  t = await testApp();
  // J = 18 : cible de 6 balises actives (RG-14).
  await t.setEtat('en_cours', { inscriptionsOuvertes: true, demarreeA: t.clock.t, j: { value: 18, lastDecreaseAt: null } });
  gon = await t.inscrire('Gon');
  // 6 balises actives (une par zone), stock 5.
  actives = t.baliseIds.slice(0, 6);
  await t.db.update(balises).set({ etat: 'active', type: 'standard', stock: 5 }).where(inArray(balises.id, actives));
});
afterAll(() => t.close());

const scan = (token: string, baliseId: string, extra: Record<string, unknown> = {}) =>
  t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/scan`, headers: t.bearer(token), payload: { baliseId, position: ici, ...extra } });
const attendre = (ms: number) => {
  t.clock.t += ms;
};

describe('RG-7 scan de balise', () => {
  it('scan réussi : tirage, stock décrémenté, gain dans le Livre, journal', async () => {
    const [avant] = await t.db.select().from(joueurs).where(eq(joueurs.id, gon.id));
    const res = await scan(gon.token, actives[0]!);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.gains).toHaveLength(1);
    const [b] = await t.db.select().from(balises).where(eq(balises.id, actives[0]!));
    expect(b?.stock).toBe(4);
    const cartes = await t.db.select().from(exemplaires).where(eq(exemplaires.joueurId, gon.id));
    const sortsJ = await t.db.select().from(sorts).where(eq(sorts.joueurId, gon.id));
    const gain = body.gains[0];
    if (gain.kind === 'carte') expect(cartes).toHaveLength(1);
    if (gain.kind === 'sort') expect(sortsJ).toHaveLength(2);
    if (gain.kind === 'jenny') expect(body.jenny).toBe(avant!.jenny + gain.montant);
    const [l] = await t.db.select().from(journal).where(eq(journal.action, 'scan'));
    expect(l).toMatchObject({ acteurId: gon.id, resultat: 'ok' });
  });

  it('RG-7.3 : 30 s entre deux scans, motif en clair (RG-7.4)', async () => {
    attendre(10_000);
    const res = await scan(gon.token, actives[1]!);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ ok: false, code: 'delai', message: 'Attends encore 20 s avant de scanner' });
  });

  it('RG-7.1 : boucle, revenir sur la même balise est refusé', async () => {
    attendre(30_000);
    const res = await scan(gon.token, actives[0]!);
    expect(res.json()).toMatchObject({ code: 'boucle', message: 'Boucle : scanne encore 2 balises différentes' });
  });

  it('RG-6 : balise dormante', async () => {
    const res = await scan(gon.token, t.baliseIds[10]!);
    expect(res.json()).toMatchObject({ code: 'balise_dormante', message: 'Cette balise dort' });
  });

  it('QR inconnu', async () => {
    expect((await scan(gon.token, 'nimporte-quoi')).json()).toMatchObject({ code: 'balise_inconnue' });
  });

  it('RG-7.6 : position trop imprécise', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: `/parties/${t.partieId}/scan`,
      headers: t.bearer(gon.token),
      payload: { baliseId: actives[1], position: { ...CENTRE, precisionM: 500 } },
    });
    expect(res.json()).toMatchObject({ code: 'gps_invalide' });
  });

  it('RG-7.5 : scan hors ligne de plus de 10 min ignoré', async () => {
    const res = await scan(gon.token, actives[1]!, { scanneA: t.clock.t - 11 * 60_000 });
    expect(res.json()).toMatchObject({ code: 'scan_perime' });
  });

  it('RG-7.5 : scan hors ligne récent traité', async () => {
    const res = await scan(gon.token, actives[1]!, { scanneA: t.clock.t - 60_000 });
    expect(res.json().ok).toBe(true);
  });

  it('RG-6.3 : balise épuisée → une dormante d’une autre zone est activée', async () => {
    const kirua = await t.inscrire('Kirua');
    await t.db.update(balises).set({ stock: 1 }).where(eq(balises.id, actives[2]!));
    const res = await scan(kirua.token, actives[2]!);
    expect(res.json().ok).toBe(true);
    const all = await t.db.select().from(balises).where(eq(balises.partieId, t.partieId));
    const epuisee = all.find((b) => b.id === actives[2]);
    expect(epuisee).toMatchObject({ etat: 'epuisee', stock: 0 });
    const nouvelles = all.filter((b) => b.etat === 'active' && !actives.includes(b.id));
    expect(nouvelles).toHaveLength(1);
    expect(nouvelles[0]!.zoneId).not.toBe(epuisee!.zoneId);
  });

  it('RG-15 : même balise scannée à < 10 s par deux joueurs éloignés de > 200 m → alerte', async () => {
    const a = await t.inscrire('Leorio');
    const b = await t.inscrire('Kurapika');
    await scan(a.token, actives[3]!);
    attendre(3_000);
    await t.app.inject({
      method: 'POST',
      url: `/parties/${t.partieId}/scan`,
      headers: t.bearer(b.token),
      payload: { baliseId: actives[3], position: { lat: CENTRE.lat + 0.005, lng: CENTRE.lng, precisionM: 5 } },
    });
    const alertes = await t.db.select().from(journal).where(eq(journal.resultat, 'photo_partagee'));
    expect(alertes).toHaveLength(1);
  });
});
