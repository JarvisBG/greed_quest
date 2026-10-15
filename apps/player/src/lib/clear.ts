// Page ⑰ Clear (RG-13.1 à 13.3) : état lu côté joueur (GET /clear), choix des 3 lots, textes dits par le jeu.
// Le serveur décide de tout ; ici, seulement la présentation et le choix en cours avant l'envoi.
import type { Rank } from '@gq/shared';
import { enListe } from './boutique';
import { enPhrase } from './sorts';

/** Carte désignée du gagnant et son lot réel (RG-13.3), fixé par l'organisateur dans le catalogue. */
export interface LotCarte {
  carteId: string;
  numero: number;
  nom: string;
  rang: Rank;
  texte: string | null;
  lotReel: string | null;
}

export type EtatClear =
  | { etat: 'aucun' | 'declare'; gagnant: null }
  | { etat: 'autre'; gagnant: string }
  | { etat: 'gagne'; gagnant: string; lots: (LotCarte & { itemId: string })[]; recompenses: LotCarte[] | null };

/** Cinématiques de la page : sceau du Clear déclaré, refus du GM, Book en gloire du gagnant, annonce aux autres. */
export type CineClear = { type: 'sceau' } | { type: 'refus'; motif: string } | { type: 'gloire' } | { type: 'autre'; pseudo: string };

export const NB_LOTS = 3;

/** Le lot réel tel qu'il s'affiche ; sans lot fixé, l'organisateur décidera. */
export const libelleLot = (l: { lotReel: string | null }) => l.lotReel ?? 'Lot à voir avec l’organisateur';

/** Toucher une carte : elle rejoint les lots (s'il reste une place) ou les quitte ; l'ordre des autres est gardé. */
export function basculer(choix: readonly string[], itemId: string): string[] {
  if (choix.includes(itemId)) return choix.filter((x) => x !== itemId);
  return choix.length < NB_LOTS ? [...choix, itemId] : [...choix];
}

/** Texte du bouton de validation : ce qu'il reste à choisir, puis la validation. */
export function texteValider(n: number): string {
  const reste = NB_LOTS - n;
  return reste > 0 ? `Choisis encore ${reste} carte${reste > 1 ? 's' : ''}` : `Valider mes ${NB_LOTS} lots`;
}

/** Confirmation avant l'envoi : le choix est définitif. */
export const texteDefinitif = (noms: string[]) => `C’est définitif : ${enListe(noms.map(enPhrase))} deviennent tes lots.`;

/** Motif du GM suivi de la suite, sans double ponctuation. */
export function texteRefus(motif: string): string {
  const m = motif.trim();
  const fin = m && !/[.!?…]$/.test(m) ? `${m}.` : m;
  return `${fin ? `${fin} ` : ''}Ton Book est dégelé : tu peux de nouveau jouer.`;
}

/** Grille des pochettes du Book de la cinématique : n cartes + l'emblème, en colonnes lisibles. */
export const colonnesGloire = (n: number) => (n + 1 <= 15 ? 3 : n + 1 <= 24 ? 4 : 5);
