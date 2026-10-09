// Boutique de Masadora (RG-9) : paquets de sorts par vague, revente, contrefaçons révélées (RG-8.9).
import type { GameState, PlayerStatus, Rank, SpellType } from '@gq/shared';
import { FREE_SLOTS, addItem, layoutBook, removeItem, type Book, type SpellItem } from './book.js';
import { isRevealedCopy, trueCardId } from './counterfeits.js';
import { isValidPosition, type Position } from './geo.js';
import { weightedPick, type Rng } from './rng.js';

export const WAVE_DURATION_MS = 20 * 60_000; // RG-9.3
export const SPELLS_PER_PACK = 3; // RG-9.2

/** RG-9 : tous les prix sont réglables par le GM. */
export interface ShopConfig {
  prixPaquet: number;
  /** Prix de revente par rang ; null = revente interdite (SS). */
  revente: Record<Rank, number | null>;
  /** Revente d'une contrefaçon démasquée ou révélée par Masadora (RG-8.9). */
  reventeContrefacon: number;
  maxPaquetsParJoueurParVague: number;
  /** Poids des sorts dans un paquet (uniforme par défaut, rareté des sorts non définie). */
  sorts: Record<SpellType, number>;
}

export const DEFAULT_SHOP_CONFIG: ShopConfig = {
  prixPaquet: 50,
  revente: { D: 5, C: 10, B: 20, A: 40, S: 80, SS: null },
  reventeContrefacon: 1,
  maxPaquetsParJoueurParVague: 2,
  sorts: { vol: 1, echange_force: 1, gel: 1, barriere: 1, radar: 1, revelation: 1, duplication: 1, analyse: 1, regard: 0.5 },
};

// --- Vagues (RG-9.3) ---

export interface ShopWave {
  index: number;
  stock: number;
  achats: Readonly<Record<string, number>>;
}

/**
 * Vague courante, numérotée depuis le début de la partie (horloge de jeu).
 * Une nouvelle vague reçoit le stock calculé à son ouverture (paquetsParVague, RG-14.3).
 */
export function currentWave(wave: ShopWave | null, now: number, debutPartie: number, paquetsParVague: number): ShopWave {
  const index = Math.floor((now - debutPartie) / WAVE_DURATION_MS);
  if (wave && wave.index === index) return wave;
  return { index, stock: paquetsParVague, achats: {} };
}

// --- Achat (RG-9.2) ---

export interface ShopPlayer {
  id: string;
  status: PlayerStatus;
  position: Position | null;
  jenny: number;
  book: Book;
}

export interface ShopContext {
  now: number;
  gameState: GameState;
  /** Le joueur vient de scanner le QR de la boutique, sur place (RG-9.2). */
  qrBoutiqueScanne: boolean;
  designees: readonly string[];
  config?: ShopConfig;
}

export type ShopRefusalCode =
  | 'partie_fermee'
  | 'joueur_bloque'
  | 'gps_invalide'
  | 'pas_sur_place'
  | 'stock_epuise'
  | 'limite_joueur'
  | 'jenny_insuffisants'
  | 'livre_plein'
  | 'carte_absente'
  | 'revente_interdite';

export type ShopRefusal = { ok: false; code: ShopRefusalCode; message: string };
const refuse = (code: ShopRefusalCode, message: string): ShopRefusal => ({ ok: false, code, message });

function checkShopper(c: ShopContext, p: ShopPlayer): ShopRefusal | null {
  if (c.gameState !== 'en_cours' && c.gameState !== 'phase_finale') return refuse('partie_fermee', 'La boutique est fermée');
  if (p.status === 'disqualifie' || p.status === 'abandon' || p.status === 'gele') {
    return refuse('joueur_bloque', 'Tu ne peux pas utiliser la boutique maintenant');
  }
  if (!isValidPosition(p.position, c.now)) return refuse('gps_invalide', 'Position GPS introuvable : active ta localisation'); // RG-7.6
  if (!c.qrBoutiqueScanne) return refuse('pas_sur_place', 'Scanne le QR de la boutique, sur place');
  return null;
}

export interface BuyResult {
  ok: true;
  player: ShopPlayer;
  wave: ShopWave;
  prix: number;
  sorts: SpellItem[];
}

