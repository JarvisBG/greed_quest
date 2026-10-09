import { describe, expect, it } from 'vitest';
import { conseilOrganisation } from './conseils.js';

describe('Calibrage : conseils d’organisation', () => {
  it('≈ 0,75 balise posée par joueur attendu, au moins 10', () => {
    expect(conseilOrganisation(30).balises).toBe(23);
    expect(conseilOrganisation(80).balises).toBe(60);
    expect(conseilOrganisation(6).balises).toBe(10);
  });

  it('1 checkpoint pour 10 joueurs, ≈ 1,5 carte par joueur, stock B / A / S en 50 / 35 / 15 %', () => {
    const c = conseilOrganisation(30);
    expect(c.checkpoints).toBe(3);
    expect(c.cartesParCheckpoint).toBe(15);
    expect(c.stockParCheckpoint).toEqual({ B: 8, A: 5, S: 2 });
  });

  it('petit groupe : au moins un checkpoint, stock entier qui somme juste', () => {
    const c = conseilOrganisation(4);
    expect(c.checkpoints).toBe(1);
    expect(Object.values(c.stockParCheckpoint).reduce((s, n) => s + (n ?? 0), 0)).toBe(c.cartesParCheckpoint);
  });
});
