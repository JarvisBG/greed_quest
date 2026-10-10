import type { Rank } from '@gq/shared';
import { describe, expect, it } from 'vitest';
import { emptyBook, layoutBook, transferItem, type Book, type BookItem, type CardItem } from './book.js';
import {
  TRANSFORMATION_COOLDOWN_MS,
  countInCirculation,
  expertise,
  revealItems,
  transform,
  viewCard,
  type TransformInput,
} from './counterfeits.js';

const carte = (id: string, cardId: string, extra: Partial<CardItem> = {}, obtenuA = 0): CardItem => ({
  kind: 'carte',
  id,
  cardId,
  origine: { type: 'balise', baliseId: 'b' },
  obtenuA,
  ...extra,
});
const book = (...items: BookItem[]): Book => ({ ...emptyBook(), items });
const designees = ['001', '002', '003'];

const copie = (id: string, cardId: string, marque?: 'creee' | 'demasquee') =>
  carte(id, cardId, { faux: { nature: 'copie' }, ...(marque ? { marque } : {}) });
const deguise = (id: string, cardId: string, vraie: string) =>
  carte(id, cardId, { faux: { nature: 'deguise', vraieCarteId: vraie }, marque: 'creee' });

describe('RG-8.6 comptage dans les limites', () => {
  it('copie : ne compte nulle part ; déguisé : compte pour sa vraie carte', () => {
    const c = countInCirculation([
      book(carte('a', '001'), copie('b', '001')),
      book(deguise('c', '002', '003'), carte('d', '003')),
    ]);
    expect(Object.fromEntries(c)).toEqual({ '001': 1, '003': 2 });
  });
});

describe('RG-8.6 / RG-8.9 emplacement désigné', () => {
  it('une contrefaçon non démasquée occupe l’emplacement désigné de sa carte', () => {
    const l = layoutBook(book(copie('f', '002')), designees);
    expect(l.designes[1]?.slot).toMatchObject({ etat: 'plein', item: { id: 'f' } });
  });

  it('une copie démasquée libère l’emplacement désigné et part en emplacement libre', () => {
    const l = layoutBook(book(copie('f', '002', 'demasquee')), designees);
    expect(l.designes[1]?.slot).toEqual({ etat: 'vide' });
    expect(l.libresUtilises).toBe(1);
  });
});

describe('RG-8.9 affichage selon ce que chacun sait', () => {
  it('le créateur voit sa contrefaçon marquée', () => {
    expect(viewCard(copie('f', '002', 'creee'), true)).toEqual({ itemId: 'f', cardId: '002', apparence: 'normale', badge: 'contrefacon' });
  });

  it('démasquée : grisée pour le détenteur, normale pour les autres (RG-11.6)', () => {
    const f = copie('f', '002', 'demasquee');
    expect(viewCard(f, true).apparence).toBe('grisee');
    expect(viewCard(f, false)).toEqual({ itemId: 'f', cardId: '002', apparence: 'normale' });
  });

  it('une contrefaçon reçue paraît vraie', () => {
    expect(viewCard(copie('f', '002'), true)).toEqual({ itemId: 'f', cardId: '002', apparence: 'normale' });
  });

  it('la marque disparaît au changement de main : l’emplacement désigné est repris chez le receveur', () => {
    const t = transferItem(book(copie('f', '002', 'demasquee')), emptyBook(), 'f', {
      now: 5,
      origine: { type: 'echange', avec: 'A' },
      perte: { cause: 'echange', par: 'B' },
    });
    expect(t.item).not.toHaveProperty('marque');
    expect(layoutBook(t.to, designees).designes[1]?.slot).toMatchObject({ etat: 'plein' });
  });
});

describe('RG-8.9 révélation', () => {
  it('un doublon déguisé redevient sa vraie carte', () => {
    const b = revealItems(book(deguise('d', '002', '003')), ['d']);
    expect(b.items[0]).toEqual(carte('d', '003'));
  });

  it('une copie devient « contrefaçon » démasquée', () => {
    expect(revealItems(book(copie('f', '002')), ['f']).items[0]).toMatchObject({ marque: 'demasquee', faux: { nature: 'copie' } });
  });

  it('ne touche pas aux autres éléments', () => {
    const vraie = carte('v', '001');
    expect(revealItems(book(vraie, copie('f', '002')), ['f']).items[0]).toBe(vraie);
  });
});

