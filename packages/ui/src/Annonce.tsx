// La voix de Greed Island : annonce système en boîte de dialogue de console (sort reçu, évènement, sanction).
// Le texte s'écrit lettre par lettre (sauf mouvement réduit) ; un toucher ferme ; fermeture seule après quelques secondes.
import { useEffect, useState, type ReactNode } from 'react';

export type GenreAnnonce = 'sort' | 'evenement' | 'sanction' | 'info';

export interface AnnonceProps {
  /** Change à chaque nouvelle annonce (rejoue l'entrée et la frappe). */
  cle: number | string;
  genre: GenreAnnonce;
  qui: string;
  texte: string;
  onFermer: () => void;
  /** Action liée (« Voir »), facultative. */
  action?: ReactNode;
  dureeMs?: number;
}

const reduit = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Annonce({ cle, genre, qui, texte, onFermer, action, dureeMs = 7000 }: AnnonceProps) {
  const [visible, setVisible] = useState(false);
  const [n, setN] = useState(0);

  useEffect(() => {
    setN(reduit() ? texte.length : 0);
    const entree = requestAnimationFrame(() => setVisible(true));
    const fin = setTimeout(() => setVisible(false), dureeMs);
    const ferme = setTimeout(onFermer, dureeMs + 500);
    return () => {
      cancelAnimationFrame(entree);
      clearTimeout(fin);
      clearTimeout(ferme);
    };
    // une annonce = une clé
  }, [cle]);

  useEffect(() => {
    if (n >= texte.length) return;
    const t = setTimeout(() => setN((x) => x + 1), 22);
    return () => clearTimeout(t);
  }, [n, texte]);

  return (
    <div className={`gi-annonce t-${genre}${visible ? ' visible' : ''}`} role="alert" aria-label={`${qui} : ${texte}`}>
      <span className="a-qui">{qui}</span>
      <span className="a-texte" aria-hidden="true">
        {texte.slice(0, n)}
      </span>
      <div className="a-actions">
        {action}
        <button
          onClick={() => {
            setVisible(false);
            setTimeout(onFermer, 300);
          }}
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

/** Réplique posée dans la page, dans la boîte de dialogue du jeu (consigne d'un examinateur, d'un PNJ). */
export function Dialogue({ qui, children }: { qui: string; children: ReactNode }) {
  return (
    <div className="gi-dialogue">
      <span className="a-qui">{qui}</span>
      <p className="a-texte">{children}</p>
    </div>
  );
}
