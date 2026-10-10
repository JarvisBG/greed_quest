import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { balises, parties } from '../db/schema.js';
import { CENTRE, testApp } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
let gm: string;
let pnj: string;
const ici = { ...CENTRE, precisionM: 5 };

beforeAll(async () => {
  t = await testApp();
  gm = t.app.gq.tokens.issue({ role: 'gm', sub: 'gm1', partieId: t.partieId });
  pnj = t.app.gq.tokens.issue({ role: 'pnj', sub: 'pnj1', partieId: t.partieId });
});
afterAll(() => t.close());

const req = (method: 'GET' | 'POST' | 'PUT' | 'PATCH', url: string, token = gm, payload?: Record<string, unknown>) =>
  t.app.inject({ method, url: `/parties/${t.partieId}${url}`, headers: t.bearer(token), ...(payload ? { payload } : {}) });
const cycle = (action: string, token = gm) => req('POST', '/cycle', token, { action });
const etat = async () => (await t.db.select().from(parties).where(eq(parties.id, t.partieId)))[0]!;

describe('RG-4 cycle de vie piloté par le GM', () => {
  it('RG-3 : seul le GM fait avancer la partie', async () => {
    expect((await cycle('ouvrir_inscriptions', pnj)).statusCode).toBe(403);
  });

  it('brouillon → inscriptions → en cours ; au démarrage, balises activées et J calculé', async () => {
    expect((await cycle('demarrer')).json()).toMatchObject({ ok: false, code: 'transition_impossible' });
    expect((await cycle('ouvrir_inscriptions')).json()).toMatchObject({ ok: true, etat: 'inscriptions' });
    await t.inscrire('Gon');
    await t.inscrire('Kirua');
    expect((await cycle('demarrer')).json()).toMatchObject({ ok: true, etat: 'en_cours' });
    expect((await etat()).j.value).toBe(2);
    const actives = await t.db.select().from(balises).where(and(eq(balises.partieId, t.partieId), eq(balises.etat, 'active')));
    expect(actives).toHaveLength(5);
  });

  it('RG-4.4 : pause puis reprise', async () => {
    expect((await cycle('pause')).json().etat).toBe('pause');
    t.clock.t += 60_000;
    expect((await cycle('reprendre')).json().etat).toBe('en_cours');
    expect((await etat()).pauseCumulee).toBe(60_000);
  });

  it('état public de la partie : temps restant, zones', async () => {
    const res = await t.app.inject({ url: `/parties/${t.partieId}` });
    expect(res.json().partie).toMatchObject({ etat: 'en_cours', restantMs: 120 * 60_000 });
    expect(res.json().partie.zones).toHaveLength(6);
  });
});

describe('RG-14 paramètres', () => {
  it('RG-14.6 : vue console J / auto / mode / appliqué, lisible par le PNJ', async () => {
    const res = await req('GET', '/parametres', pnj);
    const k = res.json().parametres.find((p: { key: string }) => p.key === 'kBoucle');
    expect(k).toMatchObject({ J: 2, auto: 2, setting: { mode: 'auto' }, applied: 2 });
  });

  it('RG-14.2 : le GM verrouille un paramètre ; le PNJ ne peut pas (RG-3)', async () => {
    expect((await req('PUT', '/parametres', pnj, { cle: 'kBoucle', reglage: { mode: 'verrouille', value: 4 } })).statusCode).toBe(403);
    const res = await req('PUT', '/parametres', gm, { cle: 'kBoucle', reglage: { mode: 'verrouille', value: 4 } });
    expect(res.json().parametre).toMatchObject({ auto: 2, applied: 4 });
    expect((await req('PUT', '/parametres', gm, { cle: 'inconnu', reglage: { mode: 'auto' } })).json().code).toBe('parametre_inconnu');
  });

  it('RG-14.5 : enregistrer puis appliquer un préréglage', async () => {
    const res = await req('POST', '/prereglages', gm, { nom: 'Parc du château' });
    const liste = (await req('GET', '/prereglages')).json().prereglages;
    expect(liste.find((p: { id: string }) => p.id === res.json().id)).toMatchObject({ reglages: { kBoucle: { mode: 'verrouille', value: 4 } } });
    await req('POST', '/prereglages/appliquer', gm, { id: 'standard' });
    expect((await etat()).parametres.kBoucle).toEqual({ mode: 'auto' });
  });
});

describe('RG-6 balises pilotées par le GM', () => {
  it('une balise coupée refuse le scan sans motif', async () => {
    const [b] = await t.db.select().from(balises).where(and(eq(balises.partieId, t.partieId), eq(balises.etat, 'active')));
    expect((await req('POST', `/balises/${b!.id}/etat`, gm, { action: 'couper' })).json()).toMatchObject({ ok: true, etat: 'coupee' });
    const gon = (await t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/reconnexion`, payload: { appareilId: 'appareil-Gon-1-xxxxxxxx' } })).json();
    const scan = await t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/scan`, headers: t.bearer(gon.token), payload: { baliseId: b!.id, position: ici } });
    expect(scan.json()).toMatchObject({ code: 'balise_coupee', message: 'Scan refusé' });
  });

  it('RG-6.4 : rotation forcée', async () => {
    expect((await req('POST', '/balises/rotation')).json().changements).toBeGreaterThan(0);
  });

  it('carte des balises pour l’équipe, jamais pour un joueur (RG-6.5)', async () => {
    expect((await req('GET', '/balises', pnj)).json().balises).toHaveLength(20);
    const gon = (await t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/reconnexion`, payload: { appareilId: 'appareil-Gon-1-xxxxxxxx' } })).json();
    expect((await req('GET', '/balises', gon.token)).statusCode).toBe(403);
  });

  it('RG-8.1 : lot réel d’une carte, visible de l’équipe seulement', async () => {
    await req('PATCH', `/cartes/${t.carteIds[0]}`, gm, { lotReel: 'Console de jeu' });
    expect((await req('GET', '/cartes', pnj)).json().cartes[0]).toMatchObject({ numero: 0, lotReel: 'Console de jeu' });
    expect((await t.app.inject({ url: `/parties/${t.partieId}/cartes` })).json().cartes[0]).not.toHaveProperty('lotReel');
  });
});

describe('RG-4.6 fin de partie', () => {
  it('le GM termine : classement final figé', async () => {
    expect((await cycle('terminer')).json().etat).toBe('terminee');
    expect((await etat()).classementFinal).toHaveLength(2);
  });
});
