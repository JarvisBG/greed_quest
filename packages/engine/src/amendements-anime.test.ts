// Amendements « fidélité à l'anime » du 2026-10-10 (REGLES.md) : cartes cachées (RG-8.5), Vol et Pickpocket,
// Voyance et Clairvoyance, Accompagnement, Retour (RG-10), rattrapage désactivé (RG-5.6).
import type { Rank, SpellType } from '@gq/shared';
import { describe, expect, it } from 'vitest';
import { cartesParEmplacement, deplacerCarte, emptyBook, layoutBook, type Book, type BookItem, type CardItem } from './book.js';
import { checkClear } from './ranking.js';
import type { Position } from './geo.js';
import { DEFAULT_SETTINGS, resolveParams } from './params.js';
import { seededRng } from './rng.js';
import { ACCOMPAGNEMENT_MS, castOffensive, castRegard, castRetour, type OffensiveInput, type SpellPlayer, type SpellWorld } from './spells.js';

const NOW = 10_000_000;
const M = 1 / 111_195;
const pos = (nordM: number): Position => ({ lat: 48.85 + nordM * M, lng: 2.35, precisionM: 0, a: NOW });
const designees = ['001', '002', '003'];
const carte = (id: string, cardId: string, obtenuA = 0, extra: Partial<CardItem> = {}): CardItem => ({
  kind: 'carte',
  id,
  cardId,
  origine: { type: 'balise', baliseId: 'b' },
  obtenuA,
  ...extra,
});
const sort = (id: string, spell: SpellType): BookItem => ({ kind: 'sort', id, spell, obtenuA: 0 });
const book = (...items: BookItem[]): Book => ({ ...emptyBook(), items });
let n = 0;
const world = (over: Partial<SpellWorld> = {}): SpellWorld => ({
  now: NOW,
  gameState: 'en_cours',
  portee: { porteeM: 30, margeMaxM: 20 },
  rangDe: () => 'C' as Rank,
  newId: () => `new${n++}`,
  designees,
  ...over,
});
const player = (id: string, over: Partial<SpellPlayer> = {}): SpellPlayer => ({
  id,
  status: 'actif',
  position: pos(0),
  book: emptyBook(),
  nen: 'transformation',
  pouvoirsA: {},
  immuniteJusqua: null,
  dernierOffensifA: null,
  geleJusqua: null,
  livreGele: false,
  ...over,
});
const offensive = (over: Partial<OffensiveInput>): OffensiveInput => ({
  sort: 'vol',
  source: { type: 'carte', itemId: 'sp' },
  lanceur: player('A', { book: book(sort('sp', 'vol')) }),
  cible: player('B', { position: pos(10) }),
  ...over,
});

