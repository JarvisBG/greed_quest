import { describe, expect, it } from 'vitest';
import { precedente, quizInitial, repondre, termine } from './quiz';

const qs = [1, 2, 3].map((i) => ({ id: `q${i}`, texte: `Q${i}`, choix: ['a', 'b'] }));

describe('questionnaire (RG-5.3, RG-5.4)', () => {
  it('avance question par question jusqu’à la fin', () => {
    let e = repondre(quizInitial, 1);
    e = repondre(e, 0);
    expect(termine(e, qs)).toBe(false);
    e = repondre(e, 1);
    expect(termine(e, qs)).toBe(true);
    expect(e.reponses).toEqual([1, 0, 1]);
  });

  it('revenir en arrière puis changer d’avis ne garde pas les réponses suivantes', () => {
    let e = repondre(repondre(quizInitial, 0), 1);
    e = precedente(precedente(e));
    expect(e.index).toBe(0);
    e = repondre(e, 1);
    expect(e.reponses).toEqual([1]);
    expect(precedente(quizInitial).index).toBe(0);
  });
});
