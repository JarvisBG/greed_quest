import { describe, expect, it } from 'vitest';
import { conseilCartesDesignees, conseilOrganisation, repartitionCatalogue } from './conseils.js';

describe('Calibrage : conseils d’organisation', () => {
  it('≈ 0,75 balise posée par joueur attendu, au moins 10', () => {
    expect(conseilOrganisation(30).balises).toBe(23);
    expect(conseilOrganisation(80).balises).toBe(60);
    expect(conseilOrganisation(6).balises).toBe(10);
  });

  it('1 checkpoint pour 10 joueurs, ≈ 2,5 cartes par joueur (Clear possible), stock B / A / S en 50 / 35 / 15 %', () => {
    const c = conseilOrganisation(30);
    expect(c.checkpoints).toBe(3);
    expect(c.cartesParCheckpoint).toBe(25);
    expect(c.stockParCheckpoint).toEqual({ B: 12, A: 9, S: 4 });
  });

  it('petit groupe : au moins un checkpoint, stock entier qui somme juste', () => {
    const c = conseilOrganisation(4);
    expect(c.checkpoints).toBe(1);
    expect(Object.values(c.stockParCheckpoint).reduce((s, n) => s + (n ?? 0), 0)).toBe(c.cartesParCheckpoint);
  });
});

describe('RG-8.1 : N réglable, répartition du catalogue', () => {
  it('N = 14 (120 min) : 1 SS, le reste au prorata du tableau RG-8', () => {
    expect(repartitionCatalogue(14)).toEqual({ SS: 1, S: 2, A: 2, B: 3, C: 3, D: 3 });
  });

  it('toujours 1 SS, au moins une carte par rang, somme = N (bornée à 7..60)', () => {
    for (const n of [7, 12, 18, 20, 24, 45, 60]) {
      const r = repartitionCatalogue(n);
      expect(r.SS).toBe(1);
      expect(Object.values(r).every((k) => k >= 1)).toBe(true);
      expect(Object.values(r).reduce((a, b) => a + b, 0)).toBe(n);
    }
    expect(Object.values(repartitionCatalogue(3)).reduce((a, b) => a + b, 0)).toBe(7);
  });
});

describe('RG-8.1 : conseil de N pour un Clear possible', () => {
  it('12 cartes à 90 min, +2 par demi-heure, +2 au-delà de 50 joueurs', () => {
    expect(conseilCartesDesignees(30, 90)).toBe(12);
    expect(conseilCartesDesignees(80, 90)).toBe(12);
    expect(conseilCartesDesignees(30, 120)).toBe(14);
    expect(conseilCartesDesignees(80, 120)).toBe(16);
    expect(conseilCartesDesignees(10, 150)).toBe(16);
    expect(conseilCartesDesignees(80, 180)).toBe(20);
    expect(conseilCartesDesignees(10, 30)).toBe(12);
  });
});
