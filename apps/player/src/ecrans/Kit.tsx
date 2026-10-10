// RG-5.5 / RG-5.6 : contenu du kit de départ (jenny + une carte de sort).
import { Carte } from '@gq/ui';
import { numeroSort, SORTS } from '../lib/format';
import type { Kit as KitRecu } from './Inscription';

export function Kit({ kit, onSuite }: { kit: KitRecu; onSuite: () => void }) {
  const sort = SORTS[kit.sort];
  return (
    <div className="planche">
      <section className="gi-case">
        <h1 className="titre-ecran">Bienvenue sur Greed Island</h1>
        <p className="texte-grand">Voici ton kit de départ.</p>
        <div className="kit-grille">
          <div>
            <p className="montant">
              {kit.jenny + kit.rattrapage}
              <small>J</small>
            </p>
            {kit.rattrapage > 0 && <p className="doux">dont {kit.rattrapage} J de rattrapage</p>}
          </div>
          <Carte genre="sort" numero={numeroSort(sort.numero)} nom={sort.nom} texte={sort.effet} />
        </div>
        <p className="doux">La carte de sort est rangée dans les emplacements libres de ton Book.</p>
        <button className="gi-btn-encre" onClick={onSuite}>
          Continuer
        </button>
      </section>
    </div>
  );
}
