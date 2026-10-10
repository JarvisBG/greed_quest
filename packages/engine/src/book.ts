// Livre du joueur (RG-8.5), pertes (RG-8.13) et provenance (RG-8.14).
import type { ObjetType, SpellType } from '@gq/shared';

export const FREE_SLOTS = 15;
export const PAGE_SIZE = 10;

/** RG-8.14 : comment un exemplaire a été obtenu. */
export type Origine =
  | { type: 'balise'; baliseId: string }
  | { type: 'pnj'; checkpointId: string }
  | { type: 'echange'; avec: string }
  | { type: 'vol'; sur: string }
  | { type: 'enchere'; enchereId: string }
  | { type: 'arene'; tentativeId: string }
  /** Réserve de Matérialisation (amendement 2026-10-10). */
  | { type: 'materialisation' }
  /** Alchimie, pouvoir de Spécialisation (amendement 2026-10-10). */
  | { type: 'alchimie' }
  | { type: 'duplication' }
  | { type: 'kit' }
  | { type: 'correction_gm'; par: string };

export interface CardItem {
  kind: 'carte';
  /** Id de l'exemplaire. */
  id: string;
  /** Carte affichée (pour une contrefaçon : la carte imitée). */
  cardId: string;
  origine: Origine;
  obtenuA: number;
  /** Contrefaçon (RG-8.6, RG-8.7) : connue du serveur seulement. */
  faux?: Faux;
  /**
   * Ce que le détenteur sait de cette contrefaçon : « creee » pour son créateur,
   * « demasquee » après Analyse ou expertise (RG-8.8). Disparaît au changement de main.
   */
  marque?: 'creee' | 'demasquee';
  /** Carte maudite (RG-12) : son porteur le sait, les autres la voient normale. Reste maudite en changeant de main. */
  maudite?: true;
  /** Coffre scellé (objet, amendement 2026-10-10) : ni volable ni prenable par échange forcé jusqu'à cette heure. */
  coffreJusqua?: number;
}

/** RG-8.7 : copie ratée de Duplication, ou doublon déguisé par Transformation. */
export type Faux = { nature: 'copie' } | { nature: 'deguise'; vraieCarteId: string };

export interface SpellItem {
  kind: 'sort';
  id: string;
  spell: SpellType;
  obtenuA: number;
}

/** Carte objet (amendement 2026-10-10) : section à part du Livre, ne compte pas pour le Clear. */
export interface ObjetItem {
  kind: 'objet';
  id: string;
  objet: ObjetType;
  obtenuA: number;
}

export type BookItem = CardItem | SpellItem | ObjetItem;

/** RG-8.13 : trace d'une carte qui a quitté le Livre. */
export interface Perte {
  cardId: string;
  cause: 'vol' | 'echange' | 'echange_force' | 'revente' | 'sanction' | 'malediction' | 'retour_en_jeu';
  /** Joueur bénéficiaire (vol, échange). */
  par?: string;
  a: number;
}

export interface Book {
  items: readonly BookItem[];
  pertes: readonly Perte[];
}

export const emptyBook = (): Book => ({ items: [], pertes: [] });

export type Slot =
  | { etat: 'plein'; item: BookItem }
  | { etat: 'vide' }
  /** Emplacement désigné vide qui affiche la dernière perte de la carte (RG-8.13). */
  | { etat: 'perdu'; perte: Perte };

export interface DesignatedSlot {
  cardId: string;
  slot: Slot;
}

export interface BookLayout {
  designes: DesignatedSlot[];
  libres: Slot[];
  /** Pages de 10 : d'abord les cartes désignées, puis les emplacements libres. */
  pages: Slot[][];
  libresUtilises: number;
}

const byObtention = (a: BookItem, b: BookItem) => a.obtenuA - b.obtenuA || a.id.localeCompare(b.id);

/**
 * RG-8.5 : un emplacement par carte désignée (le premier exemplaire obtenu l'occupe),
 * les doublons, cartes non désignées et sorts vont dans les emplacements libres.
 * `designees` : ids des cartes désignées dans l'ordre du catalogue (001 → N).
 */
