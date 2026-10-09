// RG-12 : raid. Tous les joueurs répondent à des questions ; chaque bonne réponse retire des PV au
// boss (barre de vie partagée, mise à jour en direct). Une seule réponse par question et par joueur.
import { useEffect, useState } from 'react';
import { ApiError } from '../lib/api';
import { api } from '../lib/client';
import type { Question } from '../lib/quiz';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function Raid({ partieId, pv, pvMax, onRetour }: { partieId: string; pv: number; pvMax: number; onRetour: () => void }) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [repondues, setRepondues] = useState<Record<string, boolean | null>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [vaincu, setVaincu] = useState(false);

  useEffect(() => {
    api.get<{ questions: Question[] }>(`/parties/${partieId}/raid`).then((r) => setQuestions(r.questions), (e: unknown) => setErreur(message(e)));
  }, [partieId]);

  const repondre = async (q: Question, choix: number) => {
    setErreur(null);
    try {
      const r = await api.post<{ correcte: boolean; vaincu: boolean }>(`/parties/${partieId}/raid/reponse`, { questionId: q.id, choix });
      setRepondues((x) => ({ ...x, [q.id]: r.correcte }));
      if (r.vaincu) setVaincu(true);
    } catch (e) {
      // Déjà répondu (autre appareil, rechargement) : la question est close.
      if (e instanceof ApiError && e.code === 'deja_repondu') setRepondues((x) => ({ ...x, [q.id]: null }));
      else setErreur(message(e));
    }
  };

  const suivante = questions?.find((q) => !(q.id in repondues));
  return (
    <div className="raid">
      <button className="lien" onClick={onRetour}>
        ‹ Retour
      </button>
      <div className="carte">
        <h1>Raid</h1>
        <div className="jauge vie" role="progressbar" aria-valuemin={0} aria-valuemax={pvMax} aria-valuenow={pv} aria-label="Points de vie du boss">
          <span style={{ width: `${pvMax > 0 ? (pv / pvMax) * 100 : 0}%` }} />
        </div>
        <p className="info">
          Boss : {pv}/{pvMax} PV. Chaque bonne réponse l’affaiblit.
        </p>
      </div>
      {vaincu || pv <= 0 ? (
        <div className="carte resultat">
          <p>Le boss est vaincu ! Les récompenses arrivent.</p>
        </div>
      ) : suivante ? (
        <div className="carte">
          <h2>{suivante.texte}</h2>
          <div className="choix">
            {suivante.choix.map((c, i) => (
              <button key={i} className="secondaire" onClick={() => void repondre(suivante, i)}>
                {c}
              </button>
            ))}
          </div>
        </div>
      ) : (
        questions && <p className="info">Tu as répondu à toutes les questions. Encourage les autres !</p>
      )}
      <p className="info">
        {Object.values(repondues).filter((v) => v === true).length} bonne(s) réponse(s) sur {Object.keys(repondues).length}
      </p>
      {erreur && <p className="erreur">{erreur}</p>}
    </div>
  );
}
