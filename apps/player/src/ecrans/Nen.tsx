// RG-5.4 : test de Nen, 5 questions → un des 6 types (Spécialisation rare, tirée par le serveur).
import type { NenType } from '@gq/shared';
import { useState } from 'react';
import { api } from '../lib/client';
import { NENS } from '../lib/format';
import type { Question } from '../lib/quiz';
import { Questionnaire } from './Questionnaire';

export function Nen({ partieId, questions, onFini }: { partieId: string; questions: readonly Question[]; onFini: () => void }) {
  const [commence, setCommence] = useState(false);
  const [nen, setNen] = useState<NenType | null>(null);

  if (nen) {
    const n = NENS[nen];
    return (
      <div className="carte revelation">
        <p className="info">Ton type de Nen</p>
        <h1 className="nen">{n.nom}</h1>
        <p>{n.passif}</p>
        <button onClick={onFini}>Commencer à jouer</button>
      </div>
    );
  }

  if (!commence) {
    return (
      <div className="carte">
        <h1>Test de Nen</h1>
        <p>{questions.length} questions pour découvrir ton type de Nen. Il te donne un pouvoir passif pour toute la partie.</p>
        <button onClick={() => setCommence(true)}>Commencer</button>
      </div>
    );
  }

  return (
    <Questionnaire
      titre="Test de Nen"
      questions={questions}
      onFini={async (reponses) => {
        const r = await api.post<{ nen: NenType }>(`/parties/${partieId}/nen`, { reponses });
        setNen(r.nen);
      }}
    />
  );
}