export function layoutBook(book: Book, designees: readonly string[]): BookLayout {
  const items = [...book.items].sort(byObtention);
  const occupant = new Map<string, BookItem>();
  const libresItems: BookItem[] = [];

  for (const item of items) {
    if (item.kind === 'objet') continue; // section des objets, à part (objets.ts)
    // RG-8.9 : une copie démasquée (grisée) libère l'emplacement désigné.
    const grisee = item.kind === 'carte' && item.faux?.nature === 'copie' && item.marque === 'demasquee';
    if (item.kind === 'carte' && !grisee && designees.includes(item.cardId) && !occupant.has(item.cardId)) {
      occupant.set(item.cardId, item);
    } else {
      libresItems.push(item);
    }
  }

  const designes: DesignatedSlot[] = designees.map((cardId) => {
    const item = occupant.get(cardId);
    if (item) return { cardId, slot: { etat: 'plein', item } };
    const perte = lastLoss(book, cardId);
    return { cardId, slot: perte ? { etat: 'perdu', perte } : { etat: 'vide' } };
  });

  const libres: Slot[] = Array.from({ length: Math.max(FREE_SLOTS, libresItems.length) }, (_, i) => {
    const item = libresItems[i];
    return item ? { etat: 'plein', item } : { etat: 'vide' };
  });

  return {
    designes,
    libres,
    pages: [...paginate(designes.map((d) => d.slot)), ...paginate(libres)],
    libresUtilises: libresItems.length,
  };
}

function paginate(slots: Slot[]): Slot[][] {
  const pages: Slot[][] = [];
  for (let i = 0; i < slots.length; i += PAGE_SIZE) pages.push(slots.slice(i, i + PAGE_SIZE));
  return pages;
}

function lastLoss(book: Book, cardId: string): Perte | undefined {
  return book.pertes.filter((p) => p.cardId === cardId).reduce<Perte | undefined>((last, p) => (!last || p.a >= last.a ? p : last), undefined);
}

/**
 * RG-8.5 : Livre plein = plus aucun emplacement libre.
 * Vérifié avant le tirage (étape 6 de RG-7) : le gain n'est pas encore connu.
 */
export function isBookFull(book: Book, designees: readonly string[]): boolean {
  return layoutBook(book, designees).libresUtilises >= FREE_SLOTS;
}

/** Ajoute un élément ; l'appelant a vérifié la place (isBookFull). */
export function addItem(book: Book, item: BookItem): Book {
  return { ...book, items: [...book.items, item] };
}

/**
 * Retire un élément. Une carte retirée laisse une trace de perte (RG-8.13) ;
 * un sort utilisé disparaît sans trace.
 */
export function removeItem(book: Book, itemId: string, perte?: Omit<Perte, 'cardId'>): Book {
  const item = book.items.find((i) => i.id === itemId);
  if (!item) throw new Error(`Élément ${itemId} absent du Livre`);
  const items = book.items.filter((i) => i.id !== itemId);
  if (item.kind === 'carte' && perte) return { items, pertes: [...book.pertes, { ...perte, cardId: item.cardId }] };
  return { ...book, items };
}

/**
 * Fait passer un élément d'un Livre à l'autre (vol, échange, échange forcé).
 * Le receveur l'obtient maintenant, avec sa provenance (RG-8.14) ; la marque
 * de contrefaçon disparaît au changement de main (RG-8.7) ; le donneur garde une perte (RG-8.13).
 */
export function transferItem(
  from: Book,
  to: Book,
  itemId: string,
  t: { now: number; origine: Origine; perte: Omit<Perte, 'cardId' | 'a'> },
): { from: Book; to: Book; item: BookItem } {
  const item = from.items.find((i) => i.id === itemId);
  if (!item) throw new Error(`Élément ${itemId} absent du Livre`);
  let recu: BookItem;
  if (item.kind === 'carte') {
    const { marque: _oubliee, coffreJusqua: _ouvert, ...reste } = item;
    recu = { ...reste, origine: t.origine, obtenuA: t.now };
  } else {
    recu = { ...item, obtenuA: t.now };
  }
  return { from: removeItem(from, itemId, { ...t.perte, a: t.now }), to: addItem(to, recu), item: recu };
}

/** Message affiché sur un emplacement perdu, ex. « Volée par Kevin à 14h05 ». */
export function describeLoss(perte: Perte, nom: (playerId: string) => string, heure: (t: number) => string): string {
  const qui = perte.par ? ` par ${nom(perte.par)}` : '';
  const verbe = {
    vol: 'Volée',
    echange: 'Échangée',
    echange_force: 'Prise par échange forcé',
    revente: 'Revendue',
    sanction: 'Retirée',
    malediction: 'Perdue (malédiction)',
    retour_en_jeu: 'Remise en jeu',
  }[perte.cause];
  return `${verbe}${qui} à ${heure(perte.a)}`;
}
