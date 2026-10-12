// Page ⑪ (décision de Sivraj du 2026-10-12) : gelé par un sort (Gel, ou Accompagnement qui gèle aussi), un bandeau
// givré sous la barre du haut, sur toutes les pages, avec le décompte ; l'onglet Scanner est givré aussi. Il disparaît
// à la fin du gel (RG-10, amendement 2026-10-10 pour l'Accompagnement).
import { useEffect, useState, type CSSProperties } from 'react';
import type { Moi } from '../../lib/useJeu';
import { minSec } from './FicheSort';
import { GIVRE } from './Lancer';

/** Le givre de la cinématique, tracé en bleu-gris sur le papier (motif de fond du bandeau et de l'onglet). */
const MOTIF = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100"><g fill="none" stroke="#7d9cb8" stroke-linecap="round" stroke-width="1.1"><path d="${GIVRE}"/><path transform="rotate(180)" d="${GIVRE}"/></g></svg>`,
)}")`;
export const styleGivre = { ['--givre-motif' as string]: MOTIF } as CSSProperties;

/** Gel restant (ms) : Gel ou Accompagnement subi, décompté depuis la réception du profil ; rafraîchi chaque seconde. */
export function useGel(moi: Moi | null): number {
  const [, battre] = useState(0);
  const total = moi ? Math.max(moi.delais.gel, moi.accompagne) : 0;
  // L'heure est lue à chaque rendu (leçon de la page ⑨) ; la minuterie ne sert qu'à redessiner.
  const reste = moi && total > 0 ? Math.max(0, total - (Date.now() - moi.recuA)) : 0;
  useEffect(() => {
    if (!moi || total <= 0) return;
    const t = setInterval(() => battre((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [moi, total]);
  return reste;
}

export function BandeauGel({ moi, par }: { moi: Moi; par: { pseudo: string; accompagnement: boolean } | null }) {
  const reste = useGel(moi);
  if (reste <= 0) return null;
  const suivi = moi.accompagne - (Date.now() - moi.recuA) > 0;
  const qui = par?.pseudo;
  return (
    <div className="gel-bandeau" role="status" style={styleGivre}>
      <span className="mot" aria-hidden="true">
        GELÉ
      </span>
      <span className="dit">
        {suivi ? (qui ? `${qui} voit où tu es` : 'Ta position est suivie') : qui ? `${qui} t’a gelé` : 'Tu es gelé'}
        <small>{suivi ? 'Gelé : plus de scan, ta position est suivie' : 'Plus de scan jusqu’à la fin'}</small>
      </span>
      <span className="temps" aria-label={`encore ${minSec(reste)}`}>
        {minSec(reste)}
      </span>
    </div>
  );
}
