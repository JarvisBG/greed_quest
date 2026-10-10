// Pouvoirs de Spécialisation (RG-5.4, « liste à définir » ; amendement 2026-10-10, Sivraj). Le Spécialiste reçoit
// un pouvoir au hasard, secret pour les autres joueurs, qui se recharge `rechargeSpeMin` (40 min) après usage.
// Bandit passe par les sorts (castOffensive) ; Fortune par le scan ; Zetsu par les listes de cibles.
import { POUVOIRS_SPE, RANKS, type GameState, type PlayerStatus, type PouvoirSpe, type Rank } from '@gq/shared';
import { addItem, layoutBook, removeItem, type Book, type CardItem } from './book.js';
import { pick, type Rng } from './rng.js';

export const tirerPouvoirSpe = (rng: Rng): PouvoirSpe => pick(rng, POUVOIRS_SPE);

export interface SpeJoueur {
  pouvoirSpe: PouvoirSpe | null;
  /** Heure de jeu du dernier usage. */
  speA: number | null;
}

/** Temps avant que le pouvoir soit disponible (0 = disponible), null si le joueur n'a pas ce pouvoir. */
export function speDisponibleDans(j: SpeJoueur, pouvoir: PouvoirSpe, now: number, rechargeMs: number): number | null {
  if (j.pouvoirSpe !== pouvoir) return null;
  return j.speA === null ? 0 : Math.max(0, j.speA + rechargeMs - now);
}

/** Zetsu : invisible (ni ciblable, ni dans les listes, ni sur la carte de chaleur) jusqu'à cette heure. */
export const estInvisible = (j: { zetsuJusqua?: number | null }, now: number) => j.zetsuJusqua != null && j.zetsuJusqua > now;

export type SpeRefusalCode = 'partie_fermee' | 'joueur_bloque' | 'pouvoir_indisponible' | 'deja_armee' | 'carte_absente' | 'carte_invalide' | 'limite_atteinte';
export interface SpeRefusal {
  ok: false;
  code: SpeRefusalCode;
  message: string;
}
const refuse = (code: SpeRefusalCode, message: string): SpeRefusal => ({ ok: false, code, message });
const minutes = (ms: number) => Math.ceil(ms / 60_000);

interface Contexte {
  now: number;
  gameState: GameState;
  rechargeMs: number;
}

function verifier(c: Contexte, j: SpeJoueur & { status: PlayerStatus }, pouvoir: PouvoirSpe): SpeRefusal | null {
  if (c.gameState !== 'en_cours' && c.gameState !== 'phase_finale') return refuse('partie_fermee', 'Les pouvoirs sont indisponibles');
  if (j.status === 'disqualifie' || j.status === 'abandon' || j.status === 'gele') return refuse('joueur_bloque', 'Tu ne peux pas utiliser ton pouvoir maintenant');
  const dans = speDisponibleDans(j, pouvoir, c.now, c.rechargeMs);
  if (dans === null) return refuse('pouvoir_indisponible', 'Tu n’as pas ce pouvoir');
  if (dans > 0) return refuse('pouvoir_indisponible', `Ton pouvoir se recharge encore ${minutes(dans)} min`);
  return null;
}

/** Zetsu : invisible pendant `dureeMs` (10 min). Lancer un sort offensif ou proposer un échange le rompt. */
export function activerZetsu(
  c: Contexte & { dureeMs: number },
  j: SpeJoueur & { status: PlayerStatus },
): { ok: true; speA: number; zetsuJusqua: number } | SpeRefusal {
  const r = verifier(c, j, 'zetsu');
  if (r) return r;
  return { ok: true, speA: c.now, zetsuJusqua: c.now + c.dureeMs };
}

/** Fortune : le prochain scan réussi donne un gain de plus. */
export function activerFortune(c: Contexte, j: SpeJoueur & { status: PlayerStatus; fortuneArmee: boolean }): { ok: true; speA: number } | SpeRefusal {
  if (j.fortuneArmee) return refuse('deja_armee', 'Ta Fortune attend déjà ton prochain scan');
  const r = verifier(c, j, 'fortune');
  if (r) return r;
  return { ok: true, speA: c.now };
}

/**
 * Alchimie : un doublon (carte rangée hors de son emplacement désigné) devient une carte du catalogue choisie,
 * du même rang ou du rang au-dessus, jamais la SS, sous sa limite d'exemplaires. Le doublon sort du jeu.
 * Une contrefaçon ne se transforme pas : l'alchimie échoue, la fausse carte disparaît et le pouvoir est consommé.
 */
export function alchimie(
  c: Contexte & { newId: () => string; designees: readonly string[]; rangDe: (cardId: string) => Rank; sousLimite: (cardId: string) => boolean },
  j: SpeJoueur & { status: PlayerStatus; book: Book },
  doublonItemId: string,
  carteVoulueId: string,
): { ok: true; speA: number; book: Book; resultat: 'reussi' | 'contrefacon'; carte: CardItem | null } | SpeRefusal {
  const r = verifier(c, j, 'alchimie');
  if (r) return r;
  const doublon = layoutBook(j.book, c.designees).libres.flatMap((s) => (s.etat === 'plein' && s.item.kind === 'carte' ? [s.item] : [])).find((i) => i.id === doublonItemId);
  if (!doublon) return refuse('carte_absente', 'Choisis un doublon de ton Livre');
  if (!c.designees.includes(carteVoulueId)) return refuse('carte_invalide', 'Cette carte n’est pas au catalogue');
  const de = c.rangDe(doublon.cardId);
  const vers = c.rangDe(carteVoulueId);
  const ecart = RANKS.indexOf(de) - RANKS.indexOf(vers);
  if (vers === 'SS') return refuse('carte_invalide', 'L’alchimie ne peut pas créer la SS');
  if (ecart !== 0 && ecart !== 1) return refuse('carte_invalide', 'Choisis une carte du même rang que ton doublon, ou du rang juste au-dessus');
  const sansDoublon = removeItem(j.book, doublon.id);
  if (doublon.faux) return { ok: true, speA: c.now, book: sansDoublon, resultat: 'contrefacon', carte: null };
  if (!c.sousLimite(carteVoulueId)) return refuse('limite_atteinte', 'Cette carte a atteint sa limite d’exemplaires');
  const carte: CardItem = { kind: 'carte', id: c.newId(), cardId: carteVoulueId, origine: { type: 'alchimie' }, obtenuA: c.now };
  return { ok: true, speA: c.now, book: addItem(sansDoublon, carte), resultat: 'reussi', carte };
}
