// Conseils d'organisation affichés au GM pendant la préparation (calibrage validé le 2026-10-09,
// docs/SIMULATION.md). Ce sont des recommandations : rien n'est bloqué.
import type { Rank } from '@gq/shared';

/** Balises à poser par joueur attendu : au-delà, trop de scans tombent sur des balises dormantes. */
export const BALISES_PAR_JOUEUR = 0.75;
export const BALISES_MIN = 10;
/** Un checkpoint PNJ pour 10 joueurs attendus. */
export const JOUEURS_PAR_CHECKPOINT = 10;
/** Cartes de checkpoint par joueur attendu (≈ 1,5 : meilleur joueur 20-25/30 en simulation). */
export const CARTES_CHECKPOINT_PAR_JOUEUR = 1.5;
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
