// Page ⑭ (prototype docs/prototype/antokiba.html) : enchères d'Antokiba côté app, RG-11.4 / 11.5.
// Le serveur fait foi (P1) : ces fonctions ne font qu'afficher ce que GET /encheres et les évènements disent.
import type { Rank } from '@gq/shared';
import { minSec } from './boutique';
import { enPhrase } from './sorts';

/** Un lot de GET /parties/:id/encheres (et des évènements `enchere`). */
export interface Lot {
  id: string;
  carte: { id: string; numero: number | null; nom: string; rang: Rank; texte: string | null; limite: number | null };
  resteMs: number;
  prixDepart: number;
  meilleureOffre: { montant: number; pseudo: string; joueurId: string } | null;
  /** Absents des évènements `enchere` (publics) : gardés de la dernière lecture. */
  inscrit?: boolean;
  maOffre?: number | null;
}

/** Évènement `enchere_close` ; `enchere_gagnee` y ajoute la carte et la jenny du gagnant. */
export interface Cloture {
  id: string;
  vendue: boolean;
  pseudo?: string;
  joueurId?: string;
  prix?: number;
  carte?: string;
}
export interface Adjuge extends Cloture {
  lot: Lot['carte'];
  prix: number;
  jenny: number;
}

/** Offre minimale acceptable : la mise de départ, ou la meilleure offre + 1 J (RG-11.4). */
export const offreMin = (e: { prixDepart: number; meilleureOffre: { montant: number } | null }) =>
  e.meilleureOffre ? e.meilleureOffre.montant + 1 : e.prixDepart;

/** Montant de la palette : +1 / +5 / +10 au-dessus de la meilleure offre ; sans offre, le prix de départ. */
export const montantPalette = (l: Pick<Lot, 'prixDepart' | 'meilleureOffre'>, pas: number) => offreMin(l) + (l.meilleureOffre ? pas - 1 : 0);

export const jeMene = (l: Pick<Lot, 'meilleureOffre'>, moi: string) => l.meilleureOffre?.joueurId === moi;

export interface BoutonPalette {
  texte: string;
  actif: boolean;
  /** Pas encore inscrit et pas de QR : le bouton ouvre l'appareil photo. */
  qr: boolean;
  montant: number;
}

/** Le gros bouton porte la raison quand il est désactivé (tu mènes, jenny, fin du lot). */
export function boutonPalette(o: { lot: Lot; moi: string; pas: number; jenny: number; present: boolean; envoi: boolean; resteMs: number }): BoutonPalette {
  const { lot: l, jenny } = o;
  const montant = montantPalette(l, o.pas);
  if (o.envoi) return { texte: 'La palette se lève…', actif: false, qr: false, montant };
  if (o.resteMs <= 0) return { texte: 'Le commissaire-priseur clôt le lot…', actif: false, qr: false, montant };
  if (!l.inscrit && !o.present) return { texte: 'Participer · scanner le QR d’Antokiba', actif: true, qr: true, montant };
  if (jeMene(l, o.moi)) return { texte: `Tu mènes à ${l.meilleureOffre!.montant} J`, actif: false, qr: false, montant };
  const min = offreMin(l);
  if (min > jenny) return { texte: `Il te faudrait ${min} J : tu en as ${jenny}`, actif: false, qr: false, montant };
  if (montant > jenny) return { texte: `${montant} J, c’est plus que tes ${jenny} J`, actif: false, qr: false, montant };
  return { texte: `Lever la palette · ${montant} J`, actif: true, qr: false, montant };
}

/** Sous une vignette : « tu mènes », « dépassé », ou le décompte. */
export function etatVignette(l: Lot, moi: string, resteMs: number): { texte: string; genre: 'mene' | 'depasse' | null } {
  if (jeMene(l, moi)) return { texte: 'tu mènes', genre: 'mene' };
  if (l.maOffre != null) return { texte: 'dépassé', genre: 'depasse' };
  return { texte: minSec(resteMs), genre: null };
}

/** Boîte du jeu quand on est surenchéri hors de la page. */
export const texteSurencheri = (pseudo: string, montant: number, nomCarte: string, resteMs: number) =>
  `${pseudo} a surenchéri : ${montant} J sur ${enPhrase(nomCarte)} (${minSec(resteMs)}).`;

/** Boîte du jeu à la clôture d'un lot sur lequel on avait enchéri, sans le gagner. */
export function texteClotureAutre(c: Cloture, nomCarte: string): string {
  if (c.vendue) return `Adjugé à ${c.pseudo} pour ${c.prix} J. Tu ne paies rien.`;
  return `La vente de ${enPhrase(nomCarte)} n’a pas eu lieu : la carte retourne au stock du PNJ. Tu ne paies rien.`;
}

export const texteAdjuge = (nomCarte: string, prix: number) => `Adjugé ! Tu as remporté ${enPhrase(nomCarte)} pour ${prix} J.`;

/**
 * Un lot reçu remplace l'ancien : un évènement public (`enchere`) ne dit ni `inscrit` ni `maOffre`, on garde ceux de
 * la dernière lecture ; et si c'est moi qui mène, ma meilleure offre est la sienne.
 */
export function fusionnerLot(avant: Lot | undefined, l: Lot, moi: string): Lot {
  const inscrit = l.inscrit ?? avant?.inscrit ?? false;
  let maOffre = l.maOffre !== undefined ? l.maOffre : (avant?.maOffre ?? null);
  if (jeMene(l, moi)) maOffre = Math.max(maOffre ?? 0, l.meilleureOffre!.montant);
  return { ...l, inscrit: inscrit || maOffre !== null, maOffre };
}
