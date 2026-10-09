// Classement (RG-13.5, RG-13.7) et Clear (RG-13.1 à RG-13.3).
import { RANK_POINTS, type PlayerStatus, type Rank } from '@gq/shared';
import { PAGE_SIZE, layoutBook, type Book, type CardItem } from './book.js';
import { trueCardId } from './counterfeits.js';

export interface RankingEntry {
  playerId: string;
  /** 1. Cartes désignées distinctes. */
  cartes: number;
  /** 2. Somme des rangs de ces cartes (SS 6 … D 1). */
  points: number;
  /** 3. Jenny. */
  jenny: number;
  /** 4. Heure d'obtention de la dernière carte désignée comptée ; la plus tôt gagne. null si aucune. */
  derniereCarteA: number | null;
  /** Place, ex æquo possibles (1, 1, 3). */
  place: number;
}

type Score = Omit<RankingEntry, 'place'>;

/**
 * Cartes désignées comptées pour un Livre, avec l'heure d'obtention retenue pour chacune.
 * - live : ce que montre le Livre (emplacements désignés occupés), contrefaçons comprises (RG-13.7) ;
 * - final : uniquement les vrais exemplaires ; un doublon déguisé compte pour sa vraie carte.
 */
export function countedCards(book: Book, designees: readonly string[], mode: 'live' | 'final'): Map<string, number> {
  const res = new Map<string, number>();
  if (mode === 'live') {
    for (const d of layoutBook(book, designees).designes) {
      if (d.slot.etat === 'plein') res.set(d.cardId, d.slot.item.obtenuA);
    }
    return res;
  }
  const set = new Set(designees);
  for (const item of book.items) {
    if (item.kind !== 'carte') continue;
    const vraie = trueCardId(item);
    if (vraie === null || !set.has(vraie)) continue;
    res.set(vraie, Math.min(res.get(vraie) ?? Infinity, item.obtenuA));
  }
  return res;
}

export interface RankedPlayer {
  id: string;
  status: PlayerStatus;
  book: Book;
  jenny: number;
}

function score(p: RankedPlayer, designees: readonly string[], mode: 'live' | 'final', rangDe: (cardId: string) => Rank): Score {
  const cartes = countedCards(p.book, designees, mode);
  let points = 0;
  let derniere: number | null = null;
  for (const [cardId, a] of cartes) {
    points += RANK_POINTS[rangDe(cardId)];
    derniere = derniere === null ? a : Math.max(derniere, a);
  }
  return { playerId: p.id, cartes: cartes.size, points, jenny: p.jenny, derniereCarteA: derniere };
}

function compare(a: Score, b: Score): number {
  return b.cartes - a.cartes || b.points - a.points || b.jenny - a.jenny || compareTimes(a.derniereCarteA, b.derniereCarteA);
}

/** La plus tôt d'abord ; sans carte (null) en dernier. */
function compareTimes(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

/** RG-13.5 : classement, live ou final. Les joueurs disqualifiés n'y figurent pas (RG-15.2). */
export function rank(
  players: readonly RankedPlayer[],
  designees: readonly string[],
  mode: 'live' | 'final',
  rangDe: (cardId: string) => Rank,
): RankingEntry[] {
  const scores = players.filter((p) => p.status !== 'disqualifie').map((p) => score(p, designees, mode, rangDe));
  scores.sort((a, b) => compare(a, b) || a.playerId.localeCompare(b.playerId));
  return scores.map((s, i) => {
    let place = i + 1;
    // Ex æquo : même place que le précédent si tous les critères sont égaux.
    for (let j = i - 1; j >= 0 && compare(scores[j]!, s) === 0; j--) place = j + 1;
    return { ...s, place };
  });
}

// --- Clear (RG-13.1, 13.2) ---

export type ClearCheck =
  | { etat: 'incomplet'; manquantes: number }
  | { etat: 'complet' }
  /** Au moins une contrefaçon : on ne dit pas laquelle, seulement la page (RG-13.1). */
  | { etat: 'contrefacon'; page: number };

/** Le Livre montre-t-il les N cartes désignées, et sont-elles toutes vraies ? */
export function checkClear(book: Book, designees: readonly string[]): ClearCheck {
  const { designes } = layoutBook(book, designees);
  const manquantes = designes.filter((d) => d.slot.etat !== 'plein').length;
  if (manquantes > 0) return { etat: 'incomplet', manquantes };
  const i = designes.findIndex((d) => d.slot.etat === 'plein' && d.slot.item.kind === 'carte' && d.slot.item.faux);
  if (i >= 0) return { etat: 'contrefacon', page: Math.floor(i / PAGE_SIZE) + 1 };
  return { etat: 'complet' };
}

/**
 * RG-13.3 : le gagnant choisit 3 cartes désignées distinctes de son Livre ; chacune correspond à un lot réel.
 */
export function validateRewards(
  book: Book,
  designees: readonly string[],
  itemIds: readonly string[],
): { ok: true; cardIds: string[] } | { ok: false; message: string } {
  if (itemIds.length !== 3) return { ok: false, message: 'Choisis exactement 3 cartes' };
  const items = itemIds.map((id) => book.items.find((i) => i.id === id));
  if (!items.every((i): i is CardItem => i?.kind === 'carte' && !i.faux && designees.includes(i.cardId))) {
    return { ok: false, message: 'Choisis 3 cartes désignées de ton Livre' };
  }
  const cardIds = items.map((i) => i.cardId);
  if (new Set(cardIds).size !== 3) return { ok: false, message: 'Choisis 3 cartes différentes' };
  return { ok: true, cardIds };
}
