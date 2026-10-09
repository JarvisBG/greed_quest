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

  it('arène de Soufrabi et enchères de SS : reproductibles, mises et SS cohérentes', () => {
    const cfg = { ...DEFAULT_SIM, joueurs: 30, seed: 2, multLimites: 2, probaArene: 0.1, encheresSSToutesLesMin: 20 };
    const a = simulate(cfg);
    expect(simulate(cfg)).toEqual(a);
    expect(a.areneTentatives).toBeGreaterThan(0);
    expect(a.areneVictoires).toBeLessThanOrEqual(a.areneTentatives);
    expect(a.encheresSSVendues).toBeLessThanOrEqual(a.encheresSS);
    expect(a.ssEnJeu).toBeLessThanOrEqual(4); // RG-8.2 : 2 SS × limite 2 (2 × max(1, ⌊30/20⌋))
    expect(a.ssDuMeilleur).toBeLessThanOrEqual(2);
  });

  it('options désactivées par défaut : ni arène ni enchère de SS', () => {
    const a = simulate({ ...DEFAULT_SIM, joueurs: 10, seed: 1, dureeMin: 60 });
    expect(a.areneTentatives).toBe(0);
    expect(a.encheresSS).toBe(0);
  });
});