describe('RG-8.5 amendé : cacher une carte dans les emplacements libres', () => {
  const b = book(carte('x1', '001'), carte('x2', '002'), carte('x3', '002', 5));

  it('RG-8.5 : une carte cachée quitte son emplacement fixe (le doublon le reprend) et va dans les libres', () => {
    const r = deplacerCarte(b, designees, 'x1', true);
    expect(r.ok).toBe(true);
    const l = layoutBook(r.ok ? r.book : b, designees);
    expect(l.designes[0]).toMatchObject({ cardId: '001', slot: { etat: 'vide' } });
    expect(l.libresUtilises).toBe(2); // x1 cachée + x3 doublon
    const r2 = deplacerCarte(b, designees, 'x2', true);
    const l2 = layoutBook(r2.ok ? r2.book : b, designees);
    expect(l2.designes[1]).toMatchObject({ slot: { etat: 'plein', item: { id: 'x3' } } }); // le doublon reprend l'emplacement
  });

  it('RG-8.5 / RG-13.1 : seules les cartes en place comptent pour le Clear', () => {
    const complet = book(carte('a', '001'), carte('b', '002'), carte('c', '003'));
    expect(checkClear(complet, designees).etat).toBe('complet');
    const r = deplacerCarte(complet, designees, 'b', true);
    expect(r.ok && checkClear(r.book, designees).etat).toBe('incomplet');
    const remise = r.ok ? deplacerCarte(r.book, designees, 'b', false) : r;
    expect(remise.ok && checkClear(remise.book, designees).etat).toBe('complet');
  });

  it('RG-8.5 : refus clairs (pas en place, pas cachée, emplacement occupé, plus de place libre)', () => {
    expect(deplacerCarte(b, designees, 'x3', true)).toMatchObject({ ok: false, code: 'pas_en_place' });
    expect(deplacerCarte(b, designees, 'x1', false)).toMatchObject({ ok: false, code: 'pas_cachee' });
    const cachee = deplacerCarte(b, designees, 'x2', true);
    expect(cachee.ok && deplacerCarte(cachee.book, designees, 'x2', false)).toMatchObject({ ok: false, code: 'emplacement_occupe' });
    const plein = book(carte('p', '001'), ...Array.from({ length: 15 }, (_, i) => sort(`s${i}`, 'gel')));
    expect(deplacerCarte(plein, designees, 'p', true)).toMatchObject({ ok: false, code: 'place_libre' });
  });

  it('RG-8.5 : une carte cachée qui change de main n’est plus cachée', () => {
    const r = deplacerCarte(book(carte('x1', '001')), designees, 'x1', true);
    const cible = player('B', { position: pos(10), book: r.ok ? r.book : emptyBook() });
    const res = castOffensive(world(), offensive({ sort: 'pickpocket', lanceur: player('A', { book: book(sort('sp', 'pickpocket')) }), cible }), seededRng(1));
    expect(res.ok && res.recu).toMatchObject({ id: 'x1' });
    expect(res.ok && (res.recu as CardItem).cachee).toBeUndefined();
  });
});

describe('RG-10 amendé : Vol (emplacements fixes) et Pickpocket (emplacements libres)', () => {
  // x1 en place ; x2 doublon (libre) ; x3 cachée (libre).
  const base = book(carte('x1', '001'), carte('x2', '001', 5), carte('x3', '002', 0, { cachee: true }));

  it('RG-10 : Vol ne prend que dans les emplacements fixes', () => {
    for (let s = 1; s <= 20; s++) {
      const r = castOffensive(world(), offensive({ cible: player('B', { position: pos(10), book: base }) }), seededRng(s));
      expect(r.ok && r.recu?.id).toBe('x1');
    }
  });

  it('RG-10 : Pickpocket ne prend que dans les emplacements libres (doublons et cartes cachées)', () => {
    const vus = new Set<string>();
    for (let s = 1; s <= 30; s++) {
      const r = castOffensive(
        world(),
        offensive({ sort: 'pickpocket', lanceur: player('A', { book: book(sort('sp', 'pickpocket')) }), cible: player('B', { position: pos(10), book: base }) }),
        seededRng(s),
      );
      if (r.ok && r.recu) vus.add(r.recu.id);
    }
    expect([...vus].sort()).toEqual(['x2', 'x3']);
  });

  it('RG-10 : Vol sans carte en place = sans effet, sort consommé', () => {
    const r = castOffensive(world(), offensive({ cible: player('B', { position: pos(10), book: book(carte('x3', '002', 0, { cachee: true })) }) }), seededRng(1));
    expect(r).toMatchObject({ ok: true, resultat: 'sans_effet' });
  });

  it('cartesParEmplacement : fixes et libres', () => {
    const e = cartesParEmplacement(base, designees);
    expect(e.fixes.map((c) => c.id)).toEqual(['x1']);
    expect(e.libres.map((c) => c.id).sort()).toEqual(['x2', 'x3']);
  });
});

