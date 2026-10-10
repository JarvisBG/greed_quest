// Questionnaire générique : une question par écran, envoi à la dernière réponse.
import { useState } from 'react';
import { precedente, quizInitial, repondre, termine, type Question } from '../lib/quiz';

const LETTRES = 'ABCDEF';

export function Questionnaire({ titre, questions, onFini }: { titre: string; questions: readonly Question[]; onFini: (reponses: number[]) => Promise<void> }) {
  const [etat, setEtat] = useState(quizInitial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const choisir = async (choix: number) => {
    const suivant = repondre(etat, choix);
    setEtat(suivant);
    if (!termine(suivant, questions)) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await onFini(suivant.reponses);
    } catch (e) {
      // Refus ou réseau : on reste sur la dernière question pour pouvoir renvoyer.
      setErreur(e instanceof Error ? e.message : String(e));
      setEtat(precedente(suivant));
    } finally {
      setEnvoi(false);
    }
  };

  const i = Math.min(etat.index, questions.length - 1);
  const q = questions[i];
  if (!q) return null;
  return (
    <div className="planche">
      <section className="gi-case">
        <p className="question-num">
          {titre} · question {i + 1} / {questions.length}
        </p>
        <div className="progression" aria-hidden="true">
          {questions.map((x, k) => (
            <i key={x.id} className={k < i ? 'fait' : ''} />
          ))}
        </div>
        <h1 className="question">{q.texte}</h1>
        <div className="reponses">
          {q.choix.map((c, k) => (
            <button key={k} className="reponse" aria-pressed={etat.reponses[i] === k} disabled={envoi} onClick={() => void choisir(k)}>
              <span className="lettre" aria-hidden="true">
                {LETTRES[k]}
              </span>
              {c}
            </button>
          ))}
        </div>
        {erreur && (
          <p className="erreur" role="alert">
            {erreur}
          </p>
        )}
        {i > 0 && !envoi && (
          <button className="gi-lien" onClick={() => setEtat(precedente(etat))}>
            Question précédente
          </button>
        )}
      </section>
    </div>
  );
}
