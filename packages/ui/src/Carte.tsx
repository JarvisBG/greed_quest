// Carte de Greed Island, dessinée une fois et réutilisée partout (joueur, console, écran géant) :
// numéro à trois chiffres en haut à gauche, nom au centre, rang-limite à droite (« A-3 »), illustration, texte en bas.
// Cadre rouge = carte désignée (à collectionner, sans effet), bleu = sort, jaune = objet. RG-8.1, RG-8.2.
import type { Rank } from '@gq/shared';
import type { ReactNode } from 'react';
import { EmblemeDos } from './Emblemes';

export type GenreCarte = 'designee' | 'sort' | 'objet';

export const numeroCarte = (n: number | null | undefined) => (n === null || n === undefined ? '???' : String(n).padStart(3, '0'));

export function Rang({ rang, limite, seul }: { rang: Rank | null; limite?: number | null; seul?: boolean }) {
  if (!rang) return null;
  return (
    <span className={`gi-rang r-${rang}${seul ? ' seul' : ''}`} aria-label={`rang ${rang}${limite ? `, ${limite} exemplaires au plus` : ''}`}>
      {rang}
      {limite ? <span className="lim">-{limite}</span> : null}
    </span>
  );
}

export interface CarteProps {
  genre: GenreCarte;
  numero: number | string | null;
  nom: string;
  rang?: Rank | null;
  limite?: number | null;
  texte?: string | null;
  /** Illustration ; à défaut, le numéro en filigrane sur la trame (en attendant la banque d'images). */
  illustration?: ReactNode;
  /** Contrefaçon démasquée (RG-8.9) : grisée et hachurée. */
  grisee?: boolean;
  className?: string;
}

export function Carte({ genre, numero, nom, rang = null, limite = null, texte = null, illustration, grisee, className }: CarteProps) {
  const num = typeof numero === 'string' ? numero : numeroCarte(numero);
  const coin = genre === 'sort' ? <span className="gi-rang r-sort">Sort</span> : genre === 'objet' ? <span className="gi-rang r-objet">Objet</span> : <Rang rang={rang} limite={limite} />;
  return (
    <div className={`gi-carte f-${genre}${grisee ? ' grisee' : ''}${className ? ` ${className}` : ''}`}>
      <div className="c-cadre">
        <div className="c-tete">
          <span className="c-num">{num}</span>
          <span className="c-nom">{nom}</span>
          {coin}
        </div>
        <div className="c-art" aria-hidden="true">
          {illustration ?? <span className="c-filigrane">{genre === 'designee' ? num : genre === 'sort' ? 'S' : 'O'}</span>}
        </div>
        {texte && <p className="c-txt">{texte}</p>}
      </div>
    </div>
  );
}

export function DosCarte({ className }: { className?: string }) {
  return (
    <div className={`gi-carte dos${className ? ` ${className}` : ''}`} aria-hidden="true">
      <div className="c-cadre">
        <EmblemeDos />
      </div>
    </div>
  );
}
