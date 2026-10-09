import { repartitionCatalogue } from '@gq/engine';
import type { Rank } from '@gq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testApp } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
let gm: string;
let pnj: string;

beforeAll(async () => {
  t = await testApp();
  gm = t.app.gq.tokens.issue({ role: 'gm', sub: 'gm1', partieId: t.partieId });
  pnj = t.app.gq.tokens.issue({ role: 'pnj', sub: 'pnj1', partieId: t.partieId });
});
afterAll(() => t.close());

const req = (method: 'GET' | 'POST' | 'PUT', url: string, token = gm, payload?: unknown) =>
  t.app.inject({ method, url: `/parties/${t.partieId}${url}`, headers: t.bearer(token), ...(payload ? { payload: payload as object } : {}) });
/** Catalogue de N cartes selon la répartition conseillée (1 SS). */
const catalogue = (n: number) =>
  Object.entries(repartitionCatalogue(n)).flatMap(([rang, k]) => Array.from({ length: k }, (_, i) => ({ nom: `${rang} ${i + 1}`, rang: rang as Rank })));
const N = async () => (await req('GET', '/parametres')).json().parametres.find((p: { key: string }) => p.key === 'cartesDesignees').applied;

describe('RG-8.1 : N réglable, catalogue composé par le GM avant le démarrage', () => {
  it('réservé au GM ; 7 à 60 cartes', async () => {
    expect((await req('PUT', '/catalogue', pnj, { cartes: catalogue(20) })).statusCode).toBe(403);
    const court = await req('PUT', '/catalogue', gm, { cartes: catalogue(20).slice(0, 6) });
    expect(court.statusCode).toBe(400);
    expect(court.json().message).toContain('Au moins 7 cartes');
  });

  it('N = 20 : catalogue remplacé, numéroté 001..020, paramètre N verrouillé à 20', async () => {
    const res = await req('PUT', '/catalogue', gm, { cartes: catalogue(20) });
    expect(res.json()).toMatchObject({ ok: true, n: 20, parRang: { SS: 1 } });
    const cartes = (await req('GET', '/cartes')).json().cartes as { numero: number; designee: boolean }[];
    expect(cartes.map((c) => c.numero)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(cartes.every((c) => c.designee)).toBe(true);
    expect(await N()).toBe(20);
  });

  it('démarrage refusé si le catalogue ne compte pas N cartes désignées', async () => {
    await req('PUT', '/parametres', gm, { cle: 'cartesDesignees', reglage: { mode: 'verrouille', value: 25 } });
    await req('POST', '/cycle', gm, { action: 'ouvrir_inscriptions' });
    const refus = await req('POST', '/cycle', gm, { action: 'demarrer' });
    expect(refus.json()).toMatchObject({ ok: false, code: 'catalogue_incomplet', message: 'Le catalogue compte 20 cartes désignées, le paramètre N en attend 25' });
    await req('PUT', '/parametres', gm, { cle: 'cartesDesignees', reglage: { mode: 'verrouille', value: 20 } });
    expect((await req('POST', '/cycle', gm, { action: 'demarrer' })).json()).toMatchObject({ ok: true, etat: 'en_cours' });
  });

  it('RG-14.3 : après le démarrage, ni le catalogue ni N ne changent', async () => {
    expect((await req('PUT', '/catalogue', gm, { cartes: catalogue(24) })).json()).toMatchObject({ ok: false, code: 'partie_demarree' });
    expect((await req('PUT', '/parametres', gm, { cle: 'cartesDesignees', reglage: { mode: 'verrouille', value: 24 } })).json()).toMatchObject({
      ok: false,
      message: 'N se fixe avant le démarrage de la partie',
    });
  });
});
