// Échanges face à face (RG-11.1 à 11.3, 11.6) et enchères d'Antokiba (RG-11.4, 11.5).
import type { GameState, PlayerStatus, Rank } from '@gq/shared';
import { transferItem, type Book, type BookItem, type CardItem } from './book.js';

export const TRADE_ACCEPT_WINDOW_MS = 60_000; // RG-11.1
export const PAIR_TRADE_INTERVAL_MS = 10 * 60_000; // RG-11.3
export const AUCTION_DURATION_MS = 3 * 60_000; // RG-11.4

const gameOpen = (s: GameState) => s === 'en_cours' || s === 'phase_finale';

export interface TradeParty {
  id: string;
  status: PlayerStatus;
  book: Book;
  jenny: number;
  /** RG-13.1 : Livre gelé après un Clear provisoire. */
  livreGele: boolean;
}

/** Ce qu'un côté donne : des cartes de son Livre et/ou des jenny. */
export interface TradeSide {
  itemIds: readonly string[];
  jenny: number;
}

export interface TradeInput {
  now: number;
  gameState: GameState;
  /** A compose l'offre et montre sa licence. */
  a: TradeParty;
  /** B scanne la licence de A puis accepte. */
  b: TradeParty;
  donneA: TradeSide;
  donneB: TradeSide;
  /** Heure du scan de la licence de A par B. */
  scanneA: number;
  /** Dernier échange conclu entre A et B, null si aucun. */
  dernierEchangePaireA: number | null;
}

export type TradeRefusalCode =
  | 'partie_fermee'
  | 'joueur_bloque'
  | 'meme_joueur'
  | 'livre_gele'
  | 'delai_depasse'
  | 'don_pur'
  | 'element_invalide'
  | 'jenny_insuffisants'
  | 'frequence_paire';

export type TradeResult =
  | {
      ok: true;
      a: TradeParty;
      b: TradeParty;
      /** Exemplaires reçus, tels que chacun les voit désormais. */
      recuParA: BookItem[];
      recuParB: BookItem[];
      /** Diffusion : fil de l'écran géant si une carte S ou SS a changé de main. */
      publicSurEcran: boolean;
    }
  | { ok: false; code: TradeRefusalCode; message: string };

const refuse = (code: TradeRefusalCode, message: string): TradeResult => ({ ok: false, code, message });

const isEmpty = (s: TradeSide) => s.itemIds.length === 0 && s.jenny <= 0;

function cardsOf(p: TradeParty, side: TradeSide): CardItem[] | null {
  if (new Set(side.itemIds).size !== side.itemIds.length) return null;
  const items = side.itemIds.map((id) => p.book.items.find((i) => i.id === id));
  return items.every((i): i is CardItem => i?.kind === 'carte') ? items : null;
}

/**
 * RG-11 : vérifie puis applique un échange, tout ou rien.
 * Les cartes reçues paraissent vraies (RG-11.6) : la marque de contrefaçon disparaît au transfert.
 */
export function trade(t: TradeInput, rangDe: (cardId: string) => Rank): TradeResult {
  if (!gameOpen(t.gameState)) return refuse('partie_fermee', 'Les échanges sont fermés pour le moment');
  if (t.a.id === t.b.id) return refuse('meme_joueur', 'Tu ne peux pas échanger avec toi-même');
  for (const p of [t.a, t.b]) {
    if (p.status === 'disqualifie' || p.status === 'abandon' || p.status === 'gele') {
      return refuse('joueur_bloque', 'Un des joueurs ne peut pas échanger maintenant');
    }
    if (p.livreGele) return refuse('livre_gele', 'Un Livre complet ne peut plus échanger');
  }
  if (t.now - t.scanneA > TRADE_ACCEPT_WINDOW_MS) return refuse('delai_depasse', 'Offre expirée : scanne à nouveau la licence'); // RG-11.1
  if (isEmpty(t.donneA) || isEmpty(t.donneB)) return refuse('don_pur', 'Chacun doit donner au moins 1 carte ou 1 jenny'); // RG-11.2
  if (t.donneA.jenny < 0 || t.donneB.jenny < 0 || !Number.isInteger(t.donneA.jenny) || !Number.isInteger(t.donneB.jenny)) {
    return refuse('element_invalide', 'Montant invalide');
  }

  const cartesA = cardsOf(t.a, t.donneA);
  const cartesB = cardsOf(t.b, t.donneB);
  if (!cartesA || !cartesB) return refuse('element_invalide', 'Une carte de l’offre n’est plus disponible');
  if (t.a.jenny < t.donneA.jenny || t.b.jenny < t.donneB.jenny) return refuse('jenny_insuffisants', 'Jenny insuffisants');

  if (t.dernierEchangePaireA !== null && t.now - t.dernierEchangePaireA < PAIR_TRADE_INTERVAL_MS) {
    const min = Math.ceil((t.dernierEchangePaireA + PAIR_TRADE_INTERVAL_MS - t.now) / 60_000);
    return refuse('frequence_paire', `Vous avez déjà échangé : réessayez dans ${min} min`); // RG-11.3
  }

  let bookA = t.a.book;
  let bookB = t.b.book;
  const recuParA: BookItem[] = [];
  const recuParB: BookItem[] = [];
  for (const c of cartesA) {
    const r = transferItem(bookA, bookB, c.id, { now: t.now, origine: { type: 'echange', avec: t.a.id }, perte: { cause: 'echange', par: t.b.id } });
    bookA = r.from;
    bookB = r.to;
    recuParB.push(r.item);
  }
  for (const c of cartesB) {
    const r = transferItem(bookB, bookA, c.id, { now: t.now, origine: { type: 'echange', avec: t.b.id }, perte: { cause: 'echange', par: t.a.id } });
    bookB = r.from;
    bookA = r.to;
    recuParA.push(r.item);
  }

  const publicSurEcran = [...cartesA, ...cartesB].some((c) => rangDe(c.cardId) === 'S' || rangDe(c.cardId) === 'SS');
  return {
    ok: true,
    a: { ...t.a, book: bookA, jenny: t.a.jenny - t.donneA.jenny + t.donneB.jenny },
    b: { ...t.b, book: bookB, jenny: t.b.jenny - t.donneB.jenny + t.donneA.jenny },
    recuParA,
    recuParB,
    publicSurEcran,
  };
}

