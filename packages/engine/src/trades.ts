// Échanges (RG-11.1 amendé, 11.2, 11.3, 11.6) et enchères d'Antokiba (RG-11.4, 11.5).
import type { GameState, PlayerStatus, Rank } from '@gq/shared';
import { transferItem, type Book, type BookItem, type CardItem, type ObjetItem } from './book.js';
import { isInRange, isValidPosition, type Position, type RangeSettings } from './geo.js';

/** Délai pour répondre à une proposition d'échange. */
export const TRADE_INVITATION_TIMEOUT_MS = 60_000;
/** Une session d'échange sans action pendant ce délai expire. */
export const TRADE_IDLE_TIMEOUT_MS = 3 * 60_000;
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
  a: TradeParty;
  b: TradeParty;
  donneA: TradeSide;
  donneB: TradeSide;
  /** Dernier échange conclu entre A et B, null si aucun. */
  dernierEchangePaireA: number | null;
}

export type TradeRefusalCode =
  | 'partie_fermee'
  | 'joueur_bloque'
  | 'meme_joueur'
  | 'livre_gele'
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

function cardsOf(p: TradeParty, side: TradeSide): (CardItem | ObjetItem)[] | null {
  if (new Set(side.itemIds).size !== side.itemIds.length) return null;
  const items = side.itemIds.map((id) => p.book.items.find((i) => i.id === id));
  // Cartes et objets s'échangent (amendement 2026-10-10) ; les sorts, non.
  return items.every((i): i is CardItem | ObjetItem => i?.kind === 'carte' || i?.kind === 'objet') ? items : null;
}

/**
 * RG-11 : vérifie puis applique un échange, tout ou rien. Appelé quand les deux joueurs ont validé
 * la session (voir plus bas) ; tout est revérifié car les Livres ont pu changer entre-temps.
 * Les cartes reçues paraissent vraies (RG-11.6) : la marque de contrefaçon disparaît au transfert.
 */
export function trade(t: TradeInput, rangDe: (cardId: string) => Rank): TradeResult {
  if (!gameOpen(t.gameState)) return refuse('partie_fermee', 'Les échanges sont fermés pour le moment');
  if (t.a.id === t.b.id) return refuse('meme_joueur', 'Tu ne peux pas échanger avec toi-même');
  for (const p of [t.a, t.b]) {
    if (p.status === 'disqualifie' || p.status === 'abandon' || p.status === 'gele') {
      return refuse('joueur_bloque', 'Un des joueurs ne peut pas échanger maintenant');
    }
    if (p.livreGele) return refuse('livre_gele', 'Un Book complet ne peut plus échanger');
  }
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

  const publicSurEcran = [...cartesA, ...cartesB].some((c) => c.kind === 'carte' && (rangDe(c.cardId) === 'S' || rangDe(c.cardId) === 'SS'));
  return {
    ok: true,
    a: { ...t.a, book: bookA, jenny: t.a.jenny - t.donneA.jenny + t.donneB.jenny },
    b: { ...t.b, book: bookB, jenny: t.b.jenny - t.donneB.jenny + t.donneA.jenny },
    recuParA,
    recuParB,
    publicSurEcran,
  };
}

// --- Session d'échange (RG-11.1 amendé le 2026-10-09, à la Pokémon) ---
// A choisit B dans la liste des joueurs à portée et propose ; B accepte ou refuse ;
// chacun compose sa part en voyant celle de l'autre ; l'échange n'a lieu que si les deux valident.
// Toute modification d'une part annule les deux validations.

export type TradeSessionState = 'invitation' | 'composition' | 'conclu' | 'refuse' | 'annule' | 'expire';

export interface TradeSession {
  id: string;
  a: string;
  b: string;
  etat: TradeSessionState;
  derniereActionA: number;
  donneA: TradeSide;
  donneB: TradeSide;
  valideA: boolean;
  valideB: boolean;
}

export type SessionRefusalCode = TradeRefusalCode | 'hors_portee' | 'gps_invalide' | 'etat_invalide' | 'pas_participant';
export type SessionRefusal = { ok: false; code: SessionRefusalCode; message: string };
export type SessionResult = { ok: true; session: TradeSession } | SessionRefusal;

const sessionRefuse = (code: SessionRefusalCode, message: string): SessionRefusal => ({ ok: false, code, message });
const emptySide: TradeSide = { itemIds: [], jenny: 0 };

export interface ProposeInput {
  id: string;
  now: number;
  gameState: GameState;
  a: TradeParty & { position: Position | null };
  b: TradeParty & { position: Position | null };
  portee: RangeSettings;
  dernierEchangePaireA: number | null;
}

