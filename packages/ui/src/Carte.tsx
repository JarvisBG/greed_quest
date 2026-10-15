// Carte de Greed Island, dessinée une fois et réutilisée partout (joueur, console, écran géant) :
// numéro à trois chiffres en haut à gauche, nom au centre, rang-limite à droite (« A-3 »), illustration, texte en bas.
// Cadre rouge = carte désignée (à collectionner, sans effet), bleu = sort, jaune = objet. RG-8.1, RG-8.2.
// Illustration : celle de la carte officielle (fenêtre 16:9, décidé le 2026-10-15), retrouvée par son numéro de l'anime.
import { BANQUE_CARTES, type Rank } from '@gq/shared';
import type { ReactNode } from 'react';
import { EmblemeDos } from './Emblemes';

export type GenreCarte = 'designee' | 'sort' | 'objet';

export const numeroCarte = (n: number | null | undefined) => (n === null || n === undefined ? '???' : String(n).padStart(3, '0'));

/** Illustrations des cartes officielles, nommées par numéro de l'anime (`017.webp`, `1007.webp`). */
const IMAGES = import.meta.glob<string>('./cartes/*.webp', { eager: true, query: '?url', import: 'default' });
const imageNumero = (n: number): string | null => IMAGES[`./cartes/${n >= 1000 ? n : String(n).padStart(3, '0')}.webp`] ?? null;

/**
 * Créations sans numéro de l'anime : illustration empruntée à une carte de l'anime, retrouvée par le nom.
 * Gel ← Stone Throw (1028), Boussole ← Magnetic Force (1005), Second souffle ← Recycle (1037), Pépite ← 10000J (607).
 */
const CREATIONS: Record<string, string> = { gel: 'gel', 'boussole du chercheur': 'boussole', 'second souffle': 'souffle', "pépite d'or": 'pepite' };
const imageCreation = (nom: string): string | null => {
  const f = CREATIONS[nom.toLowerCase().replace(/’/g, "'").trim()];
  return f ? (IMAGES[`./cartes/${f}.webp`] ?? null) : null;
};

/**
 * Illustration d'une carte, ou `null` (filigrane). Une carte désignée n'a son image que si elle est bien celle de la
 * banque à ce numéro (un catalogue composé à la main peut numéroter ses cartes 001..N, RG-8.1) ; une contrefaçon
 * démasquée (« Contrefaçon de … ») garde l'image de la carte imitée. Sorts et objets : numéro de l'anime (1001 et plus).
 */
export function imageCarte(genre: GenreCarte, numero: number | string | null | undefined, nom: string): string | null {
  const n = typeof numero === 'string' ? Number(numero) : numero;
  if (n === null || n === undefined || !Number.isInteger(n)) return genre === 'designee' ? null : imageCreation(nom);
  if (genre !== 'designee') return n >= 1000 ? imageNumero(n) : imageCreation(nom);
  const b = BANQUE_CARTES.find((x) => x.numero === n);
  return b && nom.toLowerCase().includes(b.nom.toLowerCase()) ? imageNumero(n) : null;
}

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
  /** Illustration imposée ; à défaut, celle de la carte officielle, sinon le numéro en filigrane sur la trame. */
  illustration?: ReactNode;
  /** Contrefaçon démasquée (RG-8.9) : grisée et hachurée. */
  grisee?: boolean;
  className?: string;
}

export function Carte({ genre, numero, nom, rang = null, limite = null, texte = null, illustration, grisee, className }: CarteProps) {
  const num = typeof numero === 'string' ? numero : numeroCarte(numero);
  const coin = genre === 'sort' ? <span className="gi-rang r-sort">Sort</span> : genre === 'objet' ? <span className="gi-rang r-objet">Objet</span> : <Rang rang={rang} limite={limite} />;
  const image = illustration === undefined ? imageCarte(genre, numero, nom) : null;
  return (
    <div className={`gi-carte f-${genre}${grisee ? ' grisee' : ''}${className ? ` ${className}` : ''}`}>
      <div className="c-cadre">
        <div className="c-tete">
          <span className={`c-num${num.length > 3 ? ' long' : ''}`}>{num}</span>
          <span className={`c-nom${nom.length > 10 ? ' long' : ''}`}>{nom}</span>
          {coin}
        </div>
        <div className="c-art" aria-hidden="true">
          {illustration ?? (image ? <img src={image} alt="" decoding="async" draggable={false} /> : <span className="c-filigrane">{genre === 'designee' ? num : genre === 'sort' ? 'S' : 'O'}</span>)}
          {/* Sort ou objet vu petit (pochette) : le nom, que la tête n'a plus la place d'écrire. */}
          {genre !== 'designee' && <span className="c-nom-petit">{nom}</span>}
        </div>
        {/* Le panneau du bas existe toujours, comme sur une vraie carte ; vide quand il n'y a rien à dire. */}
        <div className="c-bas">{texte && <p className="c-txt">{texte}</p>}</div>
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
