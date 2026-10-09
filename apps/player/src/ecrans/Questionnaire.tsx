// Questionnaire générique : une question par écran, envoi à la dernière réponse.
import { useState } from 'react';
import { precedente, quizInitial, repondre, termine, type Question } from '../lib/quiz';

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

  const q = questions[Math.min(etat.index, questions.length - 1)];
  if (!q) return null;
  return (
    <div className="carte">
      <p className="info">
        {titre} · question {Math.min(etat.index + 1, questions.length)}/{questions.length}
      </p>
      <h1>{q.texte}</h1>
      <div className="choix">
        {q.choix.map((c, i) => (
          <button key={i} className={etat.reponses[etat.index] === i ? 'secondaire choisi' : 'secondaire'} disabled={envoi} onClick={() => void choisir(i)}>
            {c}
          </button>
        ))}
      </div>
      {erreur && <p className="erreur">{erreur}</p>}
      {etat.index > 0 && !envoi && (
        <button className="lien" onClick={() => setEtat(precedente(etat))}>
          Question précédente
        </button>
      )}
    </div>
  );
}
