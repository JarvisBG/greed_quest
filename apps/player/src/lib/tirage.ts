// Cinématique du tirage (page ⑥, prototype validé le 2026-10-10 : docs/prototype/scanner-tirage.html).
// Logique pure : ce que montre chaque gain reçu du serveur (RG-8.3), et l'éclat de son rang.
// L'interface ne décide rien : elle met en scène les gains tels que le serveur les a tirés (P1).
import type { Rank } from '@gq/shared';
import { numeroCarte, numeroSort, OBJETS, SORTS } from './format';
import type { Gain } from './scan';

export type GenreTire = 'designee' | 'sort' | 'objet';

/** Carte à retourner à l'écran, prête pour le composant `Carte` de @gq/ui. */
export interface CarteTiree {
  genre: GenreTire;
  numero: string;
  nom: string;
  rang: Rank | null;
  limite: number | null;
  texte: string | null;
}

export type Etape = { type: 'carte'; carte: CarteTiree } | { type: 'jenny'; montant: number };

/**
 * Éclat d'un rang sur la nuit : couleur, attente avant le retournement (la lumière fuit des bords de la carte
 * encore de dos), nombre d'étincelles à l'impact, rayons, secousse (px), image inversée, double impact.
 * Plus le rang est haut, plus l'attente et l'éclat durent (D : aucune attente, SS : 1,4 s).
 */
export interface Eclat {
  couleur: string;
  attenteMs: number;
  etincelles: number;
  rayons: number;
  secousse: number;
  inverse: boolean;
  double: boolean;
}

export const ECLATS: Record<Rank | 'sort' | 'objet', Eclat> = {
  D: { couleur: '#e9ecf2', attenteMs: 0, etincelles: 40, rayons: 0, secousse: 0, inverse: false, double: false },
  C: { couleur: '#b7c8dc', attenteMs: 240, etincelles: 70, rayons: 0, secousse: 0, inverse: false, double: false },
  B: { couleur: '#7fd6ad', attenteMs: 420, etincelles: 100, rayons: 0, secousse: 3, inverse: true, double: false },
  A: { couleur: '#f2a26c', attenteMs: 650, etincelles: 150, rayons: 0.35, secousse: 5, inverse: true, double: false },
  S: { couleur: '#e6edf3', attenteMs: 950, etincelles: 220, rayons: 0.7, secousse: 7, inverse: true, double: false },
  SS: { couleur: '#f6d36b', attenteMs: 1400, etincelles: 320, rayons: 1, secousse: 10, inverse: true, double: true },
  sort: { couleur: '#8fb2ff', attenteMs: 320, etincelles: 100, rayons: 0, secousse: 3, inverse: true, double: false },
  objet: { couleur: '#f2c84b', attenteMs: 320, etincelles: 100, rayons: 0, secousse: 3, inverse: true, double: false },
};

export const eclatDe = (c: CarteTiree): Eclat => ECLATS[c.genre === 'designee' ? c.rang ?? 'D' : c.genre];

/** Mot frappé en tampon derrière la carte : la lettre du rang, ou « SORT » / « OBJET ». */
export const tamponDe = (c: CarteTiree): string => (c.genre === 'designee' ? c.rang ?? '' : c.genre === 'sort' ? 'SORT' : 'OBJET');

/** RG-8.3 : un gain du serveur devient une étape de la cinématique (carte à retourner ou jenny). */
export function etapeDuGain(g: Gain): Etape {
  switch (g.kind) {
    case 'carte':
      return {
        type: 'carte',
        carte: { genre: 'designee', numero: numeroCarte(g.numero ?? null), nom: g.nom, rang: g.rang, limite: g.limite ?? null, texte: g.texte ?? null },
      };
    case 'sort': {
      const s = SORTS[g.sort];
      return { type: 'carte', carte: { genre: 'sort', numero: numeroSort(s.numero), nom: s.nom, rang: null, limite: null, texte: s.effet } };
    }
    case 'objet': {
      const o = OBJETS[g.objet];
      return { type: 'carte', carte: { genre: 'objet', numero: numeroSort(o.numero), nom: o.nom, rang: null, limite: null, texte: o.effet } };
    }
    case 'jenny':
      return { type: 'jenny', montant: g.montant };
  }
}

export const etapesDuTirage = (gains: Gain[]): Etape[] => gains.map(etapeDuGain);

/** Phrase de la boîte du jeu à la révélation. */
export function phraseGain(c: CarteTiree, secondSouffle = false): string {
  const avant = secondSouffle ? 'Second souffle utilisé. ' : '';
  const num = c.numero && c.numero !== '—' ? `${c.numero}, ` : '';
  if (c.genre === 'sort') return `${avant}Tu obtiens le sort ${num}${c.nom}.`;
  if (c.genre === 'objet') return `${avant}Tu obtiens l’objet ${num}${c.nom}.`;
  return `${avant}Tu obtiens la carte ${num}${c.nom}, rang ${c.rang}.`;
}

/** Onglet où la carte vole se ranger : les sorts avec les sorts, le reste dans le Book. */
export const ongletDe = (c: CarteTiree): 'livre' | 'sorts' => (c.genre === 'sort' ? 'sorts' : 'livre');

export function indiceRangement(c: CarteTiree): string {
  if (c.genre === 'sort') return 'Touche l’écran pour le ranger avec tes sorts';
  return `Touche l’écran pour ${c.genre === 'objet' ? 'le' : 'la'} ranger dans ton Book`;
}
