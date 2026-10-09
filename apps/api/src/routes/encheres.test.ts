import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exemplaires, joueurs, zones } from '../db/schema.js';
import { CENTRE, testApp } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
type J = { token: string; id: string };
let gon: J, kirua: J, leorio: J;
let pnj: string;
let qr: string;
const ici = { ...CENTRE, precisionM: 5 };

beforeAll(async () => {
  t = await testApp();
  await t.setEtat('en_cours', { inscriptionsOuvertes: true, demarreeA: t.clock.t });
  gon = await t.inscrire('Gon');
  kirua = await t.inscrire('Kirua');
  leorio = await t.inscrire('Leorio');
  pnj = t.app.gq.tokens.issue({ role: 'pnj', sub: 'pnj1', partieId: t.partieId });
  qr = (await t.db.select().from(zones).where(and(eq(zones.partieId, t.partieId), eq(zones.type, 'antokiba'))))[0]!.qr!;
});
afterAll(() => t.close());

const post = (token: string, url: string, payload: Record<string, unknown> = {}) =>
  t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/${url}`, headers: t.bearer(token), payload });

describe('RG-11.4 / 11.5 enchères d’Antokiba', () => {
  let id: string;

  it('le PNJ met une carte en vente ; un joueur ne peut pas', async () => {
    expect((await post(gon.token, 'encheres', { carteId: t.carteIds[5] })).statusCode).toBe(403);
    const res = await post(pnj, 'encheres', { carteId: t.carteIds[5], prixDepart: 10 });
    id = res.json().enchere.id;
    expect(res.json().enchere).toMatchObject({ carte: { nom: 'Boussole céleste', rang: 'A' }, prixDepart: 10, meilleureOffre: null });
  });

  it('RG-11.4 : surenchérir exige d’avoir scanné le QR de l’enchère', async () => {
    expect((await post(gon.token, `encheres/${id}/offre`, { montant: 10 })).json()).toMatchObject({ ok: false, code: 'non_inscrit' });
    expect((await post(gon.token, `encheres/${id}/rejoindre`, { qr: 'faux', position: ici })).json()).toMatchObject({ ok: false, code: 'non_inscrit' });
    expect((await post(gon.token, `encheres/${id}/rejoindre`, { qr, position: ici })).json().ok).toBe(true);
    expect((await post(kirua.token, `encheres/${id}/rejoindre`, { qr, position: ici })).json().ok).toBe(true);
  });

  it('surenchère d’au moins 1 J, dans la limite de ses jenny', async () => {
    expect((await post(gon.token, `encheres/${id}/offre`, { montant: 9 })).json()).toMatchObject({ code: 'offre_trop_basse' });
    expect((await post(gon.token, `encheres/${id}/offre`, { montant: 20 })).json().ok).toBe(true);
    expect((await post(kirua.token, `encheres/${id}/offre`, { montant: 20 })).json()).toMatchObject({ code: 'offre_trop_basse', message: 'Offre minimale : 21 J' });
    expect((await post(kirua.token, `encheres/${id}/offre`, { montant: 999 })).json()).toMatchObject({ code: 'jenny_insuffisants' });
    const res = await post(kirua.token, `encheres/${id}/offre`, { montant: 30 });
    expect(res.json().enchere.meilleureOffre).toEqual({ montant: 30, pseudo: 'Kirua' });
  });

  it('RG-11.4 : à la clôture seul le gagnant est débité et reçoit la carte', async () => {
    t.clock.t += 3 * 60_000;
    expect((await post(kirua.token, `encheres/${id}/offre`, { montant: 40 })).json()).toMatchObject({ code: 'terminee' });
    await post(pnj, 'encheres/cloturer');
    const [k] = await t.db.select().from(joueurs).where(eq(joueurs.id, kirua.id));
    const [g] = await t.db.select().from(joueurs).where(eq(joueurs.id, gon.id));
    expect(k!.jenny).toBe(20);
    expect(g!.jenny).toBe(50);
    const cartes = await t.db.select().from(exemplaires).where(eq(exemplaires.joueurId, kirua.id));
    expect(cartes).toMatchObject([{ carteId: t.carteIds[5], origine: { type: 'enchere', enchereId: id } }]);
  });

  it('RG-11.5 : sans offre, la carte retourne au PNJ', async () => {
    const res = await post(pnj, 'encheres', { carteId: t.carteIds[6] });
    t.clock.t += 3 * 60_000;
    await post(pnj, 'encheres/cloturer');
    const list = await t.app.inject({ url: `/parties/${t.partieId}/encheres`, headers: t.bearer(leorio.token) });
    expect(list.json().encheres).toEqual([]);
    expect(res.json().ok).toBe(true);
  });
});
