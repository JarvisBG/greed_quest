// RG-5.3 : Examen Hunter, 3 questions, non bloquant ; chaque bonne réponse rapporte des jenny.
import { Concentration, Dialogue } from '@gq/ui';
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

export function Examen({
  partieId,
  questions,
  onReporter,
  onBonus,
  onFini,
}: {
  partieId: string;
  questions: readonly Question[];
  onReporter?: () => void;
  /** Bonus crédité par le serveur : la barre du haut le montre tout de suite. */
  onBonus: (bonus: number) => void;
  onFini: () => void;
}) {
  const [commence, setCommence] = useState(false);
  const [resultat, setResultat] = useState<Resultat | null>(null);

  if (resultat) {
    return (
      <div className="planche">
        <section className={`gi-case examen-score${resultat.bonnes > 0 ? ' reussi' : ''}`}>
          {resultat.bonnes > 0 && <Concentration graine={23} />}
          <h1 className="titre-ecran">Examen Hunter</h1>
          <p className="score" aria-label={`${resultat.bonnes} bonnes réponses sur ${questions.length}`}>
            {resultat.bonnes}
            <span>/{questions.length}</span>
          </p>
          {resultat.bonus > 0 ? (
            <p className="tampon">+{resultat.bonus} J</p>
          ) : (
            <p className="recitatif">Pas de jenny cette fois. Le corrigé t’aidera sur le terrain.</p>
          )}
        </section>
        <section className="gi-case">
          <h2 className="sous-titre">Corrigé</h2>
          <ul className="corrige">
            {questions.map((q, i) => {
              const bonne = resultat.corrige[i] ?? -1;
              const donnee = resultat.reponses[i] ?? -1;
              const juste = donnee === bonne;
              return (
                <li key={q.id} className={juste ? 'juste' : 'faux'}>
                  {juste ? <IconeJuste /> : <IconeFaux />}
                  <div>
                    <p>
                      <span className="sr">{juste ? 'Juste : ' : 'Faux : '}</span>
                      {q.texte}
                    </p>
                    <p className="bonne">{q.choix[bonne]}</p>
                    {!juste && q.choix[donnee] && <p className="donnee">Ta réponse : <s>{q.choix[donnee]}</s></p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
        <button className="gi-btn-encre" onClick={onFini}>
          Continuer
        </button>
      </div>
    );
  }

  if (!commence) {
    return (
      <div className="planche">
        <section className="gi-case gi-penchee examen-titre">
          <h1>Examen Hunter</h1>
        </section>
        <Dialogue qui="Examinateur">
          {questions.length} questions sur les règles du jeu. Chaque bonne réponse rapporte des jenny. Une seule tentative.
        </Dialogue>
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
        if (r.bonus > 0) onBonus(r.bonus);
      }}
    />
  );
}
