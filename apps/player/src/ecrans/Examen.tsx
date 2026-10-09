// RG-5.3 : Examen Hunter, 3 questions, non bloquant ; chaque bonne réponse rapporte des jenny.
import { useState } from 'react';
import { api } from '../lib/client';
import type { Question } from '../lib/quiz';
import { Questionnaire } from './Questionnaire';

interface Resultat {
  bonnes: number;
  bonus: number;
  corrige: number[];
  reponses: number[];
}

export function Examen({ partieId, questions, onReporter, onFini }: { partieId: string; questions: readonly Question[]; onReporter?: () => void; onFini: () => void }) {
  const [commence, setCommence] = useState(false);
  const [resultat, setResultat] = useState<Resultat | null>(null);

  if (resultat) {
    const s = resultat.bonnes > 1 ? 's' : '';
    return (
      <div className="carte">
        <h1>
          {resultat.bonnes}/{questions.length} bonne{s} réponse{s}
        </h1>
        <p>{resultat.bonus > 0 ? `+${resultat.bonus} J ajoutés à ta bourse.` : 'Pas de bonus cette fois.'}</p>
        <ul className="liste">
          {questions.map((q, i) => {
            const bonne = resultat.corrige[i] ?? -1;
            const juste = resultat.reponses[i] === bonne;
            return (
              <li key={q.id}>
                <span className={juste ? 'ok' : 'ko'}>{juste ? '✓' : '✗'}</span> {q.texte} <strong>{q.choix[bonne]}</strong>
              </li>
            );
          })}
        </ul>
        <button onClick={onFini}>Continuer</button>
      </div>
    );
  }

  if (!commence) {
    return (
      <div className="carte">
        <h1>Examen Hunter</h1>
        <p>{questions.length} questions sur les règles. Chaque bonne réponse rapporte des jenny. Tu ne peux le passer qu’une fois.</p>
        <button onClick={() => setCommence(true)}>Commencer</button>
        {onReporter && (
          <button className="secondaire" onClick={onReporter}>
            Plus tard
          </button>
        )}
      </div>
    );
  }

  return (
    <Questionnaire
      titre="Examen Hunter"
      questions={questions}
      onFini={async (reponses) => {
        const r = await api.post<Omit<Resultat, 'reponses'>>(`/parties/${partieId}/examen`, { reponses });
        setResultat({ ...r, reponses });
      }}
    />
  );
}
