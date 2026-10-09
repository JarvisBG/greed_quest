import type { Rank } from '@gq/shared';
import { describe, expect, it } from 'vitest';
import { emptyBook, type Book, type BookItem, type CardItem } from './book.js';
import { checkClear, countedCards, rank, validateRewards, type RankedPlayer } from './ranking.js';

const rangs: Record<string, Rank> = { '001': 'D', '002': 'C', '003': 'A', '004': 'SS' };
const rangDe = (id: string) => rangs[id] ?? 'D';
const designees = ['001', '002', '003', '004'];

const carte = (id: string, cardId: string, obtenuA = 0, extra: Partial<CardItem> = {}): CardItem => ({
  kind: 'carte',
  id,
  cardId,
  origine: { type: 'balise', baliseId: 'b' },
  obtenuA,
  ...extra,
});
const book = (...items: BookItem[]): Book => ({ ...emptyBook(), items });
const joueur = (id: string, b: Book, jenny = 0, status: RankedPlayer['status'] = 'actif'): RankedPlayer => ({ id, status, book: b, jenny });
const copie = (id: string, cardId: string, obtenuA = 0) => carte(id, cardId, obtenuA, { faux: { nature: 'copie' } });

describe('RG-13.5 critères dans l’ordre', () => {
  it('1. nombre de cartes désignées distinctes (doublons ignorés)', () => {
    const r = rank(
      [joueur('A', book(carte('a', '001'), carte('b', '001'))), joueur('B', book(carte('c', '001'), carte('d', '002')))],
      designees,
      'final',
      rangDe,
    );
    expect(r.map((e) => [e.playerId, e.cartes, e.place])).toEqual([
      ['B', 2, 1],
      ['A', 1, 2],
    ]);
  });

  it('2. somme des rangs', () => {
    const r = rank([joueur('A', book(carte('a', '001'))), joueur('B', book(carte('b', '003')))], designees, 'final', rangDe);
    expect(r.map((e) => [e.playerId, e.points])).toEqual([
      ['B', 4],
      ['A', 1],
    ]);
  });

  it('3. jenny, puis 4. dernière carte obtenue le plus tôt', () => {
    const r = rank(
      [
        joueur('A', book(carte('a', '001', 500)), 10),
        joueur('B', book(carte('b', '001', 900)), 20),
        joueur('C', book(carte('c', '001', 100)), 10),
      ],
      designees,
      'final',
      rangDe,
    );
    expect(r.map((e) => e.playerId)).toEqual(['B', 'C', 'A']);
  });

  it('ex æquo : même place', () => {
    const r = rank([joueur('A', emptyBook(), 5), joueur('B', emptyBook(), 5), joueur('C', emptyBook(), 1)], designees, 'live', rangDe);
    expect(r.map((e) => e.place)).toEqual([1, 1, 3]);
  });

  it('les disqualifiés ne sont pas classés', () => {
    expect(rank([joueur('A', emptyBook(), 0, 'disqualifie')], designees, 'live', rangDe)).toEqual([]);
  });
});

describe('RG-13.7 contrefaçons : live vs final', () => {
  const p = joueur('A', book(carte('a', '001'), copie('f', '003')));

  it('live : la contrefaçon compte (rien n’est trahi)', () => {
    expect(rank([p], designees, 'live', rangDe)[0]).toMatchObject({ cartes: 2, points: 5 });
  });

  it('final : seules les vraies', () => {
    expect(rank([p], designees, 'final', rangDe)[0]).toMatchObject({ cartes: 1, points: 1 });
  });

  it('final : un doublon déguisé compte pour sa vraie carte', () => {
    const b = book(carte('a', '001', 0), carte('d', '003', 50, { faux: { nature: 'deguise', vraieCarteId: '002' } }));
    expect([...countedCards(b, designees, 'final').keys()].sort()).toEqual(['001', '002']);
    expect([...countedCards(b, designees, 'live').keys()].sort()).toEqual(['001', '003']);
  });

  it('final : l’heure retenue est celle du premier vrai exemplaire', () => {
    const b = book(carte('a', '001', 300), carte('b', '001', 100));
    expect(countedCards(b, designees, 'final').get('001')).toBe(100);
  });
});

describe('RG-13.1 Clear', () => {
  const tous = (extra?: (i: number) => Partial<CardItem>) => book(...designees.map((c, i) => carte(`x${i}`, c, i, extra?.(i) ?? {})));

  it('incomplet', () => {
    expect(checkClear(book(carte('a', '001')), designees)).toEqual({ etat: 'incomplet', manquantes: 3 });
  });

  it('complet avec de vraies cartes', () => {
    expect(checkClear(tous(), designees)).toEqual({ etat: 'complet' });
  });

  it('une contrefaçon : refus avec le numéro de page, sans dire laquelle', () => {
    const many = Array.from({ length: 30 }, (_, i) => String(i + 1).padStart(3, '0'));
    const b = book(...many.map((c, i) => (i === 14 ? copie(`x${i}`, c) : carte(`x${i}`, c))));
    expect(checkClear(b, many)).toEqual({ etat: 'contrefacon', page: 2 });
  });

  it('une copie démasquée laisse l’emplacement vide : Livre incomplet', () => {
    const b = tous((i) => (i === 0 ? { faux: { nature: 'copie' }, marque: 'demasquee' } : {}));
    expect(checkClear(b, designees)).toEqual({ etat: 'incomplet', manquantes: 1 });
  });
});

describe('RG-13.3 récompense', () => {
  const b = book(carte('a', '001'), carte('b', '002'), carte('c', '003'), carte('c2', '003'), carte('n', '999'));

  it('3 cartes désignées distinctes', () => {
    expect(validateRewards(b, designees, ['a', 'b', 'c'])).toEqual({ ok: true, cardIds: ['001', '002', '003'] });
  });

  it('refus : nombre, doublon de carte, carte non désignée ou absente', () => {
    expect(validateRewards(b, designees, ['a', 'b'])).toMatchObject({ ok: false });
    expect(validateRewards(b, designees, ['a', 'c', 'c2'])).toMatchObject({ ok: false, message: 'Choisis 3 cartes différentes' });
    expect(validateRewards(b, designees, ['a', 'b', 'n'])).toMatchObject({ ok: false });
    expect(validateRewards(b, designees, ['a', 'b', 'zz'])).toMatchObject({ ok: false });
  });
});
