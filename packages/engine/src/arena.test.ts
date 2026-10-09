import { describe, expect, it } from 'vitest';
import { arenaReward, enterArena, type ArenaPlayer } from './arena.js';
import { seededRng } from './rng.js';

const joueur = (o: Partial<ArenaPlayer> = {}): ArenaPlayer => ({ statut: 'actif', jenny: 100, derniereEntreeA: null, tentativeEnCours: false, ...o });
const R = { mise: 30, delaiMin: 15 };
const MIN = 60_000;
const limites = { SS: 2, S: 4, A: 6, B: 8, C: 10, D: 10 };

describe('Arène de Soufrabi (amendement 2026-10-09)', () => {
  it('entrée : mise due, refus en clair si jenny insuffisants ou joueur bloqué', () => {
    expect(enterArena(joueur(), 0, R)).toEqual({ ok: true, mise: 30 });
    expect(enterArena(joueur({ jenny: 29 }), 0, R)).toMatchObject({ ok: false, message: 'Il faut 30 J pour entrer dans l’arène' });
    expect(enterArena(joueur({ statut: 'gele' }), 0, R)).toMatchObject({ ok: false, code: 'joueur_bloque' });
  });

  it('une tentative toutes les 15 min, une seule à la fois', () => {
    expect(enterArena(joueur({ derniereEntreeA: 0 }), 8 * MIN, R)).toMatchObject({ ok: false, message: 'Prochaine tentative possible dans 7 min' });
    expect(enterArena(joueur({ derniereEntreeA: 0 }), 15 * MIN, R)).toMatchObject({ ok: true });
    expect(enterArena(joueur({ tentativeEnCours: true }), 0, R)).toMatchObject({ ok: false, code: 'tentative_en_cours' });
  });

  it('victoire : toujours une carte A, S ou SS, en proportions ≈ 50 / 40 / 10', () => {
    const catalogue = [
      { id: 'ss', rank: 'SS' as const, enCirculation: 0 },
      { id: 's', rank: 'S' as const, enCirculation: 0 },
      { id: 'a', rank: 'A' as const, enCirculation: 0 },
    ];
    const rng = seededRng(7);
    const n = { SS: 0, S: 0, A: 0 } as Record<string, number>;
    for (let i = 0; i < 2000; i++) {
      const g = arenaReward(catalogue, limites, rng);
      expect(g.kind).toBe('carte');
      if (g.kind === 'carte') n[g.rank]!++;
    }
    expect(n.SS! / 2000).toBeCloseTo(0.1, 1);
    expect(n.S! / 2000).toBeCloseTo(0.4, 1);
    expect(n.A! / 2000).toBeCloseTo(0.5, 1);
  });

  it('RG-8.2 / 8.3 : SS à sa limite → rang inférieur', () => {
    const catalogue = [
      { id: 'ss', rank: 'SS' as const, enCirculation: 2 },
      { id: 's', rank: 'S' as const, enCirculation: 0 },
      { id: 'a', rank: 'A' as const, enCirculation: 0 },
    ];
    const rng = seededRng(1);
    const tires = new Set(Array.from({ length: 200 }, () => {
      const g = arenaReward(catalogue, limites, rng);
      return g.kind === 'carte' ? g.cardId : g.kind;
    }));
    expect([...tires].sort()).toEqual(['a', 's']);
  });
});
