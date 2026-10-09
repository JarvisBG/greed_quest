import { describe, expect, it } from 'vitest';
import { EXAMEN, NEN_TEST, catchUpBonus, kitSpell, nenFromAnswers, scoreExamen, validQuizAnswers } from './registration.js';
import { seededRng, sequenceRng } from './rng.js';

describe('RG-5.3 Examen Hunter', () => {
  it('3 questions, compte les bonnes réponses', () => {
    expect(EXAMEN).toHaveLength(3);
    expect(scoreExamen(EXAMEN.map((q) => q.bonne))).toBe(3);
    expect(scoreExamen([1, 1])).toBe(1);
  });

  it('réponses hors limites refusées', () => {
    expect(validQuizAnswers(EXAMEN, [0, 0, 0])).toBe(true);
    expect(validQuizAnswers(EXAMEN, [0, 0])).toBe(false);
    expect(validQuizAnswers(EXAMEN, [0, 9, 0])).toBe(false);
  });
});

describe('RG-5.4 test de Nen', () => {
  it('5 questions, type le plus choisi', () => {
    expect(NEN_TEST).toHaveLength(5);
    expect(nenFromAnswers([4, 4, 4, 0, 1], 5, sequenceRng([0.99, 0]))).toBe('manipulation');
  });

  it('égalité départagée au hasard', () => {
    expect(nenFromAnswers([0, 0, 1, 1, 2], 0, sequenceRng([0.5, 0.99]))).toBe('emission');
  });

  it('Spécialisation rare : tirée avant le questionnaire', () => {
    expect(nenFromAnswers([0, 0, 0, 0, 0], 5, sequenceRng([0.04]))).toBe('specialisation');
    const rng = seededRng(1);
    const n = Array.from({ length: 2000 }, () => nenFromAnswers([0, 1, 2, 3, 4], 5, rng)).filter((t) => t === 'specialisation').length;
    expect(n / 2000).toBeGreaterThan(0.03);
    expect(n / 2000).toBeLessThan(0.07);
  });
});

describe('RG-5.5 / 5.6 kit et rattrapage', () => {
  it('kit : un sort au hasard', () => {
    expect(kitSpell(sequenceRng([0]))).toBe('vol');
  });

  it('amendement 2026-10-09 : Regard, sort rare, n’est jamais dans le kit', () => {
    expect(kitSpell(sequenceRng([0.999]))).toBe('analyse');
    for (let i = 0; i < 100; i++) expect(kitSpell(sequenceRng([i / 100]))).not.toBe('regard');
  });

  it('rattrapage proportionnel aux minutes de jeu écoulées, désactivable', () => {
    expect(catchUpBonus(0, 2)).toBe(0);
    expect(catchUpBonus(30 * 60_000 + 59_000, 2)).toBe(60);
    expect(catchUpBonus(30 * 60_000, 0)).toBe(0);
  });
});
