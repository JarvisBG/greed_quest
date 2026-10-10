// Cartes objets (amendement 2026-10-10, Sivraj) : troisième famille du Livre, à côté des cartes de collection
// et des sorts. Elles ne comptent pas pour le Clear et ont leur propre section (PLACES_OBJETS places).
// Une partie des replis « carte épuisée » donne un objet EN PLUS des jenny (simulation : neutre à favorable).
import type { GameState, ObjetType, PlayerStatus } from '@gq/shared';
import { removeItem, type Book, type ObjetItem } from './book.js';
import { distanceM, isValidPosition, type LatLng, type Position } from './geo.js';
import { weightedPick, type Rng } from './rng.js';

export const PLACES_OBJETS = 8;

export interface ObjetsConfig {
  /** Poids au tirage d'un objet. */
  poids: Record<ObjetType, number>;
  /** Ticket de la Fortune : gains possibles et leurs poids. */
  ticket: [number, number][];
  /** Revente à Masadora ; null = ne se revend pas (le Ticket se gratte). */
  revente: Record<ObjetType, number | null>;
}

export const DEFAULT_OBJETS_CONFIG: ObjetsConfig = {
  poids: { pepite: 3, ticket: 3, boussole: 2, souffle: 2, voile: 1, coffre: 1 },
  ticket: [
    [0, 40],
    [10, 35],
    [30, 20],
    [100, 5],
  ],
  revente: { pepite: 30, ticket: null, boussole: 10, souffle: 10, voile: 10, coffre: 10 },
};

export const objetsDe = (book: Book): ObjetItem[] => book.items.filter((i): i is ObjetItem => i.kind === 'objet');
export const isObjetsPlein = (book: Book) => objetsDe(book).length >= PLACES_OBJETS;
/** Premier objet d'un type (le plus ancien). */
export const objetDuType = (book: Book, objet: ObjetType): ObjetItem | undefined =>
  objetsDe(book)
    .filter((o) => o.objet === objet)
    .sort((a, b) => a.obtenuA - b.obtenuA)[0];

/**
 * Repli « carte épuisée » (RG-8.3) : avec la probabilité `pct`, un objet s'ajoute aux jenny.
 * Rien si la section des objets est pleine.
 */
export function objetDeRepli(book: Book, pct: number, rng: Rng, config: ObjetsConfig = DEFAULT_OBJETS_CONFIG): ObjetType | null {
  if (isObjetsPlein(book) || rng.next() * 100 >= pct) return null;
  return weightedPick(rng, Object.entries(config.poids) as [ObjetType, number][]) ?? null;
}

export type ObjetRefusalCode = 'partie_fermee' | 'joueur_bloque' | 'objet_absent' | 'gps_invalide' | 'aucune_balise' | 'carte_absente';
export interface ObjetRefusal {
  ok: false;
  code: ObjetRefusalCode;
  message: string;
}
const refuse = (code: ObjetRefusalCode, message: string): ObjetRefusal => ({ ok: false, code, message });

export interface ObjetJoueur {
  status: PlayerStatus;
  book: Book;
}

function prendre(gameState: GameState, p: ObjetJoueur, itemId: string, objet: ObjetType): ObjetItem | ObjetRefusal {
  if (gameState !== 'en_cours' && gameState !== 'phase_finale') return refuse('partie_fermee', 'Les objets sont indisponibles');
  if (p.status === 'disqualifie' || p.status === 'abandon') return refuse('joueur_bloque', 'Tu ne peux pas utiliser d’objet');
  const item = p.book.items.find((i): i is ObjetItem => i.id === itemId && i.kind === 'objet');
  if (!item || item.objet !== objet) return refuse('objet_absent', 'Tu n’as pas cet objet');
  return item;
}
const estRefus = (x: ObjetItem | ObjetRefusal): x is ObjetRefusal => 'ok' in x;

/** Ticket de la Fortune : gratté, il rapporte 0, 10, 30 ou 100 J. */
export function gratterTicket(
  c: { gameState: GameState },
  p: ObjetJoueur,
  itemId: string,
  rng: Rng,
  config: ObjetsConfig = DEFAULT_OBJETS_CONFIG,
): { ok: true; book: Book; gain: number } | ObjetRefusal {
  const item = prendre(c.gameState, p, itemId, 'ticket');
  if (estRefus(item)) return item;
  return { ok: true, book: removeItem(p.book, item.id), gain: weightedPick(rng, config.ticket) ?? 0 };
}

export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SO' | 'O' | 'NO';
const DIRECTIONS: Direction[] = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

/** Cap (8 directions) de `a` vers `b`. */
export function direction(a: LatLng, b: LatLng): Direction {
  const rad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  const cap = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return DIRECTIONS[Math.round(cap / 45) % 8]!;
}

/**
 * Boussole du chercheur : direction (jamais la distance ni la position) de la balise active la plus proche
 * que le joueur n'a jamais scannée. Les balises fantômes (Apparition) sont exclues. Refus sans consommer
 * si aucune balise ne convient.
 */
export function utiliserBoussole(
  c: { gameState: GameState; now: number },
  p: ObjetJoueur & { position: Position | null; historiqueTirages: readonly string[] },
  itemId: string,
  balises: readonly { id: string; state: string; type: string | null; position: LatLng | null }[],
): { ok: true; book: Book; direction: Direction } | ObjetRefusal {
  const item = prendre(c.gameState, p, itemId, 'boussole');
  if (estRefus(item)) return item;
  if (!isValidPosition(p.position, c.now)) return refuse('gps_invalide', 'Position GPS introuvable : active ta localisation');
  const ici = p.position;
  const vues = new Set(p.historiqueTirages);
  const cibles = balises
    .filter((b): b is typeof b & { position: LatLng } => b.state === 'active' && b.type !== 'fantome' && !vues.has(b.id) && b.position !== null)
    .sort((a, b) => distanceM(ici, a.position) - distanceM(ici, b.position));
  const b = cibles[0];
  if (!b) return refuse('aucune_balise', 'L’aiguille tourne dans le vide : aucune balise nouvelle à indiquer pour l’instant');
  return { ok: true, book: removeItem(p.book, item.id), direction: direction(ici, b.position) };
}

/** Coffre scellé : une carte choisie ne peut être ni volée ni prise par échange forcé pendant `dureeMs` (20 min par défaut, RG-14 `coffreMin`). */
export function utiliserCoffre(
  c: { gameState: GameState; now: number; dureeMs: number },
  p: ObjetJoueur,
  itemId: string,
  carteItemId: string,
): { ok: true; book: Book; jusqua: number } | ObjetRefusal {
  const item = prendre(c.gameState, p, itemId, 'coffre');
  if (estRefus(item)) return item;
  const carte = p.book.items.find((i) => i.id === carteItemId);
  if (carte?.kind !== 'carte') return refuse('carte_absente', 'Choisis une carte de ton Book');
  const jusqua = c.now + c.dureeMs;
  const book = removeItem(p.book, item.id);
  return { ok: true, book: { ...book, items: book.items.map((i) => (i.id === carteItemId && i.kind === 'carte' ? { ...i, coffreJusqua: jusqua } : i)) }, jusqua };
}
