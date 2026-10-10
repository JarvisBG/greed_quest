import { describe, expect, it } from 'vitest';
import { rechargesNenMs, reserveMaterialisationDans } from './nen.js';
import { DEFAULT_SETTINGS, resolveParams } from './params.js';

const MIN = 60_000;

describe('RG-5.4 amendé le 2026-10-10 : pouvoirs de Nen rechargeables', () => {
  it('recharges par défaut : Renforcement 30 min, Émission et Manipulation 40 min ; réserve de Matérialisation 40 min', () => {
    const p = resolveParams(DEFAULT_SETTINGS, { J: 30, balisesPosees: 30, balisesActivesCourantes: 10 });
    expect(rechargesNenMs(p)).toEqual({ renforcement: 30 * MIN, emission: 40 * MIN, manipulation: 40 * MIN });
    expect(p.reserveMaterialisationMin).toBe(40);
  });

  it('réserve de Matérialisation : due 40 min après l’inscription, puis 40 min après le dernier tirage de réserve', () => {
    const j = { nen: 'materialisation' as const, derniereReserveA: null, inscritA: 5 * MIN };
    expect(reserveMaterialisationDans(j, 30 * MIN, 40 * MIN)).toBe(15 * MIN);
    expect(reserveMaterialisationDans(j, 45 * MIN, 40 * MIN)).toBe(0);
    expect(reserveMaterialisationDans({ ...j, derniereReserveA: 45 * MIN }, 60 * MIN, 40 * MIN)).toBe(25 * MIN);
    expect(reserveMaterialisationDans({ ...j, nen: 'emission' }, 60 * MIN, 40 * MIN)).toBeNull();
  });
});
