// RG-5.5 / RG-5.6 : contenu du kit de départ (jenny + une carte de sort).
// Premier gain du joueur : la carte arrive de dos et se retourne, comme un tirage.
import { Carte, Concentration, DosCarte } from '@gq/ui';
import { numeroSort, SORTS } from '../lib/format';
import type { Kit as KitRecu } from './Inscription';

export function Kit({ kit, onSuite }: { kit: KitRecu; onSuite: () => void }) {
  const sort = SORTS[kit.sort];
  return (
    <div className="planche">
      <section className="gi-case gi-penchee kit-titre">
        <h1 className="titre-ecran">Bienvenue sur Greed Island</h1>
      </section>
      <section className="gi-case kit-scene" aria-label={`Carte de sort reçue : ${sort.nom}`}>
        <Concentration graine={5} />
        <div className="kit-carte">
          <Carte genre="sort" numero={numeroSort(sort.numero)} nom={sort.nom} texte={sort.effet} />
          <DosCarte />
        </div>
        <p className="recitatif">Ta première carte de sort. Elle t’attend dans les emplacements libres de ton Book.</p>
      </section>
      <section className="gi-case kit-jenny">
        <span>Jenny de départ</span>
        <b>
          {kit.jenny + kit.rattrapage}
          <small>J</small>
        </b>
        {kit.rattrapage > 0 && <p className="doux">dont {kit.rattrapage} J de rattrapage</p>}
      </section>
      <button className="gi-btn-encre" onClick={onSuite}>
        Continuer
      </button>
    </div>
  );
}
