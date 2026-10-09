import { describe, expect, it } from 'vitest';
import { NEN_TYPES, SPELL_TYPES } from '@gq/shared';
import { formatDuree, libelleEtat, NENS, SORTS, titrePage } from './format';

describe('format', () => {
  it('durées', () => {
    expect(formatDuree(45_000)).toBe('45 s');
    expect(formatDuree(12 * 60_000)).toBe('12 min');
    expect(formatDuree(65 * 60_000)).toBe('1 h 05');
    expect(formatDuree(-5)).toBe('0 s');
  });
  it('RG-4 : libellé des états', () => {
    expect(libelleEtat('phase_finale')).toBe('Phase finale');
    expect(libelleEtat('inconnu')).toBe('inconnu');
  });
  it('RG-5.4 / RG-10 : chaque Nen et chaque sort a un libellé', () => {
    for (const n of NEN_TYPES) expect(NENS[n].passif).not.toBe('');
    for (const s of SPELL_TYPES) expect(SORTS[s].nom).not.toBe('');
  });
  it('RG-8.5 : titres des pages du Livre', () => {
    expect(titrePage(0, 30)).toBe('001 – 010');
    expect(titrePage(2, 30)).toBe('021 – 030');
    expect(titrePage(3, 30)).toBe('Libres 1');
    expect(titrePage(2, 25)).toBe('021 – 025');
    expect(titrePage(3, 25)).toBe('Libres 1');
  });
});
