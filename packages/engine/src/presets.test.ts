import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, resolveParams } from './params.js';
import { SYSTEM_PRESETS, presetFromSettings, presetSettings } from './presets.js';

const ctx = { J: 10, balisesPosees: 20, balisesActivesCourantes: 5 };
const preset = (id: string) => SYSTEM_PRESETS.find((p) => p.id === id)!;

describe('RG-14.5 préréglages', () => {
  it('trois préréglages système : Petit groupe, Standard, Grande foule', () => {
    expect(SYSTEM_PRESETS.map((p) => p.nom)).toEqual(['Petit groupe', 'Standard', 'Grande foule']);
  });

  it('Standard = réglages par défaut', () => {
    expect(presetSettings(preset('standard'))).toEqual(DEFAULT_SETTINGS);
  });

  it('Petit groupe : portée 20 m, limites par défaut (× 2, SS au moins 4), le reste en auto', () => {
    const p = resolveParams(presetSettings(preset('petit_groupe')), ctx);
    expect(p.porteeSortsM).toBe(20);
    expect(p.limiteSS).toBe(4);
    expect(p.limiteCD).toBe(10);
    expect(p.stockBalise).toBe(5);
  });

  it('enregistrer un préréglage ne garde que les différences', () => {
    const settings = { ...DEFAULT_SETTINGS, kBoucle: { mode: 'verrouille', value: 4 } as const };
    const p = presetFromSettings('mon_reglage', 'Parc du château', '', settings);
    expect(p.systeme).toBe(false);
    expect(p.reglages).toEqual({ kBoucle: { mode: 'verrouille', value: 4 } });
    expect(presetSettings(p)).toEqual(settings);
  });
});
