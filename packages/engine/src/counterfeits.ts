// Contrefaçons (RG-8.6 à RG-8.9) : création par Transformation, comptage dans les limites,
// ce que chaque joueur voit, révélation (Analyse, expertise PNJ, vente à Masadora).
import type { GameState, NenType, Rank } from '@gq/shared';
import { layoutBook, type Book, type BookItem, type CardItem } from './book.js';

export const TRANSFORMATION_COOLDOWN_MS = 20 * 60_000; // RG-5.4
export const EXPERTISE_PAGE_PRICE = 10; // RG-8.8
export const EXPERTISE_BOOK_PRICE = 25; // RG-8.8

const isCard = (i: BookItem): i is CardItem => i.kind === 'carte';

/** Contrefaçon déjà démasquée par son détenteur : grisée, ne prend plus d'emplacement désigné (RG-8.9). */
export const isRevealedCopy = (i: CardItem) => i.faux?.nature === 'copie' && i.marque === 'demasquee';

/**
 * RG-8.6 / RG-8.2 : exemplaires en circulation par carte, sur tous les Livres.
 * Une copie de Duplication ne compte nulle part ; un doublon déguisé compte pour sa vraie carte.
 */
export function countInCirculation(books: Iterable<Book>): Map<string, number> {
  const count = new Map<string, number>();
  for (const book of books) {
    for (const item of book.items) {
      if (!isCard(item)) continue;
      const vraie = trueCardId(item);
      if (vraie !== null) count.set(vraie, (count.get(vraie) ?? 0) + 1);
    }
  }
  return count;
}

/** Ce qu'est réellement l'exemplaire : sa carte, sa vraie carte s'il est déguisé, null pour une copie ratée. */
export function trueCardId(item: CardItem): string | null {
  if (!item.faux) return item.cardId;
  return item.faux.nature === 'deguise' ? item.faux.vraieCarteId : null;
}

// --- Affichage (RG-8.9 : chacun voit selon ce qu'il sait) ---

export interface CardView {
  itemId: string;
  cardId: string;
  /** « grisee » : contrefaçon démasquée par celui qui regarde (« Contrefaçon de [nom] »). */
  apparence: 'normale' | 'grisee';
  /** Le créateur voit sa contrefaçon marquée tant qu'il la garde (RG-8.7). */
  badge?: 'contrefacon';
}

/**
 * Vue d'un exemplaire. Pour tout autre que le détenteur (échange, Radar…), une carte
 * paraît toujours vraie (RG-11.6) : on n'expose jamais `faux`.
 */
export function viewCard(item: CardItem, regardeParDetenteur: boolean): CardView {
  const base = { itemId: item.id, cardId: item.cardId };
  if (!regardeParDetenteur || !item.faux) return { ...base, apparence: 'normale' };
  if (isRevealedCopy(item)) return { ...base, apparence: 'grisee' };
  if (item.marque === 'creee') return { ...base, apparence: 'normale', badge: 'contrefacon' };
  return { ...base, apparence: 'normale' };
}

// --- Révélation (RG-8.9) ---

/**
 * Applique la révélation aux éléments donnés : un doublon déguisé redevient sa vraie carte ;
 * une copie de Duplication devient « Contrefaçon de [nom] », grisée pour son détenteur.
 */
export function revealItems(book: Book, itemIds: readonly string[]): Book {
  return {
    ...book,
    items: book.items.map((i) => {
      if (!isCard(i) || !i.faux || !itemIds.includes(i.id)) return i;
      if (i.faux.nature === 'deguise') {
        const { faux, marque: _marque, ...reste } = i;
        return { ...reste, cardId: faux.vraieCarteId };
      }
      return { ...i, marque: 'demasquee' as const };
    }),
  };
}

/** Contrefaçons (non encore démasquées) présentes sur une page du Livre (pages numérotées à partir de 1). */
export function counterfeitsOnPage(book: Book, designees: readonly string[], page: number): string[] | null {
  const slots = layoutBook(book, designees).pages[page - 1];
  if (!slots) return null;
  return slots.flatMap((s) => (s.etat === 'plein' && isCard(s.item) && s.item.faux && !isRevealedCopy(s.item) ? [s.item.id] : []));
}

