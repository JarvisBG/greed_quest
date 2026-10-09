import { describe, expect, it } from 'vitest';
import { DEFAULT_SIM, simulate } from './simulate.js';

describe('simulateur', () => {
  it('est reproductible et produit des chiffres cohérents', () => {
    const cfg = { ...DEFAULT_SIM, joueurs: 10, seed: 4, dureeMin: 60 };
    const a = simulate(cfg);
    expect(simulate(cfg)).toEqual(a);
    expect(a.meilleur).toBeGreaterThan(0);
    expect(a.meilleur).toBeLessThanOrEqual(30);
    expect(a.moyenne).toBeLessThanOrEqual(a.meilleur);
    expect(a.tiragesParJoueur).toBeGreaterThan(0);
  });
});
