import { describe, expect, it } from 'vitest';
import { BANQUE_CARTES } from '@gq/shared';
import { conseilCartesDesignees, conseilOrganisation, repartitionCatalogue, tirerCatalogue } from './conseils.js';
import { seededRng } from './rng.js';

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

describe('RG-8.1 (amendement 2026-10-17) : la plateforme propose le catalogue au hasard', () => {
  it('tire N cartes distinctes de la banque, selon la répartition conseillée, triées par numéro', () => {
    const cs = tirerCatalogue(BANQUE_CARTES, 14, seededRng(7));
    expect(cs).toHaveLength(14);
    expect(new Set(cs.map((c) => c.numero)).size).toBe(14);
    const r = repartitionCatalogue(14);
    for (const k of Object.keys(r) as (keyof typeof r)[]) expect(cs.filter((c) => c.rang === k)).toHaveLength(r[k]);
    expect(cs.map((c) => c.numero)).toEqual([...cs.map((c) => c.numero)].sort((a, b) => a - b));
  });
  it('deux tirages différents ne donnent pas le même catalogue ; même graine, même catalogue', () => {
    const a = tirerCatalogue(BANQUE_CARTES, 20, seededRng(1)).map((c) => c.numero);
    expect(tirerCatalogue(BANQUE_CARTES, 20, seededRng(1)).map((c) => c.numero)).toEqual(a);
    expect(tirerCatalogue(BANQUE_CARTES, 20, seededRng(2)).map((c) => c.numero)).not.toEqual(a);
  });
  it('prend moins de cartes d’un rang si la banque en manque', () => {
    const banque = [
      { numero: 0, rang: 'SS' as const },
      { numero: 1, rang: 'D' as const },
    ];
    expect(tirerCatalogue(banque, 7, seededRng(3)).map((c) => c.numero)).toEqual([0, 1]);
  });
});