/** A propose un échange à un joueur de la liste « à portée » (même rayon que les sorts). */
export function proposeTrade(p: ProposeInput): SessionResult {
  if (!gameOpen(p.gameState)) return sessionRefuse('partie_fermee', 'Les échanges sont fermés pour le moment');
  if (p.a.id === p.b.id) return sessionRefuse('meme_joueur', 'Tu ne peux pas échanger avec toi-même');
  for (const x of [p.a, p.b]) {
    if (x.status === 'disqualifie' || x.status === 'abandon' || x.status === 'gele') {
      return sessionRefuse('joueur_bloque', 'Ce joueur ne peut pas échanger maintenant');
    }
    if (x.livreGele) return sessionRefuse('livre_gele', 'Un Book complet ne peut plus échanger');
  }
  if (!isValidPosition(p.a.position, p.now)) return sessionRefuse('gps_invalide', 'Position GPS introuvable : active ta localisation');
  if (!isValidPosition(p.b.position, p.now) || !isInRange(p.a.position, p.b.position, p.portee)) {
    return sessionRefuse('hors_portee', 'Ce joueur est trop loin pour échanger');
  }
  if (p.dernierEchangePaireA !== null && p.now - p.dernierEchangePaireA < PAIR_TRADE_INTERVAL_MS) {
    const min = Math.ceil((p.dernierEchangePaireA + PAIR_TRADE_INTERVAL_MS - p.now) / 60_000);
    return sessionRefuse('frequence_paire', `Vous avez déjà échangé : réessayez dans ${min} min`); // RG-11.3
  }
  return {
    ok: true,
    session: {
      id: p.id,
      a: p.a.id,
      b: p.b.id,
      etat: 'invitation',
      derniereActionA: p.now,
      donneA: emptySide,
      donneB: emptySide,
      valideA: false,
      valideB: false,
    },
  };
}

/** Met à jour l'état si la session a expiré (invitation sans réponse, ou inactivité). */
export function expireTradeSession(s: TradeSession, now: number): TradeSession {
  const delai = s.etat === 'invitation' ? TRADE_INVITATION_TIMEOUT_MS : s.etat === 'composition' ? TRADE_IDLE_TIMEOUT_MS : null;
  return delai !== null && now - s.derniereActionA > delai ? { ...s, etat: 'expire' } : s;
}

/** Session vivante, joueur participant, état attendu ; sinon le refus. */
function active(s: TradeSession, now: number, playerId: string, etat: TradeSessionState): TradeSession | SessionRefusal {
  const cur = expireTradeSession(s, now);
  if (playerId !== cur.a && playerId !== cur.b) return sessionRefuse('pas_participant', 'Tu ne participes pas à cet échange');
  if (cur.etat === 'expire') return sessionRefuse('etat_invalide', 'Échange expiré');
  if (cur.etat !== etat) return sessionRefuse('etat_invalide', 'Cet échange n’est plus modifiable');
  return cur;
}
const isRefusal = (x: TradeSession | SessionRefusal): x is SessionRefusal => 'ok' in x;

/** B accepte ou refuse la proposition (dans les 60 s). */
export function answerTrade(s: TradeSession, playerId: string, accepte: boolean, now: number): SessionResult {
  const cur = active(s, now, playerId, 'invitation');
  if (isRefusal(cur)) return cur;
  if (playerId !== cur.b) return sessionRefuse('pas_participant', 'Seul le joueur invité peut répondre');
  return { ok: true, session: { ...cur, etat: accepte ? 'composition' : 'refuse', derniereActionA: now } };
}

/** Un joueur compose sa part ; les deux validations sont annulées. */
export function setTradeOffer(s: TradeSession, playerId: string, side: TradeSide, now: number): SessionResult {
  const cur = active(s, now, playerId, 'composition');
  if (isRefusal(cur)) return cur;
  const part = playerId === cur.a ? { donneA: side } : { donneB: side };
  return { ok: true, session: { ...cur, ...part, valideA: false, valideB: false, derniereActionA: now } };
}

/**
 * Un joueur valide. Quand les deux ont validé, `pret` est vrai : l'appelant exécute trade()
 * avec donneA / donneB, puis marque la session conclue (concludeTrade) si l'échange a réussi.
 */
export function confirmTrade(
  s: TradeSession,
  playerId: string,
  now: number,
): { ok: true; session: TradeSession; pret: boolean } | SessionRefusal {
  const cur = active(s, now, playerId, 'composition');
  if (isRefusal(cur)) return cur;
  if (isEmpty(cur.donneA) || isEmpty(cur.donneB)) {
    return sessionRefuse('don_pur', 'Chacun doit donner au moins 1 carte ou 1 jenny'); // RG-11.2
  }
  const session = { ...cur, ...(playerId === cur.a ? { valideA: true } : { valideB: true }), derniereActionA: now };
  return { ok: true, session, pret: session.valideA && session.valideB };
}

export const concludeTrade = (s: TradeSession): TradeSession => ({ ...s, etat: 'conclu' });

/** Chacun peut annuler tant que l'échange n'est pas conclu. */
export function cancelTrade(s: TradeSession, playerId: string, now: number): SessionResult {
  if (playerId !== s.a && playerId !== s.b) return sessionRefuse('pas_participant', 'Tu ne participes pas à cet échange');
  if (s.etat !== 'invitation' && s.etat !== 'composition') return sessionRefuse('etat_invalide', 'Cet échange est déjà terminé');
  return { ok: true, session: { ...s, etat: 'annule', derniereActionA: now } };
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
