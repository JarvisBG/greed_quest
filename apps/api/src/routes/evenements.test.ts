import { RAID_QUESTIONS } from '@gq/engine';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { balises, evenements, exemplaires, joueurs, parties, sorts, zones } from '../db/schema.js';
import { testApp } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
let gm: string;
let pnj: string;
type J = { token: string; id: string };
let gon: J, kirua: J;
let zoneSauvage: string;
const recues: { a: string; evenement: string; data: any }[] = [];

beforeAll(async () => {
  t = await testApp();
  t.app.gq.bus.on((e) => recues.push({ a: e.a.type === 'joueur' ? e.a.id : e.a.type, evenement: e.evenement, data: e.data }));
  gm = t.app.gq.tokens.issue({ role: 'gm', sub: 'gm1', partieId: t.partieId });
  pnj = t.app.gq.tokens.issue({ role: 'pnj', sub: 'pnj1', partieId: t.partieId });
  // J = 1 : PV du boss = 10 (RG-14).
  await t.setEtat('en_cours', { inscriptionsOuvertes: true, demarreeA: t.clock.t, j: { value: 1, lastDecreaseAt: null } });
  gon = await t.inscrire('Gon');
  kirua = await t.inscrire('Kirua');
  zoneSauvage = (await t.db.select().from(zones).where(and(eq(zones.partieId, t.partieId), eq(zones.type, 'sauvage'))))[0]!.id;
});
afterAll(() => t.close());

const post = (url: string, token: string, payload: Record<string, unknown> = {}) =>
  t.app.inject({ method: 'POST', url: `/parties/${t.partieId}${url}`, headers: t.bearer(token), payload });
const lancer = (payload: Record<string, unknown>, token = gm) => post('/evenements', token, payload);

describe('RG-12 événements', () => {
  it('RG-3 : seul le GM lance un événement', async () => {
    expect((await lancer({ type: 'krach' }, pnj)).statusCode).toBe(403);
  });

  it('Apparition : une balise dormante de la zone passe en fantôme, annonce écran + push (zone seulement)', async () => {
    const res = await lancer({ type: 'apparition', zoneId: zoneSauvage });
    expect(res.json()).toMatchObject({ ok: true, evenement: { type: 'apparition' } });
    const fantome = await t.db.select().from(balises).where(and(eq(balises.zoneId, zoneSauvage), eq(balises.type, 'fantome')));
    expect(fantome).toHaveLength(1);
    expect(recues.find((e) => e.a === 'tracker' && e.evenement === 'evenement')?.data.texte).toMatch(/^Apparition dans la zone /);
    expect(recues.some((e) => e.a === 'joueurs' && e.evenement === 'evenement')).toBe(true);
  });

  it('RG-12.1 : un seul événement de zone à la fois par zone', async () => {
    expect((await lancer({ type: 'zone_maudite', zoneId: zoneSauvage })).json()).toMatchObject({ ok: false, message: 'Un événement est déjà en cours dans cette zone' });
  });

  it('RG-12.2 : annulation par le GM, la fantôme redevient dormante', async () => {
    const [e] = await t.db.select().from(evenements).where(eq(evenements.partieId, t.partieId));
    expect((await post(`/evenements/${e!.id}/annuler`, gm)).json().ok).toBe(true);
    expect(await t.db.select().from(balises).where(and(eq(balises.zoneId, zoneSauvage), eq(balises.type, 'fantome')))).toEqual([]);
    expect((await t.db.select().from(evenements).where(eq(evenements.id, e!.id)))[0]!.etat).toBe('annule');
  });

  it('Krach : boutique à -50 %', async () => {
    await lancer({ type: 'krach' });
    const res = await t.app.inject({ url: `/parties/${t.partieId}/boutique`, headers: t.bearer(gon.token) });
    expect(res.json().prixPaquet).toBe(25);
  });

  it('Raid : bonnes réponses retirent des PV ; une question une fois par joueur ; victoire → 3 sorts par participant', async () => {
    await lancer({ type: 'raid' });
    const qs = (await t.app.inject({ url: `/parties/${t.partieId}/raid`, headers: t.bearer(gon.token) })).json().questions;
    expect(qs[0]).not.toHaveProperty('bonne');
    const avant = (await t.db.select().from(sorts).where(and(eq(sorts.joueurId, gon.id), eq(sorts.utilise, false)))).length;
    const fausse = await post('/raid/reponse', kirua.token, { questionId: 'r1', choix: 0 });
    expect(fausse.json()).toMatchObject({ ok: true, correcte: false, pv: 10 });
    for (const q of RAID_QUESTIONS.slice(0, 9)) await post('/raid/reponse', gon.token, { questionId: q.id, choix: q.bonne });
    expect((await post('/raid/reponse', gon.token, { questionId: 'r1', choix: 1 })).json()).toMatchObject({ code: 'deja_repondu' });
    const fin = await post('/raid/reponse', gon.token, { questionId: 'r10', choix: 1 });
    expect(fin.json()).toMatchObject({ ok: true, pv: 0, vaincu: true });
    expect((await t.db.select().from(sorts).where(and(eq(sorts.joueurId, gon.id), eq(sorts.utilise, false)))).length).toBe(avant + 3);
    // Kirua n'a donné aucune bonne réponse : pas participant.
    expect(recues.some((e) => e.a === kirua.id && e.evenement === 'recompense_raid')).toBe(false);
    expect(recues.some((e) => e.a === 'tracker' && e.evenement === 'raid')).toBe(true);
    expect(recues.some((e) => e.a === 'joueurs' && e.evenement === 'raid')).toBe(true); // barre de vie dans l'app
  });

  it('Carte maudite : arrive chez un joueur actif, son porteur est prévenu', async () => {
    const res = await lancer({ type: 'carte_maudite' });
    expect(res.json().ok).toBe(true);
    const maudites = await t.db.select().from(exemplaires).where(and(eq(exemplaires.partieId, t.partieId), eq(exemplaires.maudite, true)));
    expect(maudites).toHaveLength(1);
    expect(recues.some((e) => e.a === maudites[0]!.joueurId && e.evenement === 'carte_maudite')).toBe(true);
  });

  it('Mission secrète : seul le joueur visé la voit ; validée par un PNJ → jenny', async () => {
    const res = await lancer({ type: 'mission_secrete', joueurId: kirua.id, objectif: 'Photo avec un PNJ', recompenseJenny: 30 });
    const id = res.json().evenement.id;
    expect(recues.some((e) => e.a === 'joueurs' && e.data?.type === 'mission_secrete')).toBe(false);
    const vueGon = (await t.app.inject({ url: `/parties/${t.partieId}/evenements`, headers: t.bearer(gon.token) })).json().evenements;
    expect(vueGon.some((e: { type: string }) => e.type === 'mission_secrete')).toBe(false);
    const avant = (await t.db.select().from(joueurs).where(eq(joueurs.id, kirua.id)))[0]!.jenny;
    expect((await post(`/evenements/${id}/valider`, pnj)).json()).toMatchObject({ ok: true, jenny: 30 });
    expect((await t.db.select().from(joueurs).where(eq(joueurs.id, kirua.id)))[0]!.jenny).toBe(avant + 30);
  });

  it('pas d’événement hors partie', async () => {
    await t.db.update(parties).set({ etat: 'pause', pauseDepuis: t.clock.t, etatAvantPause: 'en_cours' }).where(eq(parties.id, t.partieId));
    expect((await lancer({ type: 'krach' })).json()).toMatchObject({ ok: false, message: 'Les événements se lancent pendant la partie' });
  });
});