/** Toutes les contrefaçons (non encore démasquées) du Livre. */
export function allCounterfeits(book: Book): string[] {
  return book.items.flatMap((i) => (isCard(i) && i.faux && !isRevealedCopy(i) ? [i.id] : []));
}

export type ExpertiseResult =
  | { ok: true; cout: number; contrefacons: string[]; book: Book }
  | { ok: false; code: 'page_invalide' | 'jenny_insuffisants'; message: string };

/**
 * RG-8.8 : expertise d'un PNJ à Antokiba, sur son propre Livre : 10 J la page, 25 J le Livre entier.
 * Payée même si rien n'est trouvé.
 */
export function expertise(book: Book, designees: readonly string[], portee: { page: number } | 'livre', jenny: number): ExpertiseResult {
  const cout = portee === 'livre' ? EXPERTISE_BOOK_PRICE : EXPERTISE_PAGE_PRICE;
  const ids = portee === 'livre' ? allCounterfeits(book) : counterfeitsOnPage(book, designees, portee.page);
  if (ids === null) return { ok: false, code: 'page_invalide', message: 'Cette page n’existe pas' };
  if (jenny < cout) return { ok: false, code: 'jenny_insuffisants', message: `Il te faut ${cout} J` };
  return { ok: true, cout, contrefacons: ids, book: revealItems(book, ids) };
}

// --- Transformation : Texture Surprise (RG-5.4, RG-8.7) ---

export interface TransformInput {
  now: number;
  gameState: GameState;
  nen: NenType;
  /** Heure à partir de laquelle le pouvoir est de nouveau disponible (null = disponible). */
  disponibleA: number | null;
  book: Book;
  /** Le doublon à déguiser. */
  itemId: string;
  /** Carte imitée : même rang, autre carte. */
  cibleCardId: string;
  rangDe: (cardId: string) => Rank | undefined;
}

export type TransformResult =
  | { ok: true; book: Book; item: CardItem; disponibleA: number }
  | {
      ok: false;
      code: 'partie_fermee' | 'pouvoir_indisponible' | 'recharge' | 'pas_un_doublon' | 'carte_invalide';
      message: string;
    };

export function transform(t: TransformInput): TransformResult {
  if (t.gameState !== 'en_cours' && t.gameState !== 'phase_finale') {
    return { ok: false, code: 'partie_fermee', message: 'Pouvoir indisponible pour le moment' };
  }
  if (t.nen !== 'transformation') return { ok: false, code: 'pouvoir_indisponible', message: 'Pouvoir indisponible' };
  if (t.disponibleA !== null && t.disponibleA > t.now) {
    const min = Math.ceil((t.disponibleA - t.now) / 60_000);
    return { ok: false, code: 'recharge', message: `Texture Surprise sera prête dans ${min} min` };
  }

  const item = t.book.items.find((i) => i.id === t.itemId);
  // Un vrai exemplaire dont le joueur possède au moins un autre exemplaire.
  const estDoublon =
    item !== undefined &&
    isCard(item) &&
    !item.faux &&
    t.book.items.some((i) => i.id !== item.id && isCard(i) && i.cardId === item.cardId);
  if (!estDoublon || !isCard(item)) return { ok: false, code: 'pas_un_doublon', message: 'Choisis un doublon de ton Livre' };

  const rang = t.rangDe(item.cardId);
  if (t.cibleCardId === item.cardId || rang === undefined || t.rangDe(t.cibleCardId) !== rang) {
    return { ok: false, code: 'carte_invalide', message: 'Choisis une autre carte du même rang' };
  }

  const deguise: CardItem = {
    ...item,
    cardId: t.cibleCardId,
    faux: { nature: 'deguise', vraieCarteId: item.cardId },
    marque: 'creee',
  };
  return {
    ok: true,
    book: { ...t.book, items: t.book.items.map((i) => (i.id === item.id ? deguise : i)) },
    item: deguise,
    disponibleA: t.now + TRANSFORMATION_COOLDOWN_MS,
  };
}
