// RG-5.3 : Examen Hunter, 3 questions, non bloquant ; chaque bonne réponse rapporte des jenny.
import { useState } from 'react';
import { api } from '../lib/client';
import type { Question } from '../lib/quiz';
import { IconeFaux, IconeJuste } from './Icones';
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
    return (
      <div className="planche">
        <section className="gi-case gi-trame">
          <h1 className="titre-ecran">Examen Hunter</h1>
          <p className="score" aria-label={`${resultat.bonnes} bonnes réponses sur ${questions.length}`}>
            {resultat.bonnes} / {questions.length}
          </p>
          <p className="texte-grand">{resultat.bonus > 0 ? `+${resultat.bonus} J ajoutés à ta bourse.` : 'Pas de bonus cette fois.'}</p>
        </section>
        <section className="gi-case">
          <h2 className="sous-titre">Corrigé</h2>
          <ul className="corrige">
            {questions.map((q, i) => {
              const bonne = resultat.corrige[i] ?? -1;
              const juste = resultat.reponses[i] === bonne;
              return (
                <li key={q.id} className={juste ? 'juste' : 'faux'}>
                  {juste ? <IconeJuste /> : <IconeFaux />}
                  <span>
                    <span className="sr">{juste ? 'Juste : ' : 'Faux : '}</span>
                    {q.texte} <strong>{q.choix[bonne]}</strong>
                  </span>
                </li>
              );
            })}
          </ul>
          <button className="gi-btn-encre" onClick={onFini}>
            Continuer
          </button>
        </section>
      </div>
    );
  }

  if (!commence) {
    return (
      <div className="planche">
        <section className="gi-case gi-trame">
          <h1 className="titre-ecran">Examen Hunter</h1>
          <p className="texte-grand">
            {questions.length} questions sur les règles. Chaque bonne réponse rapporte des jenny. Tu ne peux le passer qu’une fois.
          </p>
        </section>
        <div className="actions">
          <button className="gi-btn-encre" onClick={() => setCommence(true)}>
            Commencer l’Examen
          </button>
          {onReporter && (
            <button className="gi-btn-trait" onClick={onReporter}>
              Plus tard
            </button>
          )}
        </div>
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
