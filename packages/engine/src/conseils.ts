// Conseils d'organisation affichés au GM pendant la préparation (calibrage validé le 2026-10-09,
// docs/SIMULATION.md). Ce sont des recommandations : rien n'est bloqué.
import type { Rank } from '@gq/shared';

/** Balises à poser par joueur attendu : au-delà, trop de scans tombent sur des balises dormantes. */
export const BALISES_PAR_JOUEUR = 0.75;
export const BALISES_MIN = 10;
/** Un checkpoint PNJ pour 10 joueurs attendus. */
export const JOUEURS_PAR_CHECKPOINT = 10;
/**
 * Cartes de checkpoint par joueur attendu. Objectif « Clear possible » (décision 2026-10-09) : ≈ 2,5
 * (scénario « animation active » de SIMULATION.md ; 1,5 suffisait pour un jeu au classement).
 */
export const CARTES_CHECKPOINT_PAR_JOUEUR = 2.5;
/** Proportions des rangs dans le stock des checkpoints. */
export const RANGS_CHECKPOINT: Readonly<Partial<Record<Rank, number>>> = { B: 50, A: 35, S: 15 };

export interface ConseilOrganisation {
  balises: number;
  checkpoints: number;
  /** Stock conseillé pour chaque checkpoint, par rang. */
  stockParCheckpoint: Partial<Record<Rank, number>>;
  cartesParCheckpoint: number;
}

/** Répartit `total` selon des poids, en entiers dont la somme vaut `total` (plus forts restes). */
function repartir(total: number, poids: Readonly<Partial<Record<Rank, number>>>): Partial<Record<Rank, number>> {
  const entrees = Object.entries(poids) as [Rank, number][];
  const somme = entrees.reduce((s, [, p]) => s + p, 0);
  const parts = entrees.map(([r, p]) => ({ r, exact: (total * p) / somme }));
  const res = Object.fromEntries(parts.map(({ r, exact }) => [r, Math.floor(exact)])) as Partial<Record<Rank, number>>;
  let reste = total - parts.reduce((s, { exact }) => s + Math.floor(exact), 0);
  for (const { r } of [...parts].sort((a, b) => (b.exact % 1) - (a.exact % 1))) {
    if (reste-- <= 0) break;
    res[r] = (res[r] ?? 0) + 1;
  }
  return res;
}

/** Décision 2026-10-09 (Sivraj) : 1 seule SS au catalogue, quelle que soit sa taille (2 dans le document). */
export const SS_AU_CATALOGUE = 1;
/** Proportions des autres rangs, d'après le tableau RG-8 (S 3, A 5, B 6, C 7, D 7 pour N = 30). */
export const PROPORTIONS_CATALOGUE: Readonly<Partial<Record<Rank, number>>> = { S: 3, A: 5, B: 6, C: 7, D: 7 };
export const N_MIN = 7;
export const N_MAX = 60;

/**
 * RG-8.1 (N réglable, décision 2026-10-09) : répartition par rang d'un catalogue de N cartes désignées :
 * 1 SS, le reste au prorata du tableau RG-8, au moins une carte de chaque rang.
 */
export function repartitionCatalogue(n: number): Record<Rank, number> {
  const N = Math.min(N_MAX, Math.max(N_MIN, Math.round(n)));
  const autres = Object.keys(PROPORTIONS_CATALOGUE).length;
  // Une carte de chaque rang d'abord, puis le reste au prorata.
  const reste = repartir(N - SS_AU_CATALOGUE - autres, PROPORTIONS_CATALOGUE);
  const r = { SS: SS_AU_CATALOGUE } as Record<Rank, number>;
  for (const k of Object.keys(PROPORTIONS_CATALOGUE) as Rank[]) r[k] = 1 + (reste[k] ?? 0);
  return r;
}

/**
 * RG-8.1 : taille conseillée du catalogue pour qu'un Clear soit possible en fin de partie
 * (simulation du 2026-10-09, 1 SS, animation active : ≈ 25 à 85 % des parties selon la taille du groupe).
 * 12 cartes à 90 min, +2 par demi-heure ; +2 au-delà de 50 joueurs (ils finissent plus vite).
 */
export function conseilCartesDesignees(joueursAttendus: number, dureeMin: number): number {
  const paliers = Math.max(0, Math.round((dureeMin - 90) / 30));
  const grandGroupe = joueursAttendus > 50 && dureeMin > 90 ? 2 : 0;
  return Math.min(N_MAX, Math.max(N_MIN, 12 + 2 * paliers + grandGroupe));
}

/** Conseils pour un nombre de joueurs attendus. */
export function conseilOrganisation(joueursAttendus: number): ConseilOrganisation {
  const n = Math.max(1, Math.round(joueursAttendus));
  const checkpoints = Math.max(1, Math.round(n / JOUEURS_PAR_CHECKPOINT));
  const cartesParCheckpoint = Math.max(1, Math.round((n * CARTES_CHECKPOINT_PAR_JOUEUR) / checkpoints));
  return {
    balises: Math.max(BALISES_MIN, Math.ceil(n * BALISES_PAR_JOUEUR)),
    checkpoints,
    cartesParCheckpoint,
    stockParCheckpoint: repartir(cartesParCheckpoint, RANGS_CHECKPOINT),
  };
}