// --- Enchères d'Antokiba (RG-11.4, 11.5) ---

export interface Bid {
  playerId: string;
  montant: number;
  a: number;
}

export interface Auction {
  id: string;
  /** Carte du stock du PNJ mise en vente. */
  cardId: string;
  prixDepart: number;
  debut: number;
  fin: number;
  /** Joueurs ayant scanné le QR de l'enchère sur place. */
  participants: readonly string[];
  offres: readonly Bid[];
}

export function openAuction(id: string, cardId: string, now: number, prixDepart = 1): Auction {
  return { id, cardId, prixDepart, debut: now, fin: now + AUCTION_DURATION_MS, participants: [], offres: [] };
}

export const bestBid = (a: Auction): Bid | undefined => a.offres[a.offres.length - 1];

export type AuctionResult = { ok: true; auction: Auction } | { ok: false; code: 'terminee' | 'non_inscrit' | 'offre_trop_basse' | 'jenny_insuffisants'; message: string };

/** RG-11.4 : participer exige le scan du QR de l'enchère, sur place. */
export function joinAuction(a: Auction, playerId: string, now: number): AuctionResult {
  if (now >= a.fin) return { ok: false, code: 'terminee', message: 'Enchère terminée' };
  if (a.participants.includes(playerId)) return { ok: true, auction: a };
  return { ok: true, auction: { ...a, participants: [...a.participants, playerId] } };
}

/** Surenchère depuis l'app. Personne n'est débité avant la clôture. */
export function placeBid(a: Auction, playerId: string, montant: number, jennyDispo: number, now: number): AuctionResult {
  if (now >= a.fin) return { ok: false, code: 'terminee', message: 'Enchère terminée' };
  if (!a.participants.includes(playerId)) return { ok: false, code: 'non_inscrit', message: 'Scanne le QR de l’enchère pour participer' };
  const min = Math.max(a.prixDepart, (bestBid(a)?.montant ?? 0) + 1);
  if (!Number.isInteger(montant) || montant < min) return { ok: false, code: 'offre_trop_basse', message: `Offre minimale : ${min} J` };
  if (montant > jennyDispo) return { ok: false, code: 'jenny_insuffisants', message: 'Jenny insuffisants' };
  return { ok: true, auction: { ...a, offres: [...a.offres, { playerId, montant, a: now }] } };
}

/**
 * Clôture : seul le gagnant est débité (RG-11.4). Si le meilleur enchérisseur ne peut plus payer,
 * l'offre précédente d'un autre joueur l'emporte. Sans offre valable, la carte retourne au PNJ (RG-11.5).
 */
export function closeAuction(a: Auction, jennyDe: (playerId: string) => number): { gagnant: Bid } | { gagnant: null } {
  const exclus = new Set<string>();
  for (let i = a.offres.length - 1; i >= 0; i--) {
    const o = a.offres[i]!;
    if (exclus.has(o.playerId)) continue;
    if (jennyDe(o.playerId) >= o.montant) return { gagnant: o };
    exclus.add(o.playerId);
  }
  return { gagnant: null };
}
