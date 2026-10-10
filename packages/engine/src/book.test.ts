import { describe, expect, it } from 'vitest';
import {
  FREE_SLOTS,
  addItem,
  describeLoss,
  emptyBook,
  isBookFull,
  layoutBook,
  removeItem,
  type Book,
  type CardItem,
  type SpellItem,
} from './book.js';

const designees = Array.from({ length: 30 }, (_, i) => String(i + 1).padStart(3, '0'));

let seq = 0;
const carte = (cardId: string, obtenuA = seq): CardItem => ({
  kind: 'carte',
  id: `ex${seq++}`,
  cardId,
  origine: { type: 'balise', baliseId: 'b1' },
  obtenuA,
});
const sort = (obtenuA = seq): SpellItem => ({ kind: 'sort', id: `sp${seq++}`, spell: 'vol', obtenuA });

const withItems = (...items: (CardItem | SpellItem)[]): Book => items.reduce(addItem, emptyBook());

describe('RG-8.5 Book', () => {
  it('Book vide : 3 pages désignées (N = 30) puis 2 pages libres (10 + 5)', () => {
    const l = layoutBook(emptyBook(), designees);
    expect(l.pages.map((p) => p.length)).toEqual([10, 10, 10, 10, 5]);
    expect(l.libresUtilises).toBe(0);
  });

  it('le premier exemplaire occupe l’emplacement désigné, le doublon va en libre', () => {
    const a = carte('005', 1);
    const b = carte('005', 2);
    const l = layoutBook(withItems(b, a), designees);
    expect(l.designes[4]?.slot).toEqual({ etat: 'plein', item: a });
    expect(l.libres[0]).toEqual({ etat: 'plein', item: b });
    expect(l.libresUtilises).toBe(1);
  });

  it('les sorts et les cartes non désignées occupent des emplacements libres', () => {
    const l = layoutBook(withItems(sort(), carte('X99')), designees);
    expect(l.libresUtilises).toBe(2);
  });

  it('Book plein à 15 emplacements libres utilisés', () => {
    const items = Array.from({ length: FREE_SLOTS - 1 }, () => sort());
    let book = withItems(...items);
    expect(isBookFull(book, designees)).toBe(false);
    book = addItem(book, carte('001'));
    expect(isBookFull(book, designees)).toBe(false); // carte désignée nouvelle : pas un emplacement libre
    book = addItem(book, sort());
    expect(isBookFull(book, designees)).toBe(true);
  });
});

describe('RG-8.13 carte perdue', () => {
  it('l’emplacement désigné redevient vide et affiche la perte', () => {
    const a = carte('012', 1);
    const book = removeItem(withItems(a), a.id, { cause: 'vol', par: 'p-kevin', a: 50_700_000 });
    const slot = layoutBook(book, designees).designes[11]?.slot;
    expect(slot).toEqual({ etat: 'perdu', perte: { cardId: '012', cause: 'vol', par: 'p-kevin', a: 50_700_000 } });
    if (slot?.etat === 'perdu') {
      expect(describeLoss(slot.perte, () => 'Kevin', () => '14h05')).toBe('Volée par Kevin à 14h05');
    }
  });

  it('si un doublon reste, il reprend l’emplacement désigné', () => {
    const a = carte('012', 1);
    const b = carte('012', 2);
    const book = removeItem(withItems(a, b), a.id, { cause: 'revente', a: 3 });
    const l = layoutBook(book, designees);
    expect(l.designes[11]?.slot).toEqual({ etat: 'plein', item: b });
    expect(l.libresUtilises).toBe(0);
  });

  it('un sort utilisé disparaît sans trace de perte', () => {
    const s = sort();
    const book = removeItem(withItems(s), s.id);
    expect(book).toEqual(emptyBook());
  });

  it('retirer un élément absent est une erreur', () => {
    expect(() => removeItem(emptyBook(), 'nope')).toThrow();
  });
});
