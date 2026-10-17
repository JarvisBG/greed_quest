// Carte de Maître du jeu (RG-8.15, amendement du 2026-10-15), « couverture de manga » (validée le 2026-10-17) :
// le dessin du créateur remplit la carte, titre vertical noir et or accroché en haut (nom court en grand, reste du
// nom en petit), hanko rouge au kanji de la carte, « GM·01 · GM-1 » au pied. Pas de texte d'effet sur la carte
// (demande de Sivraj : le dessin passe avant les mots) ; il est dans la fiche.
import { NOMS_CARTES_GM, type CarteGm } from '@gq/shared';

const PHOTOS = import.meta.glob<string>('./cartes/gm/*.webp', { eager: true, query: '?url', import: 'default' });
export const photoCarteGm = (gm: CarteGm): string | undefined => PHOTOS[`./cartes/gm/${gm}.webp`];

/** Kanji du hanko : 神 (dieu) pour Jarvis tout-puissant, 封 (sceau) pour Le Sceau d'Ange. */
const KANJI: Record<CarteGm, string> = { jarvis: '神', ange: '封' };

export function CarteNoire({ gm, className }: { gm: CarteGm; className?: string }) {
  const d = NOMS_CARTES_GM[gm];
  const i = d.nom.indexOf(d.court);
  const avant = d.nom.slice(0, i).trim();
  const apres = d.nom.slice(i + d.court.length).trim();
  return (
    <div className={`gi-carte f-gm gm-${gm}${className ? ` ${className}` : ''}`} role="img" aria-label={`${d.nom}, carte de Maître du jeu`}>
      <div className="c-cadre">
        <span className="gm-photo">
          <img src={photoCarteGm(gm)} alt="" decoding="async" draggable={false} />
        </span>
        <span className="gm-titre" aria-hidden="true">
          <span className="long">
            {avant && <small>{avant}</small>}
            <b>{d.court}</b>
            {apres && <small>{apres}</small>}
          </span>
          <span className="court">{d.court}</span>
        </span>
        <span className="gm-hanko" lang="ja" aria-hidden="true">
          {KANJI[gm]}
        </span>
        <span className="gm-pied" aria-hidden="true">
          <span>{d.numero}</span>
          <span>GM-1</span>
        </span>
      </div>
    </div>
  );
}
