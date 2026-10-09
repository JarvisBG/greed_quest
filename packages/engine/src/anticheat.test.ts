import { describe, expect, it } from 'vitest';
import { isAbnormalScanRate, isRepeatedUnbalanced, tradeSideValue, unbalancedDirection } from './anticheat.js';

describe('RG-15 rythme de scan anormal', () => {
  it('10 tirages en moins de 10 min', () => {
    const t = Array.from({ length: 10 }, (_, i) => i * 50_000);
    expect(isAbnormalScanRate(t, 9 * 50_000)).toBe(true);
    expect(isAbnormalScanRate(t.slice(1), 9 * 50_000)).toBe(false);
    expect(isAbnormalScanRate(t, 9 * 50_000 + 10 * 60_000)).toBe(false);
  });
});

describe('RG-15 échanges répétés déséquilibrés', () => {
  it('valeur d’une part : points de rang + 1 par 10 J', () => {
    expect(tradeSideValue({ rangs: ['S', 'D'], jenny: 25 })).toBe(8.5);
  });

  it('déséquilibre : rapport ≥ 3 et au moins 5 points', () => {
    expect(unbalancedDirection(6, 1)).toBe('a');
    expect(unbalancedDirection(1, 6)).toBe('b');
    expect(unbalancedDirection(4, 0)).toBeNull();
    expect(unbalancedDirection(6, 3)).toBeNull();
  });

  it('au moins 2 échanges déséquilibrés dans le même sens en 1 h', () => {
    expect(isRepeatedUnbalanced([{ donneurDesequilibre: 'x', a: 0 }, { donneurDesequilibre: 'x', a: 30 * 60_000 }], 40 * 60_000)).toBe(true);
    expect(isRepeatedUnbalanced([{ donneurDesequilibre: 'x', a: 0 }, { donneurDesequilibre: 'y', a: 30 * 60_000 }], 40 * 60_000)).toBe(false);
    expect(isRepeatedUnbalanced([{ donneurDesequilibre: 'x', a: 0 }, { donneurDesequilibre: 'x', a: 30 * 60_000 }], 70 * 60_000)).toBe(false);
  });
});