describe('RG-10 amendé : Voyance (libres) et Clairvoyance (fixes)', () => {
  const cible = { id: 'B', book: book(carte('x1', '001'), carte('x2', '001', 5), carte('x3', '002', 0, { cachee: true })), livreGele: false };

  it('RG-10 : Voyance montre les emplacements libres, Clairvoyance les fixes', () => {
    const voyance = castRegard(world(), { lanceur: player('A', { book: book(sort('g', 'regard')) }), itemId: 'g', cible, rencontre: true });
    expect(voyance.ok && voyance.resultat.cartes).toEqual([
      { cardId: '002', n: 1, contrefacon: false }, // cachée
      { cardId: '001', n: 1, contrefacon: false }, // doublon
    ]);
    const clair = castRegard(world(), { lanceur: player('A', { book: book(sort('c', 'clairvoyance')) }), itemId: 'c', cible, rencontre: true, sort: 'clairvoyance' });
    expect(clair).toMatchObject({ ok: true, notice: { sort: 'clairvoyance' } });
    expect(clair.ok && clair.resultat.cartes).toEqual([{ cardId: '001', n: 1, contrefacon: false }]);
  });

  it('RG-10 : Clairvoyance exige la carte Clairvoyance et un joueur déjà croisé', () => {
    const lanceur = player('A', { book: book(sort('g', 'regard')) });
    expect(castRegard(world(), { lanceur, itemId: 'g', cible, rencontre: true, sort: 'clairvoyance' })).toMatchObject({ ok: false, code: 'sort_absent' });
    const l2 = player('A', { book: book(sort('c', 'clairvoyance')) });
    expect(castRegard(world(), { lanceur: l2, itemId: 'c', cible, rencontre: false, sort: 'clairvoyance' })).toMatchObject({ ok: false, code: 'cible_non_rencontree' });
  });
});

describe('RG-10 amendé : Accompagnement', () => {
  const acc = (over: Partial<OffensiveInput> = {}) =>
    offensive({
      sort: 'accompagnement',
      lanceur: player('A', { book: book(sort('sp', 'accompagnement')) }),
      cible: player('B', { position: pos(5_000) }), // très loin : pas de portée exigée
      rencontre: true,
      ...over,
    });

  it('RG-10 : Accompagnement gèle 3 min un joueur déjà croisé, même hors de portée', () => {
    const r = castOffensive(world(), acc(), seededRng(1));
    expect(r).toMatchObject({ ok: true, resultat: 'reussi', cible: { geleJusqua: NOW + ACCOMPAGNEMENT_MS, accompagneJusqua: NOW + ACCOMPAGNEMENT_MS } });
    expect(r.ok && r.lanceur.dernierOffensifA).toBe(NOW);
  });

  it('RG-10 : refusé sans rencontre ; bloqué par le Mur défensif', () => {
    expect(castOffensive(world(), acc({ rencontre: false }), seededRng(1))).toMatchObject({ ok: false, code: 'cible_non_rencontree' });
    const protegee = player('B', { position: pos(5_000), book: book(sort('m', 'barriere')) });
    expect(castOffensive(world(), acc({ cible: protegee }), seededRng(1))).toMatchObject({ ok: true, resultat: 'bloque', protection: 'barriere' });
  });

  it('RG-10 : sous Accompagnement, la cible ne peut lancer aucun sort', () => {
    const accompagne = player('A', { book: book(sort('sp', 'vol')), accompagneJusqua: NOW + 60_000 });
    expect(castOffensive(world(), offensive({ lanceur: accompagne }), seededRng(1))).toMatchObject({ ok: false, code: 'lanceur_bloque' });
  });
});

describe('RG-10 amendé : Retour', () => {
  it('RG-10 : Retour exige une ville déjà visitée et consomme la carte', () => {
    const lanceur = player('A', { book: book(sort('r', 'retour')) });
    expect(castRetour(world(), { lanceur, itemId: 'r', ville: 'antokiba', visitees: ['masadora'] })).toMatchObject({ ok: false, code: 'ville_inconnue' });
    const r = castRetour(world(), { lanceur, itemId: 'r', ville: 'masadora', visitees: ['masadora'] });
    expect(r).toMatchObject({ ok: true, resultat: { ville: 'masadora' } });
    expect(r.ok && r.lanceur.book.items).toEqual([]);
  });
});

describe('RG-5.6 amendé : pas de bonus de rattrapage par défaut', () => {
  it('RG-5.6 : rattrapageJParMin vaut 0 par défaut', () => {
    const p = resolveParams(DEFAULT_SETTINGS, { J: 20, balisesPosees: 30, balisesActivesCourantes: 0 });
    expect(p.rattrapageJParMin).toBe(0);
  });
});