describe('RG-8.8 expertise PNJ à Antokiba', () => {
  const b = book(carte('v', '001'), copie('f', '002'), deguise('d', 'X', '003'));

  it('une page : 10 J', () => {
    const r = expertise(b, designees, { page: 1 }, 50);
    expect(r).toMatchObject({ ok: true, cout: 10, contrefacons: ['f'] });
  });

  it('le Book entier : 25 J, trouve aussi les contrefaçons hors page', () => {
    const r = expertise(b, designees, 'livre', 50);
    expect(r).toMatchObject({ ok: true, cout: 25, contrefacons: ['f', 'd'] });
    if (r.ok) expect(r.book.items.find((i) => i.id === 'd')).toMatchObject({ cardId: '003' });
  });

  it('refus : jenny insuffisants ou page inexistante', () => {
    expect(expertise(b, designees, 'livre', 20)).toMatchObject({ ok: false, code: 'jenny_insuffisants' });
    expect(expertise(b, designees, { page: 99 }, 50)).toMatchObject({ ok: false, code: 'page_invalide' });
  });

  it('une copie déjà démasquée n’est pas recomptée', () => {
    expect(expertise(book(copie('f', '002', 'demasquee')), designees, 'livre', 50)).toMatchObject({ contrefacons: [] });
  });
});

describe('RG-5.4 / RG-8.7 Transformation (Texture Surprise)', () => {
  const rangs: Record<string, Rank> = { '001': 'C', '002': 'C', '003': 'B', '010': 'SS', '011': 'S', '012': 'S' };
  const input = (over: Partial<TransformInput> = {}): TransformInput => ({
    now: 1000,
    gameState: 'en_cours',
    nen: 'transformation',
    disponibleA: null,
    book: book(carte('a', '001'), carte('b', '001')),
    itemId: 'b',
    cibleCardId: '002',
    rangDe: (id) => rangs[id],
    ...over,
  });

  it('déguise un doublon en carte de même rang, marquée pour son créateur', () => {
    const r = transform(input());
    expect(r).toMatchObject({
      ok: true,
      item: { id: 'b', cardId: '002', faux: { nature: 'deguise', vraieCarteId: '001' }, marque: 'creee' },
      disponibleA: 1000 + TRANSFORMATION_COOLDOWN_MS,
    });
  });

  it('Amendement 2026-10-09 : un doublon S peut imiter la SS (unique au catalogue) ; jamais un rang plus bas', () => {
    const s = book(carte('a', '011'), carte('b', '011'));
    expect(transform(input({ book: s, cibleCardId: '010' }))).toMatchObject({ ok: true, item: { cardId: '010', faux: { nature: 'deguise', vraieCarteId: '011' } } });
    expect(transform(input({ book: s, cibleCardId: '012' }))).toMatchObject({ ok: true });
    expect(transform(input({ cibleCardId: '010' }))).toMatchObject({ code: 'carte_invalide' }); // doublon C → SS : non
    expect(transform(input({ book: book(carte('a', '003'), carte('b', '003')), cibleCardId: '011' }))).toMatchObject({ code: 'carte_invalide' }); // B → S : non
  });

  it('le déguisé compte toujours pour sa vraie carte', () => {
    const r = transform(input());
    if (r.ok) expect(Object.fromEntries(countInCirculation([r.book]))).toEqual({ '001': 2 });
  });

  it('refus : pas un doublon, rang différent, même carte, contrefaçon', () => {
    expect(transform(input({ book: book(carte('b', '001')) }))).toMatchObject({ code: 'pas_un_doublon' });
    expect(transform(input({ cibleCardId: '003' }))).toMatchObject({ code: 'carte_invalide' });
    expect(transform(input({ cibleCardId: '001' }))).toMatchObject({ code: 'carte_invalide' });
    expect(transform(input({ book: book(carte('a', '001'), copie('b', '001')) }))).toMatchObject({ code: 'pas_un_doublon' });
  });

  it('refus : autre Nen, recharge de 20 min, partie fermée', () => {
    expect(transform(input({ nen: 'emission' }))).toMatchObject({ code: 'pouvoir_indisponible' });
    expect(transform(input({ disponibleA: 1000 + 5 * 60_000 }))).toMatchObject({
      code: 'recharge',
      message: 'Texture Surprise sera prête dans 5 min',
    });
    expect(transform(input({ gameState: 'pause' }))).toMatchObject({ code: 'partie_fermee' });
  });
});
