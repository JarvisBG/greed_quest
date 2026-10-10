import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.js';
import { testDb } from '../test/helpers.js';
import { balises, cartes, joueurs, parties, prereglages, zones } from './schema.js';

let t: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  t = await testDb();
});
afterAll(() => t.close());

describe('schéma et seed', () => {
  it('RG-8.1 : catalogue de 30 cartes de l’anime, numéros de l’anime, 1 SS / 4 S / 5 A / 6 B / 7 C / 7 D, texte d’ambiance', async () => {
    const rows = await t.db.select().from(cartes).where(eq(cartes.partieId, t.partieId));
    expect(rows.map((c) => c.numero).sort((a, b) => a - b)).toEqual([0, 3, 5, 8, 10, 11, 12, 13, 14, 15, 17, 21, 22, 23, 25, 46, 51, 52, 63, 73, 76, 79, 81, 82, 83, 84, 90, 94, 95, 99]);
    expect(rows.find((c) => c.numero === 0)).toMatchObject({ nom: 'Le bonheur du détenteur', rang: 'SS', texte: expect.stringContaining('10 000 habitants') });
    const parRang = Object.fromEntries(['SS', 'S', 'A', 'B', 'C', 'D'].map((r) => [r, rows.filter((c) => c.rang === r).length]));
    expect(parRang).toEqual({ SS: 1, S: 4, A: 5, B: 6, C: 7, D: 7 });
  });

  it('RG-4.1 : la partie démarre en brouillon avec les paramètres du préréglage', async () => {
    const [p] = await t.db.select().from(parties).where(eq(parties.id, t.partieId));
    expect(p?.etat).toBe('brouillon');
    expect(p?.parametres.dureePartieMin).toEqual({ mode: 'verrouille', value: 120 });
  });

  it('RG-14.5 : les trois préréglages système sont en base', async () => {
    const rows = await t.db.select().from(prereglages);
    expect(rows.map((r) => r.id).sort()).toEqual(['grande_foule', 'petit_groupe', 'standard']);
  });

  it('RG-6.1 : balises dormantes, réparties dans les zones, ids non devinables', async () => {
    const rows = await t.db.select().from(balises).where(eq(balises.partieId, t.partieId));
    expect(rows).toHaveLength(20);
    expect(rows.every((b) => b.etat === 'dormante' && b.id.length >= 16)).toBe(true);
    const z = await t.db.select().from(zones).where(eq(zones.partieId, t.partieId));
    expect(new Set(rows.map((b) => b.zoneId)).size).toBe(z.length);
  });

  it('RG-5.1 : pseudo et appareil uniques par partie', async () => {
    const base = { partieId: t.partieId, licenceSecret: 'x' };
    await t.db.insert(joueurs).values({ ...base, id: 'j1', pseudo: 'Gon', appareilId: 'a1' });
    await expect(t.db.insert(joueurs).values({ ...base, id: 'j2', pseudo: 'Gon', appareilId: 'a2' })).rejects.toThrow();
    await expect(t.db.insert(joueurs).values({ ...base, id: 'j3', pseudo: 'Kirua', appareilId: 'a1' })).rejects.toThrow();
  });

  it('GET /sante', async () => {
    const app = await buildApp({ db: t.db });
    const res = await app.inject('/sante');
    expect(res.json()).toEqual({ ok: true });
  });
});
