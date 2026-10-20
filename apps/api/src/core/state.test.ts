import { countInCirculation, type CardItem } from '@gq/engine';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exemplaires } from '../db/schema.js';
import { testApp } from '../test/helpers.js';
import { circulation } from './state.js';

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
