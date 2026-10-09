import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, resolveParam, resolveParams, smoothJ, type ParamContext } from './params.js';

const ctx = (J: number, balisesPosees = 60, balisesActivesCourantes = 10): ParamContext => ({
  J,
  balisesPosees,
  balisesActivesCourantes,
});

/** Formules du document telles quelles (le jeu double les limites par défaut). */
const auto = { mode: 'auto' } as const;
const AUTO = { ...DEFAULT_SETTINGS, limiteSS: auto, limiteS: auto, limiteA: auto, limiteB: auto, limiteCD: auto };

describe('RG-14 formules auto', () => {
  it('à J = 30', () => {
    const p = resolveParams(AUTO, ctx(30));
    expect(p).toMatchObject({
      balisesActives: 10,
      stockBalise: 15,
      limiteSS: 1,
      limiteS: 3,
      limiteA: 6,
      limiteB: 10,
      limiteCD: 15,
      paquetsParVague: 15,
      pvBoss: 300,
      kBoucle: 3,
      porteeSortsM: 30,
      margeGpsMaxM: 20,
      dureePartieMin: 120,
      cartesDesignees: 30,
    });
  });

  it('planchers à J = 1', () => {
    const p = resolveParams(AUTO, ctx(1));
    expect(p).toMatchObject({ balisesActives: 5, stockBalise: 5, limiteSS: 1, limiteS: 2, limiteA: 3, limiteB: 4, limiteCD: 5 });
  });

  it('plafonds à J = 200 : stock 30, balises actives ≤ balises posées', () => {
    const p = resolveParams(AUTO, ctx(200, 40));
    expect(p.stockBalise).toBe(30);
    expect(p.balisesActives).toBe(40);
    expect(p.limiteSS).toBe(10);
  });

  it('Amendement RG-14 (calibrage) : limites en Multiplicateur × 2 par défaut, × 4 pour la SS ; durée 120 min', () => {
    expect(resolveParams(DEFAULT_SETTINGS, ctx(30))).toMatchObject({ limiteSS: 4, limiteS: 6, limiteA: 12, limiteB: 20, limiteCD: 30, dureePartieMin: 120 });
    expect(resolveParams(DEFAULT_SETTINGS, ctx(1))).toMatchObject({ limiteSS: 4, limiteS: 4, limiteA: 6, limiteB: 8, limiteCD: 10 });
    expect(resolveParam('limiteSS', DEFAULT_SETTINGS.limiteSS, ctx(30))).toMatchObject({ auto: 1, applied: 4 });
  });

  it('kBoucle vaut 2 sous 8 balises actives', () => {
    expect(resolveParams(DEFAULT_SETTINGS, ctx(30, 60, 7)).kBoucle).toBe(2);
    expect(resolveParams(DEFAULT_SETTINGS, ctx(30, 60, 8)).kBoucle).toBe(3);
  });
});

describe('RG-14.2 modes', () => {
  it('verrouillé ignore la formule', () => {
    expect(resolveParam('stockBalise', { mode: 'verrouille', value: 12 }, ctx(100)).applied).toBe(12);
  });

  it('multiplicateur applique le coefficient et arrondit', () => {
    const r = resolveParam('stockBalise', { mode: 'multiplicateur', coef: 1.5 }, ctx(30));
    expect(r).toMatchObject({ auto: 15, applied: 23 }); // 22,5 → 23
  });

  it('RG-14.6 expose J, auto, mode et valeur appliquée', () => {
    expect(resolveParam('limiteA', { mode: 'auto' }, ctx(30))).toEqual({
      key: 'limiteA',
      J: 30,
      auto: 6,
      setting: { mode: 'auto' },
      applied: 6,
    });
  });

  it('balises actives jamais au-delà des balises posées, même verrouillé', () => {
    expect(resolveParam('balisesActives', { mode: 'verrouille', value: 99 }, ctx(30, 20)).applied).toBe(20);
  });
});

describe('RG-14.1 lissage de J', () => {
  const min = 60_000;

  it('une hausse s’applique tout de suite', () => {
    expect(smoothJ({ value: 10, lastDecreaseAt: 0 }, 25, min).value).toBe(25);
  });

  it('une baisse est limitée à une toutes les 10 min', () => {
    let s = smoothJ({ value: 30, lastDecreaseAt: null }, 20, 0);
    expect(s).toEqual({ value: 20, lastDecreaseAt: 0 });
    s = smoothJ(s, 10, 4 * min);
    expect(s.value).toBe(20);
    s = smoothJ(s, 10, 10 * min);
    expect(s).toEqual({ value: 10, lastDecreaseAt: 10 * min });
  });
});
