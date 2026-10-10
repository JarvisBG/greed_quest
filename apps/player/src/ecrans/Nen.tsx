// RG-5.4 : test de Nen, 5 questions → un des 6 types (Spécialisation rare, tirée par le serveur),
// révélé par la divination de l'eau en plein écran (divination/Divination.tsx).
import type { NenType, PouvoirSpe } from '@gq/shared';
import { Dialogue } from '@gq/ui';
import { useState } from 'react';
import { api } from '../lib/client';
import type { Question } from '../lib/quiz';
import { Divination } from './divination/Divination';
import { Questionnaire } from './Questionnaire';

interface Resultat {
  nen: NenType;
  pouvoirSpe: PouvoirSpe | null;
}

export function Nen({ partieId, questions, onFini }: { partieId: string; questions: readonly Question[]; onFini: () => void }) {
  const [commence, setCommence] = useState(false);
  const [resultat, setResultat] = useState<Resultat | null>(null);

  if (resultat) return <Divination nen={resultat.nen} pouvoirSpe={resultat.pouvoirSpe} onFini={onFini} />;

  if (!commence) {
    return (
      <div className="planche">
        <section className="gi-case gi-penchee examen-titre">
          <h1>Test de Nen</h1>
        </section>
        <Dialogue qui="Wing">
          {questions.length} questions pour sentir ton aura, puis la divination par l’eau. Ton type de Nen te donne un pouvoir pour toute la partie.
        </Dialogue>
        <button className="gi-btn-encre" onClick={() => setCommence(true)}>
          Commencer le test
        </button>
      </div>
    );
  }

  return (
    <Questionnaire
      titre="Test de Nen"
      questions={questions}
      onFini={async (reponses) => {
        setResultat(await api.post<Resultat>(`/parties/${partieId}/nen`, { reponses }));
      }}
    />
  );
}
