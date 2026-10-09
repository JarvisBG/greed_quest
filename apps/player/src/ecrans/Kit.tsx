// RG-5.5 / RG-5.6 : contenu du kit de départ.
import { SORTS } from '../lib/format';
import type { Kit as KitRecu } from './Inscription';

export function Kit({ kit, onSuite }: { kit: KitRecu; onSuite: () => void }) {
  const sort = SORTS[kit.sort];
  return (
    <div className="carte">
      <h1>Bienvenue, Hunter</h1>
      <p>Ton kit de départ :</p>
      <ul className="liste">
        <li>
          <strong>{kit.jenny} J</strong>
        </li>
        {kit.rattrapage > 0 && (
          <li>
            <strong>+{kit.rattrapage} J</strong> de rattrapage (inscription en cours de partie)
          </li>
        )}
        <li>
          Sort <strong>{sort.nom}</strong> : {sort.effet}
        </li>
      </ul>
      <button onClick={onSuite}>Continuer</button>
    </div>
  );
}
