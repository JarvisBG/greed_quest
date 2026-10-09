// Déroulé d'un questionnaire (Examen RG-5.3, test de Nen RG-5.4) : une question par écran.

export interface Question {
  id: string;
  texte: string;
  choix: readonly string[];
}

export interface EtatQuiz {
  index: number;
  reponses: number[];
}

export const quizInitial: EtatQuiz = { index: 0, reponses: [] };

/** Enregistre le choix de la question courante et passe à la suivante. */
export function repondre(e: EtatQuiz, choix: number): EtatQuiz {
  const reponses = e.reponses.slice(0, e.index);
  reponses[e.index] = choix;
  return { index: e.index + 1, reponses };
}

/** Revient à la question précédente (sa réponse reste affichée). */
export function precedente(e: EtatQuiz): EtatQuiz {
  return { ...e, index: Math.max(0, e.index - 1) };
}

export const termine = (e: EtatQuiz, questions: readonly Question[]) => e.index >= questions.length;
