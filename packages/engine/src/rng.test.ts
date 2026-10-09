import { describe, expect, it } from 'vitest';
import { pick, seededRng, sequenceRng, weightedPick } from './rng.js';

describe('rng', () => {
  it('seededRng est reproductible et dans [0, 1)', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    for (let i = 0; i < 1000; i++) {
      const v = a.next();
      expect(v).toBe(b.next());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('weightedPick respecte les bornes cumulées', () => {
    const entries = [['a', 1], ['b', 0], ['c', 3]] as const;
    expect(weightedPick(sequenceRng([0]), entries)).toBe('a');
    expect(weightedPick(sequenceRng([0.24]), entries)).toBe('a');
    expect(weightedPick(sequenceRng([0.25]), entries)).toBe('c');
    expect(weightedPick(sequenceRng([0.99]), entries)).toBe('c');
  });

  it('weightedPick retourne undefined si tous les poids sont nuls', () => {
    expect(weightedPick(sequenceRng([0.5]), [['a', 0]])).toBeUndefined();
  });

  it('weightedPick suit les proportions sur un grand échantillon', () => {
    const rng = seededRng(1);
    let c = 0;
    for (let i = 0; i < 20000; i++) if (weightedPick(rng, [['a', 1], ['c', 3]]) === 'c') c++;
    expect(c / 20000).toBeCloseTo(0.75, 1);
  });

  it('pick refuse une liste vide', () => {
    expect(() => pick(seededRng(1), [])).toThrow();
  });
});
