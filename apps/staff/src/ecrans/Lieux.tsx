// Lieux de l'arbitre : checkpoints, arène de Soufrabi, enchères d'Antokiba, missions secrètes.
import { useState } from 'react';
import type { Equipe } from '../lib/useEquipe';
import { Arene } from './Arene';
import { Checkpoints } from './Checkpoints';
import { Encheres } from './Encheres';
import { Missions } from './Missions';

const LIEUX = [
  { id: 'checkpoints', libelle: 'Checkpoints' },
  { id: 'arene', libelle: 'Arène' },
  { id: 'encheres', libelle: 'Enchères' },
  { id: 'missions', libelle: 'Missions' },
] as const;
type Lieu = (typeof LIEUX)[number]['id'];

export function Lieux({ eq }: { eq: Equipe }) {
  const [lieu, setLieu] = useState<Lieu>('checkpoints');
  return (
    <section className="pile">
      <div className="sous-onglets" role="tablist">
        {LIEUX.map((l) => (
          <button key={l.id} type="button" role="tab" aria-selected={lieu === l.id} className={`secondaire ${lieu === l.id ? 'choisi' : ''}`} onClick={() => setLieu(l.id)}>
            {l.libelle}
          </button>
        ))}
      </div>
      {lieu === 'checkpoints' && <Checkpoints eq={eq} />}
      {lieu === 'arene' && <Arene eq={eq} />}
      {lieu === 'encheres' && <Encheres eq={eq} />}
      {lieu === 'missions' && <Missions eq={eq} />}
    </section>
  );
}
