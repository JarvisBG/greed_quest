import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exemplaires, joueurs, sorts, zones } from '../db/schema.js';
import { newId } from '../ids.js';
import { CENTRE, testApp } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
let gon: { token: string; id: string };
let qrMasadora: string;
let qrAntokiba: string;
const ici = { ...CENTRE, precisionM: 5 };

beforeAll(async () => {
  t = await testApp();
  // J = 2 : 1 paquet par vague (RG-9.3, ceil(J/2)).
  await t.setEtat('en_cours', { inscriptionsOuvertes: true, demarreeA: t.clock.t, j: { value: 2, lastDecreaseAt: null } });
  gon = await t.inscrire('Gon');
  await t.db.update(joueurs).set({ jenny: 200 }).where(eq(joueurs.id, gon.id));
  const zs = await t.db.select().from(zones).where(eq(zones.partieId, t.partieId));
  qrMasadora = zs.find((z) => z.type === 'masadora')!.qr!;
  qrAntokiba = zs.find((z) => z.type === 'antokiba')!.qr!;
});
afterAll(() => t.close());

const post = (url: string, payload: Record<string, unknown>) =>
  t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/boutique/${url}`, headers: t.bearer(gon.token), payload: { position: ici, ...payload } });

describe('RG-9 boutique de Masadora', () => {
  it('RG-9.2 : il faut scanner le QR de la boutique', async () => {
    expect((await post('achat', { qr: qrAntokiba })).json()).toMatchObject({ ok: false, code: 'pas_sur_place' });
  });

  it('RG-9.2 : paquet de 3 sorts à 50 J', async () => {
    const res = await post('achat', { qr: qrMasadora });
    expect(res.json()).toMatchObject({ ok: true, prix: 50, jenny: 150 });
    expect(res.json().sorts).toHaveLength(3);
    expect(await t.db.select().from(sorts).where(and(eq(sorts.joueurId, gon.id), eq(sorts.utilise, false)))).toHaveLength(4);
  });

  it('RG-9.3 : stock de la vague épuisé, puis nouvelle vague 20 min plus tard', async () => {
    expect((await post('achat', { qr: qrMasadora })).json()).toMatchObject({ ok: false, code: 'stock_epuise' });
    t.clock.t += 20 * 60_000;
    expect((await post('achat', { qr: qrMasadora })).json()).toMatchObject({ ok: true });
  });

  it('RG-9.4 : revente d’une carte D à 5 J, l’exemplaire sort du jeu', async () => {
    const id = newId();
    await t.db.insert(exemplaires).values({ id, partieId: t.partieId, joueurId: gon.id, carteId: t.carteIds[29]!, origine: { type: 'kit' }, obtenuA: 0 });
    const avant = (await t.db.select().from(joueurs).where(eq(joueurs.id, gon.id)))[0]!.jenny;
    const res = await post('revente', { qr: qrMasadora, itemId: id });
    expect(res.json()).toMatchObject({ ok: true, prix: 5, contrefacon: null, jenny: avant + 5 });
    expect(await t.db.select().from(exemplaires).where(eq(exemplaires.id, id))).toEqual([]);
  });

  it('RG-8.9 : Masadora révèle une copie de Duplication (1 J)', async () => {
    const id = newId();
    await t.db.insert(exemplaires).values({
      id,
      partieId: t.partieId,
      joueurId: gon.id,
      carteId: t.carteIds[10]!,
      origine: { type: 'echange', avec: 'x' },
      obtenuA: 0,
      faux: { nature: 'copie' },
    });
    expect((await post('revente', { qr: qrMasadora, itemId: id })).json()).toMatchObject({ ok: true, prix: 1, contrefacon: 'copie' });
  });

  it('RG-9.4 : les SS ne se revendent pas', async () => {
    const id = newId();
    await t.db.insert(exemplaires).values({ id, partieId: t.partieId, joueurId: gon.id, carteId: t.carteIds[0]!, origine: { type: 'kit' }, obtenuA: 0 });
    expect((await post('revente', { qr: qrMasadora, itemId: id })).json()).toMatchObject({ ok: false, code: 'revente_interdite' });
  });
});
