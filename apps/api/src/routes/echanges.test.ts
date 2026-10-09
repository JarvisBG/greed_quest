import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exemplaires, joueurs, zones } from '../db/schema.js';
import { newId } from '../ids.js';
import { CENTRE, testApp } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
type J = { token: string; id: string };
let gon: J, kirua: J, leorio: J, hisoka: J;
let carteGon: string;
const ici = { ...CENTRE, precisionM: 5 };
const loin = { lat: CENTRE.lat + 0.005, lng: CENTRE.lng, precisionM: 5 };
const recues: { a: string; evenement: string; data: any }[] = [];

beforeAll(async () => {
  t = await testApp();
  await t.setEtat('en_cours', { inscriptionsOuvertes: true, demarreeA: t.clock.t });
  t.app.gq.bus.on((e) => recues.push({ a: e.a.type === 'joueur' ? e.a.id : e.a.type, evenement: e.evenement, data: e.data }));
  gon = await t.inscrire('Gon');
  kirua = await t.inscrire('Kirua');
  leorio = await t.inscrire('Leorio');
  hisoka = await t.inscrire('Hisoka', loin);
  carteGon = newId();
  await t.db.insert(exemplaires).values({ id: carteGon, partieId: t.partieId, joueurId: gon.id, carteId: t.carteIds[2]!, origine: { type: 'kit' }, obtenuA: 0 });
});
afterAll(() => t.close());

const post = (j: J, url: string, payload: Record<string, unknown> = {}) =>
  t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/${url}`, headers: t.bearer(j.token), payload });
const proposer = (de: J, a: J) => post(de, 'echanges', { cibleId: a.id, position: ici });

describe('RG-11.1 amendé : échange à la Pokémon', () => {
  let sessionId: string;

  it('hors de portée : refusé', async () => {
    expect((await proposer(gon, hisoka)).json()).toMatchObject({ ok: false, code: 'hors_portee' });
  });

  it('proposition : l’invité est notifié', async () => {
    const res = await proposer(gon, kirua);
    sessionId = res.json().sessionId;
    expect(res.json().ok).toBe(true);
    const notif = recues.find((e) => e.a === kirua.id && e.evenement === 'echange');
    expect(notif?.data).toMatchObject({ etat: 'invitation', invite: true, avec: { pseudo: 'Gon' } });
  });

  it('une seule session active par joueur', async () => {
    expect((await proposer(leorio, kirua)).json()).toMatchObject({ ok: false, code: 'session_en_cours' });
  });

  it('seul l’invité répond ; il accepte', async () => {
    expect((await post(gon, `echanges/${sessionId}/reponse`, { accepte: true })).json()).toMatchObject({ ok: false, code: 'pas_participant' });
    expect((await post(kirua, `echanges/${sessionId}/reponse`, { accepte: true })).json().echange.etat).toBe('composition');
  });

  it('RG-11.2 : don pur refusé à la validation', async () => {
    await post(gon, `echanges/${sessionId}/offre`, { itemIds: [carteGon], jenny: 0 });
    expect((await post(gon, `echanges/${sessionId}/valider`)).json()).toMatchObject({ ok: false, code: 'don_pur' });
  });

  it('carte engagée : verrouillée pour la revente', async () => {
    const [z] = (await t.db.select().from(zones).where(eq(zones.partieId, t.partieId))).filter((x) => x.type === 'masadora');
    const res = await post(gon, 'boutique/revente', { qr: z!.qr, itemId: carteGon, position: ici });
    expect(res.json()).toMatchObject({ ok: false, code: 'carte_engagee' });
  });

  it('chacun voit la part de l’autre ; modifier sa part annule les validations', async () => {
    const res = await post(kirua, `echanges/${sessionId}/offre`, { itemIds: [], jenny: 10 });
    expect(res.json().echange.sonPart.cartes[0]).toMatchObject({ itemId: carteGon, nom: 'Épée des Sept Vents', rang: 'S' });
    await post(gon, `echanges/${sessionId}/valider`);
    const modif = await post(kirua, `echanges/${sessionId}/offre`, { itemIds: [], jenny: 20 });
    expect(modif.json().echange).toMatchObject({ jeValide: false, ilValide: false });
  });

  it('double validation : échange atomique, carte et jenny changent de main', async () => {
    expect((await post(gon, `echanges/${sessionId}/valider`)).json().echange.etat).toBe('composition');
    const res = await post(kirua, `echanges/${sessionId}/valider`);
    expect(res.json()).toMatchObject({ ok: true, conclu: true, echange: { etat: 'conclu' } });
    const [ex] = await t.db.select().from(exemplaires).where(eq(exemplaires.id, carteGon));
    expect(ex).toMatchObject({ joueurId: kirua.id, origine: { type: 'echange', avec: gon.id } });
    const [g] = await t.db.select().from(joueurs).where(eq(joueurs.id, gon.id));
    const [k] = await t.db.select().from(joueurs).where(eq(joueurs.id, kirua.id));
    expect(g!.jenny - k!.jenny).toBe(40); // 50 + 20 contre 50 - 20
    // Carte de rang S : affichée sur l'écran géant.
    expect(recues.some((e) => e.a === 'tracker' && e.data.type === 'echange')).toBe(true);
  });

  it('RG-11.3 : une même paire, un échange toutes les 10 min', async () => {
    expect((await proposer(kirua, gon)).json()).toMatchObject({ ok: false, code: 'frequence_paire' });
  });

  it('expiration : invitation sans réponse au bout de 60 s', async () => {
    const res = await proposer(leorio, gon);
    t.clock.t += 61_000;
    const rep = await post(gon, `echanges/${res.json().sessionId}/reponse`, { accepte: true });
    expect(rep.json()).toMatchObject({ ok: false, message: 'Échange expiré' });
  });
});
