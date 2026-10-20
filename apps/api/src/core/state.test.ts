import { countInCirculation, rank, type CardItem } from '@gq/engine';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { exemplaires, joueurs } from '../db/schema.js';
import { testApp } from '../test/helpers.js';
import { circulation, loadBooks, loadCartesClassement, loadCatalogue } from './state.js';

let t: Awaited<ReturnType<typeof testApp>>;
beforeAll(async () => {
  t = await testApp();
  await t.setEtat('inscriptions', { inscriptionsOuvertes: true });
});
afterAll(() => t.close());

describe('RG-8.2 exemplaires en circulation (compté par la base)', () => {
  it('RG-8.2 : une vraie carte compte pour elle, un déguisé pour sa vraie carte, une copie ratée pour rien ; même résultat que le moteur', async () => {
    const gon = await t.inscrire('Gon');
    const [a, b, c] = t.carteIds;
    const lignes: (typeof exemplaires.$inferInsert)[] = [
      { id: 'e1', partieId: t.partieId, joueurId: gon.id, carteId: a!, origine: { type: 'balise', baliseId: 'x' }, obtenuA: 0 },
      { id: 'e2', partieId: t.partieId, joueurId: gon.id, carteId: a!, origine: { type: 'balise', baliseId: 'x' }, obtenuA: 0 },
      { id: 'e3', partieId: t.partieId, joueurId: gon.id, carteId: b!, origine: { type: 'balise', baliseId: 'x' }, obtenuA: 0, faux: { nature: 'deguise', vraieCarteId: c! } },
      { id: 'e4', partieId: t.partieId, joueurId: gon.id, carteId: b!, origine: { type: 'balise', baliseId: 'x' }, obtenuA: 0, faux: { nature: 'copie' } },
    ];
    await t.db.insert(exemplaires).values(lignes);
    const n = await circulation(t.db, t.partieId);
    expect(Object.fromEntries(n)).toEqual({ [a!]: 2, [c!]: 1 });
    const items = lignes.map((l): CardItem => ({ kind: 'carte', id: l.id, cardId: l.carteId, origine: l.origine, obtenuA: 0, ...(l.faux ? { faux: l.faux } : {}) }));
    expect(n).toEqual(countInCirculation([{ items, pertes: [] }]));
  });
});

describe('RG-13.5 classement allégé', () => {
  it('RG-13.5 / RG-13.7 : même classement (live et final) avec les cartes seules qu’avec les Livres complets', async () => {
    const kirua = await t.inscrire('Kirua');
    const cat = await loadCatalogue(t.db, t.partieId);
    const [d1, d2, d3] = cat.designees;
    const base = { partieId: t.partieId, joueurId: kirua.id, origine: { type: 'balise' as const, baliseId: 'x' } };
    await t.db.insert(exemplaires).values([
      { ...base, id: 'k1', carteId: d1!, obtenuA: 5 },
      { ...base, id: 'k2', carteId: d2!, obtenuA: 9, cachee: true },
      { ...base, id: 'k3', carteId: d3!, obtenuA: 3, faux: { nature: 'copie' }, marque: 'demasquee' },
      { ...base, id: 'k4', carteId: d3!, obtenuA: 7, faux: { nature: 'deguise', vraieCarteId: d2! } },
    ]);
    const ids = (await t.db.select({ id: joueurs.id }).from(joueurs).where(eq(joueurs.partieId, t.partieId))).map((j) => j.id);
    const [complets, legers] = await Promise.all([loadBooks(t.db, ids), loadCartesClassement(t.db, ids)]);
    const joueursRang = (books: Map<string, Parameters<typeof rank>[0][number]['book']>) => ids.map((id) => ({ id, status: 'actif' as const, book: books.get(id)!, jenny: 50 }));
    for (const mode of ['live', 'final'] as const) {
      expect(rank(joueursRang(legers), cat.designees, mode, cat.rangDe)).toEqual(rank(joueursRang(complets), cat.designees, mode, cat.rangDe));
    }
  });
});
