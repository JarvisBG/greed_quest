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

  it('RG-8.1 amendé : numéros de l’anime (000 à 099), Book dans leur ordre ; tous ou aucun, sans doublon', async () => {
    const cs = catalogue(14).map((c, i) => ({ ...c, numero: [94, 0, 17, 99, 51, 46, 82, 73, 83, 21, 79, 11, 25, 84][i]! }));
    expect((await req('PUT', '/catalogue', gm, { cartes: cs })).json()).toMatchObject({ ok: true, n: 14 });
    const cartes = (await req('GET', '/cartes')).json().cartes as { numero: number; nom: string }[];
    expect(cartes.map((c) => c.numero)).toEqual([0, 11, 17, 21, 25, 46, 51, 73, 79, 82, 83, 84, 94, 99]);
    const melange = cs.map((c, i) => (i === 0 ? { nom: c.nom, rang: c.rang } : c));
    expect((await req('PUT', '/catalogue', gm, { cartes: melange })).json().message).toContain('Numérote toutes les cartes, ou aucune');
    const doublon = cs.map((c, i) => (i === 1 ? { ...c, numero: 94 } : c));
    expect((await req('PUT', '/catalogue', gm, { cartes: doublon })).json().message).toContain('Deux cartes ont le même numéro');
    expect((await req('PUT', '/catalogue', gm, { cartes: cs.map((c) => ({ ...c, numero: c.numero + 100 })) })).statusCode).toBe(400);
    await req('PUT', '/catalogue', gm, { cartes: catalogue(20) }); // état attendu par les tests suivants
  });

  it('RG-8.1 : texte d’ambiance repris de la banque si la carte de l’anime est reprise telle quelle, sinon celui du GM ou rien', async () => {
    const cs = catalogue(14).map((c, i) => ({ ...c, numero: [94, 0, 17, 99, 51, 46, 82, 73, 83, 21, 79, 11, 25, 84][i]! }));
    cs[0] = { ...cs[0]!, nom: 'L\'épée du vol' }; // nom de la banque : texte repris
    cs[1] = { ...cs[1]!, nom: 'Le bonheur du détenteur', texte: 'Texte du GM' } as (typeof cs)[number];
    expect((await req('PUT', '/catalogue', gm, { cartes: cs })).json()).toMatchObject({ ok: true });
    const cartes = (await req('GET', '/cartes')).json().cartes as { numero: number; texte: string | null }[];
    expect(cartes.find((c) => c.numero === 94)?.texte).toBe('Une épée légendaire dont chaque coup vole une carte.');
    expect(cartes.find((c) => c.numero === 0)?.texte).toBe('Texte du GM');
    expect(cartes.find((c) => c.numero === 17)?.texte).toBeNull(); // nom inventé : pas de texte de la banque
    await req('PUT', '/catalogue', gm, { cartes: catalogue(20) });
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
