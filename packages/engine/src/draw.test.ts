import type { Rank } from '@gq/shared';
import { describe, expect, it } from 'vitest';
import { draw, rankCap, type CatalogCard, type DrawInput } from './draw.js';
import { seededRng, sequenceRng } from './rng.js';

const limites: Record<Rank, number> = { SS: 1, S: 2, A: 3, B: 4, C: 5, D: 5 };

const catalogue: CatalogCard[] = [
  { id: 'ss1', rank: 'SS', enCirculation: 0 },
  { id: 's1', rank: 'S', enCirculation: 0 },
  { id: 'a1', rank: 'A', enCirculation: 0 },
  { id: 'b1', rank: 'B', enCirculation: 0 },
  { id: 'c1', rank: 'C', enCirculation: 0 },
  { id: 'd1', rank: 'D', enCirculation: 0 },
];

const input = (over: Partial<DrawInput> = {}): DrawInput => ({
  beaconType: 'standard',
  tiragesPrecedents: 0,
  catalogue,
  limites,
  ...over,
});

// Balise standard : nature carte [0, 0.82), sort [0.82, 0.95), jenny [0.95, 1).
// Rangs standard (total 81) : A [0, 4/81), B, C, D [41/81, 1).
const NATURE_CARTE = 0;
const NATURE_SORT = 0.9;
const NATURE_JENNY = 0.97;
const RANG_A = 0;
const RANG_D = 0.99;

describe('RG-8.3 tirage', () => {
  it('nature jenny', () => {
    expect(draw(input(), sequenceRng([NATURE_JENNY]))).toEqual({ kind: 'jenny', amount: 10, repli: false });
  });

  it('nature sort', () => {
    expect(draw(input(), sequenceRng([NATURE_SORT, 0]))).toEqual({ kind: 'sort', spell: 'vol' });
  });

  it('nature carte, rang tiré puis carte du rang', () => {
    expect(draw(input(), sequenceRng([NATURE_CARTE, RANG_A, 0]))).toEqual({ kind: 'carte', cardId: 'a1', rank: 'A' });
  });

  it('rang épuisé : descend au rang inférieur', () => {
    const cat = catalogue.map((c) => (c.rank === 'A' ? { ...c, enCirculation: 3 } : c));
    expect(draw(input({ catalogue: cat }), sequenceRng([NATURE_CARTE, RANG_A, 0]))).toMatchObject({ cardId: 'b1' });
  });

  it('tout épuisé sous le rang tiré : le gain devient des jenny', () => {
    const cat = catalogue.map((c) => (c.rank === 'D' ? { ...c, enCirculation: 5 } : c));
    expect(draw(input({ catalogue: cat }), sequenceRng([NATURE_CARTE, RANG_D]))).toEqual({
      kind: 'jenny',
      amount: 10,
      repli: true,
    });
  });

  it('RG-8.2 une balise standard ne sort jamais de S ni de SS', () => {
    const rng = seededRng(7);
    for (let i = 0; i < 5000; i++) {
      const r = draw(input(), rng);
      if (r.kind === 'carte') expect(['A', 'B', 'C', 'D']).toContain(r.rank);
    }
  });

  it('balise fantôme : uniquement S ou SS', () => {
    const rng = seededRng(3);
    for (let i = 0; i < 500; i++) {
      const r = draw(input({ beaconType: 'fantome' }), rng);
      expect(r.kind).toBe('carte');
      if (r.kind === 'carte') expect(['S', 'SS']).toContain(r.rank);
    }
  });
});

describe('RG-7.2 rendement décroissant', () => {
  it('plafonds', () => {
    expect(rankCap(0)).toBeNull();
    expect(rankCap(1)).toBe('B');
    expect(rankCap(2)).toBe('D');
    expect(rankCap(5)).toBe('D');
  });

  it('2e tirage : un A tiré est ramené à B', () => {
    expect(draw(input({ tiragesPrecedents: 1 }), sequenceRng([NATURE_CARTE, RANG_A, 0]))).toMatchObject({ rank: 'B' });
  });

  it('3e tirage : un A tiré est ramené à D', () => {
    expect(draw(input({ tiragesPrecedents: 2 }), sequenceRng([NATURE_CARTE, RANG_A, 0]))).toMatchObject({ rank: 'D' });
  });
});
