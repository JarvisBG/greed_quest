import { describe, expect, it } from 'vitest';
import { formatDuree, libelleEtat } from './format';

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
});
