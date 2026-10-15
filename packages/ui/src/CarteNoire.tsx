// Carte de Maître du jeu (RG-8.15, amendement du 2026-10-15) : cadre d'encre filé d'or, photo du créateur entière
// (9:16) sur toute la hauteur, nom en lettres d'or le long du bord gauche, numéro « GM·01 · GM-1 » à droite.
// Pas de texte d'effet sur la carte (demande de Sivraj : la photo passe avant les mots) ; il est dans la fiche.
import { NOMS_CARTES_GM, type CarteGm } from '@gq/shared';

const PHOTOS = import.meta.glob<string>('./cartes/gm/*.webp', { eager: true, query: '?url', import: 'default' });
export const photoCarteGm = (gm: CarteGm): string | undefined => PHOTOS[`./cartes/gm/${gm}.webp`];

export function CarteNoire({ gm, className }: { gm: CarteGm; className?: string }) {
  const d = NOMS_CARTES_GM[gm];
  return (
    <div className={`gi-carte f-gm${className ? ` ${className}` : ''}`} role="img" aria-label={`${d.nom}, carte de Maître du jeu`}>
      <div className="c-cadre">
        <span className="gm-cote g" aria-hidden="true">
          <span className="long">{d.nom}</span>
          <span className="court">{d.court}</span>
        </span>
        <span className="gm-photo">
          <img src={photoCarteGm(gm)} alt="" decoding="async" draggable={false} />
        </span>
        <span className="gm-cote d" aria-hidden="true">
          {d.numero} · GM-1
        </span>
      </div>
    </div>
  );
}