/**
 * Achète un paquet de 3 sorts aléatoires. `multiplicateurPrix` : 0,5 pendant un Krach de Masadora (RG-12).
 * Il faut 3 emplacements libres : l'achat ne fait jamais déborder le Livre.
 */
export function buyPack(
  c: ShopContext & { wave: ShopWave; multiplicateurPrix?: number; newId: () => string },
  player: ShopPlayer,
  rng: Rng,
): BuyResult | ShopRefusal {
  const config = c.config ?? DEFAULT_SHOP_CONFIG;
  const bloque = checkShopper(c, player);
  if (bloque) return bloque;
  if (c.wave.stock <= 0) return refuse('stock_epuise', 'Plus de paquets pour cette vague : reviens plus tard');
  const deja = c.wave.achats[player.id] ?? 0;
  if (deja >= config.maxPaquetsParJoueurParVague) {
    return refuse('limite_joueur', `Maximum ${config.maxPaquetsParJoueurParVague} paquets par vague`);
  }
  const prix = Math.ceil(config.prixPaquet * (c.multiplicateurPrix ?? 1));
  if (player.jenny < prix) return refuse('jenny_insuffisants', `Il te faut ${prix} J`);
  if (layoutBook(player.book, c.designees).libresUtilises + SPELLS_PER_PACK > FREE_SLOTS) {
    return refuse('livre_plein', `Il te faut ${SPELLS_PER_PACK} emplacements libres dans ton Livre`);
  }

  const sorts: SpellItem[] = [];
  let book = player.book;
  for (let i = 0; i < SPELLS_PER_PACK; i++) {
    const spell = weightedPick(rng, Object.entries(config.sorts) as [SpellType, number][]) ?? 'gel';
    const item: SpellItem = { kind: 'sort', id: c.newId(), spell, obtenuA: c.now };
    sorts.push(item);
    book = addItem(book, item);
  }
  return {
    ok: true,
    player: { ...player, jenny: player.jenny - prix, book },
    wave: { ...c.wave, stock: c.wave.stock - 1, achats: { ...c.wave.achats, [player.id]: deja + 1 } },
    prix,
    sorts,
  };
}

// --- Revente (RG-9.4, RG-8.9) ---

export interface SellResult {
  ok: true;
  player: ShopPlayer;
  prix: number;
  /** Masadora a révélé une contrefaçon (RG-8.9) : le joueur l'apprend à la vente. */
  contrefacon: 'copie' | 'deguise' | null;
  /** Carte réellement vendue (pour un déguisé : sa vraie carte). */
  cardId: string;
}

/**
 * Revend une carte. L'exemplaire sort du jeu et libère une place sous la limite de sa carte
 * (le comptage se fait sur les Livres, RG-9.4). Les SS ne se revendent pas.
 * Masadora révèle toute contrefaçon : une copie rapporte 1 J, un doublon déguisé le prix de sa vraie carte.
 */
export function sellCard(c: ShopContext, player: ShopPlayer, itemId: string, rangDe: (cardId: string) => Rank): SellResult | ShopRefusal {
  const config = c.config ?? DEFAULT_SHOP_CONFIG;
  const bloque = checkShopper(c, player);
  if (bloque) return bloque;
  const item = player.book.items.find((i) => i.id === itemId);
  if (item?.kind !== 'carte') return refuse('carte_absente', 'Choisis une carte de ton Livre');

  let prix: number;
  let contrefacon: SellResult['contrefacon'] = null;
  let cardId = item.cardId;
  if (isRevealedCopy(item)) {
    prix = config.reventeContrefacon;
    contrefacon = 'copie';
  } else {
    // Le joueur ne voit que la carte apparente : une SS apparente n'est jamais reprise.
    const apparent = config.revente[rangDe(item.cardId)];
    if (apparent === null) return refuse('revente_interdite', 'Les cartes SS ne se revendent pas');
    const vraie = trueCardId(item);
    if (vraie === null) {
      prix = config.reventeContrefacon;
      contrefacon = 'copie';
    } else {
      prix = config.revente[rangDe(vraie)] ?? 0;
      contrefacon = item.faux ? 'deguise' : null;
      cardId = vraie;
    }
  }

  return {
    ok: true,
    player: { ...player, jenny: player.jenny + prix, book: removeItem(player.book, itemId, { cause: 'revente', a: c.now }) },
    prix,
    contrefacon,
    cardId,
  };
}
