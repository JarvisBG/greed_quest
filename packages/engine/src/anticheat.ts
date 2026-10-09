// Détections anti-triche (RG-15) qui ne relèvent pas de la géoloc (voir geo.ts pour vitesse et photo partagée).
// Le moteur alerte, il ne sanctionne jamais seul. Seuils proposés (PROGRESS.md), à valider sur le terrain.
import { RANK_POINTS, type Rank } from '@gq/shared';

/** Rythme de scan anormal : au moins 10 tirages réussis en 10 min (la boucle et la marche entre balises le rendent irréaliste). */
export const SCAN_RATE_WINDOW_MS = 10 * 60_000;
export const SCAN_RATE_MAX = 10;

export function isAbnormalScanRate(tiragesA: readonly number[], now: number): boolean {
  return tiragesA.filter((a) => now - a < SCAN_RATE_WINDOW_MS).length >= SCAN_RATE_MAX;
}

/** Échanges déséquilibrés : valeur d'une part = points de rang des cartes (RG-13.5) + 1 point par 10 J. */
export const UNBALANCED_RATIO = 3;
export const UNBALANCED_MIN_VALUE = 5;
export const UNBALANCED_WINDOW_MS = 60 * 60_000;
export const UNBALANCED_REPEAT = 2;

export function tradeSideValue(side: { rangs: readonly Rank[]; jenny: number }): number {
  return side.rangs.reduce((s, r) => s + RANK_POINTS[r], 0) + side.jenny / 10;
}

/** Sens du déséquilibre : « a » si A donne beaucoup plus qu'il ne reçoit, « b » à l'inverse, null si équilibré. */
export function unbalancedDirection(valeurA: number, valeurB: number): 'a' | 'b' | null {
  const [haut, bas] = valeurA >= valeurB ? [valeurA, valeurB] : [valeurB, valeurA];
  if (haut < UNBALANCED_MIN_VALUE || haut < UNBALANCED_RATIO * Math.max(bas, 0.0001)) return null;
  return valeurA >= valeurB ? 'a' : 'b';
}

export interface PairTrade {
  /** Joueur qui donne le plus (déséquilibre), null si équilibré. */
  donneurDesequilibre: string | null;
  a: number;
}

/**
 * RG-15 « échanges répétés déséquilibrés » : sur 1 h, au moins 2 échanges d'une même paire
 * déséquilibrés dans le même sens (un joueur alimente l'autre, ex. multi-comptes).
 */
export function isRepeatedUnbalanced(historiquePaire: readonly PairTrade[], now: number): boolean {
  const recents = historiquePaire.filter((t) => now - t.a < UNBALANCED_WINDOW_MS && t.donneurDesequilibre !== null);
  const parDonneur = new Map<string, number>();
  for (const t of recents) parDonneur.set(t.donneurDesequilibre!, (parDonneur.get(t.donneurDesequilibre!) ?? 0) + 1);
  return [...parDonneur.values()].some((n) => n >= UNBALANCED_REPEAT);
}
