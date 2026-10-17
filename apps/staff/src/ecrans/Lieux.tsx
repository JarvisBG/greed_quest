// Lieux de l'arbitre : checkpoints, puis (à venir dans ce même onglet) arène, enchères et missions.
import type { Equipe } from '../lib/useEquipe';
import { Checkpoints } from './Checkpoints';

export function Lieux({ eq }: { eq: Equipe }) {
  return <Checkpoints eq={eq} />;
}
