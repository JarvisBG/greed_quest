import type { Rank, SpellType } from '@gq/shared';
import { describe, expect, it } from 'vitest';
import { emptyBook, type Book, type BookItem, type CardItem } from './book.js';
import type { Position } from './geo.js';
import { seededRng } from './rng.js';
import {
  CASTER_DELAY_MS,
  GEL_MS,
  IMMUNITY_MS,
  SS_THEFT_IMMUNITY_MS,
  castAnalyse,
  castBarrier,
  castDuplication,
  castOffensive,
  castRadar,
  castRegard,
  castRevelation,
  pouvoirDisponibleDans,
  type OffensiveInput,
  type SpellPlayer,
  type SpellWorld,
} from './spells.js';

const NOW = 10_000_000;
const M = 1 / 111_195;
const pos = (nordM: number, a = NOW): Position => ({ lat: 48.85 + nordM * M, lng: 2.35, precisionM: 0, a });

let n = 0;
const world = (over: Partial<SpellWorld> = {}): SpellWorld => ({
  now: NOW,
  gameState: 'en_cours',
  portee: { porteeM: 30, margeMaxM: 20 },
  rangDe: (cardId) => (cardId.startsWith('SS') ? 'SS' : 'C') as Rank,
  newId: () => `new${n++}`,
  ...over,
});

const carte = (id: string, cardId = id, obtenuA = 0, extra: Partial<CardItem> = {}): CardItem => ({
  kind: 'carte',
  id,
  cardId,
  origine: { type: 'balise', baliseId: 'b' },
  obtenuA,
  ...extra,
});
function mkSort(id: string, spell: SpellType, obtenuA = 0): BookItem {
  return { kind: 'sort', id, spell, obtenuA };
}
const book = (...items: BookItem[]): Book => ({ ...emptyBook(), items });

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

const offensive = (over: Partial<OffensiveInput> = {}): OffensiveInput => ({
  sort: 'gel',
  source: { type: 'carte', itemId: 'sp' },
  lanceur: player('A', { book: book(mkSort('sp', 'gel')) }),
  cible: player('B', { position: pos(10) }),
  ...over,
});

const rng = () => seededRng(5);
const code = (r: { ok: boolean; code?: string }) => (r.ok ? 'ok' : r.code);

describe('RG-10 sorts offensifs : refus (rien n’est consommé)', () => {
  it('partie en pause (RG-4.4) ou lanceur sans GPS (RG-7.6)', () => {
    expect(code(castOffensive(world({ gameState: 'pause' }), offensive(), rng()))).toBe('partie_fermee');
    const sansGps = offensive({ lanceur: player('A', { position: null, book: book(mkSort('sp', 'gel')) }) });
    expect(code(castOffensive(world(), sansGps, rng()))).toBe('gps_invalide');
  });

  it('sort absent du Book', () => {
    expect(code(castOffensive(world(), offensive({ sort: 'vol' }), rng()))).toBe('sort_absent');
  });

  it('RG-10.3 délai de 2 min entre deux offensifs', () => {
    const lanceur = player('A', { book: book(mkSort('sp', 'gel')), dernierOffensifA: NOW - CASTER_DELAY_MS + 30_000 });
    expect(castOffensive(world(), offensive({ lanceur }), rng())).toMatchObject({
      ok: false,
      message: 'Attends encore 30 s avant un nouveau sort offensif',
    });
  });

  it('RG-10.11 hors de portée, RG-10.10 hors radar', () => {
    expect(code(castOffensive(world(), offensive({ cible: player('B', { position: pos(80) }) }), rng()))).toBe('cible_hors_portee');
    // Amendement RG-10.10 : 200 s sans position, encore ciblable ; au-delà de 10 min, hors radar.
    expect(code(castOffensive(world(), offensive({ cible: player('B', { position: pos(5, NOW - 200_000) }) }), rng()))).not.toBe('cible_hors_radar');
    expect(code(castOffensive(world(), offensive({ cible: player('B', { position: pos(5, NOW - 600_001) }) }), rng()))).toBe(
      'cible_hors_radar',
    );
  });

  it('RG-10.2 cible immunisée', () => {
    const cible = player('B', { position: pos(10), immuniteJusqua: NOW + 60_000 });
    expect(code(castOffensive(world(), offensive({ cible }), rng()))).toBe('cible_immunisee');
  });

  it('RG-13.1 Book gelé après Clear provisoire', () => {
    expect(code(castOffensive(world(), offensive({ cible: player('B', { position: pos(10), livreGele: true }) }), rng()))).toBe(
      'cible_livre_gele',
    );
  });

  it('se viser soi-même', () => {
    const lanceur = offensive().lanceur;
    expect(code(castOffensive(world(), offensive({ cible: lanceur }), rng()))).toBe('cible_invalide');
  });
});

describe('Gel', () => {
  it('gèle 3 min, immunise 5 min, notifie (RG-10.5 / 10.6)', () => {
    const r = castOffensive(world(), offensive(), rng());
    expect(r).toMatchObject({
      ok: true,
      resultat: 'reussi',
      notice: { lanceur: 'A', cible: 'B', sort: 'gel', resultat: 'reussi' },
    });
    if (!r.ok) return;
    expect(r.cible.geleJusqua).toBe(NOW + GEL_MS);
    expect(r.cible.immuniteJusqua).toBe(NOW + IMMUNITY_MS);
    expect(r.lanceur.book.items).toHaveLength(0);
    expect(r.lanceur.dernierOffensifA).toBe(NOW);
  });
});

describe('RG-10.4 protections', () => {
  it('Barrière d’abord : consommée, sort perdu, pas d’immunité', () => {
    const cible = player('B', { position: pos(10), nen: 'renforcement', book: book(mkSort('bar', 'barriere')) });
    const r = castOffensive(world(), offensive({ cible }), rng());
    expect(r).toMatchObject({ ok: true, resultat: 'bloque', protection: 'barriere' });
    if (!r.ok) return;
    expect(r.cible.book.items).toHaveLength(0);
    expect(r.cible.pouvoirsA).toEqual({});
    expect(r.cible.immuniteJusqua).toBeNull();
    expect(r.lanceur.book.items).toHaveLength(0);
  });

  it('puis Renforcement, une fois par partie', () => {
    const cible = player('B', { position: pos(10), nen: 'renforcement' });
    const r = castOffensive(world(), offensive({ cible }), rng());
    expect(r).toMatchObject({ ok: true, resultat: 'bloque', protection: 'renforcement' });
    if (!r.ok) return;
    expect(r.cible.pouvoirsA).toEqual({ renforcement: NOW });

    const encore = castOffensive(world(), offensive({ cible: r.cible }), rng());
    expect(encore).toMatchObject({ ok: true, resultat: 'reussi' });
  });

  it('Amendement 2026-10-10 : Renforcement se recharge (30 min par défaut)', () => {
    const recharge = { renforcement: 30 * 60_000 };
    const cible = player('B', { position: pos(10), nen: 'renforcement', pouvoirsA: { renforcement: NOW - 30 * 60_000 + 1 } });
    expect(castOffensive(world({ rechargeNenMs: recharge }), offensive({ cible }), rng())).toMatchObject({ resultat: 'reussi' });
    const pret = { ...cible, pouvoirsA: { renforcement: NOW - 30 * 60_000 } };
    const r = castOffensive(world({ rechargeNenMs: recharge }), offensive({ cible: pret }), rng());
    expect(r).toMatchObject({ resultat: 'bloque', protection: 'renforcement' });
    expect(r.ok && r.cible.pouvoirsA).toEqual({ renforcement: NOW });
  });

  it('Amendement 2026-10-10 : temps avant le prochain usage (pouvoirDisponibleDans)', () => {
    const j = { nen: 'emission' as const, pouvoirsA: { emission: NOW - 10 * 60_000 } };
    expect(pouvoirDisponibleDans(j, 'emission', NOW, 40 * 60_000)).toBe(30 * 60_000);
    expect(pouvoirDisponibleDans(j, 'emission', NOW, undefined)).toBeNull(); // sans recharge : une fois par partie
    expect(pouvoirDisponibleDans({ nen: 'emission', pouvoirsA: {} }, 'emission', NOW, undefined)).toBe(0);
    expect(pouvoirDisponibleDans(j, 'manipulation', NOW, 1)).toBeNull();
  });
});

describe('Vol', () => {
  const lanceur = player('A', { book: book(mkSort('sp', 'vol')) });

  it('prend 1 exemplaire, provenance et perte (RG-8.13 / 8.14), marque effacée', () => {
    const cible = player('B', { position: pos(10), book: book(carte('x1', '007', 0, { faux: { nature: 'copie' }, marque: 'creee' })) });
    const r = castOffensive(world(), offensive({ sort: 'vol', lanceur, cible }), rng());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.recu).toEqual({ kind: 'carte', id: 'x1', cardId: '007', origine: { type: 'vol', sur: 'B' }, obtenuA: NOW, faux: { nature: 'copie' } });
    expect(r.lanceur.book.items).toEqual([r.recu]);
    expect(r.cible.book.items).toEqual([]);
    expect(r.cible.book.pertes).toEqual([{ cardId: '007', cause: 'vol', par: 'A', a: NOW }]);
  });

  it('ne prend jamais un sort', () => {
    const cible = player('B', { position: pos(10), book: book(mkSort('g', 'gel')) });
    expect(castOffensive(world(), offensive({ sort: 'vol', lanceur, cible }), rng())).toMatchObject({ ok: true, resultat: 'sans_effet' });
  });

  it('RG-8.11 une SS obtenue il y a moins de 10 min est intouchable', () => {
    const recente = player('B', { position: pos(10), book: book(carte('ss', 'SS01', NOW - SS_THEFT_IMMUNITY_MS + 1)) });
    expect(castOffensive(world(), offensive({ sort: 'vol', lanceur, cible: recente }), rng())).toMatchObject({ resultat: 'sans_effet' });
    const ancienne = player('B', { position: pos(10), book: book(carte('ss', 'SS01', NOW - SS_THEFT_IMMUNITY_MS)) });
    expect(castOffensive(world(), offensive({ sort: 'vol', lanceur, cible: ancienne }), rng())).toMatchObject({ resultat: 'reussi' });
  });
});

describe('Échange forcé', () => {
  it('donne la carte choisie, reçoit une carte au hasard de la cible', () => {
    const lanceur = player('A', { book: book(mkSort('sp', 'echange_force'), carte('a1', '001')) });
    const cible = player('B', { position: pos(10), book: book(carte('b1', '002')) });
    const r = castOffensive(world(), offensive({ sort: 'echange_force', lanceur, cible, carteDonneeId: 'a1' }), rng());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lanceur.book.items.map((i) => i.id)).toEqual(['b1']);
    expect(r.cible.book.items.map((i) => i.id)).toEqual(['a1']);
    expect(r.cible.book.pertes).toEqual([{ cardId: '002', cause: 'echange_force', par: 'A', a: NOW }]);
  });

  it('refusé sans carte à donner', () => {
    const lanceur = player('A', { book: book(mkSort('sp', 'echange_force')) });
    expect(code(castOffensive(world(), offensive({ sort: 'echange_force', lanceur }), rng()))).toBe('carte_absente');
  });

  it('Manipulation : 1 échange forcé gratuit par partie', () => {
    const lanceur = player('A', { nen: 'manipulation', book: book(carte('a1', '001')) });
    const cible = player('B', { position: pos(10), book: book(carte('b1', '002')) });
    const input = offensive({ sort: 'echange_force', source: { type: 'pouvoir' }, lanceur, cible, carteDonneeId: 'a1' });
    const r = castOffensive(world(), input, rng());
    expect(r).toMatchObject({ ok: true, resultat: 'reussi' });
    if (!r.ok) return;
    expect(r.lanceur.pouvoirsA).toEqual({ manipulation: NOW });
    const plusTard = NOW + 10 * 60_000;
    const encore = castOffensive(
      world({ now: plusTard }),
      { ...input, lanceur: { ...r.lanceur, position: pos(0, plusTard) }, cible: { ...r.cible, position: pos(10, plusTard), immuniteJusqua: null } },
      rng(),
    );
    expect(code(encore)).toBe('pouvoir_indisponible');
    // Amendement 2026-10-10 : rechargé après 40 min.
    const recharge = { manipulation: 40 * 60_000 };
    const apres = NOW + 40 * 60_000;
    const rechargee = castOffensive(
      world({ now: apres, rechargeNenMs: recharge }),
      { ...input, lanceur: { ...r.lanceur, dernierOffensifA: null, position: pos(0, apres), book: book(carte('a2', '003')) }, cible: { ...r.cible, position: pos(10, apres), immuniteJusqua: null }, carteDonneeId: 'a2' },
      rng(),
    );
    expect(rechargee).toMatchObject({ ok: true, resultat: 'reussi' });
    expect(code(castOffensive(world({ now: plusTard, rechargeNenMs: recharge }), { ...input, lanceur: { ...r.lanceur, position: pos(0, plusTard) }, cible: { ...r.cible, position: pos(10, plusTard), immuniteJusqua: null } }, rng()))).toBe('pouvoir_indisponible');
  });
});

describe('Émission (RG-10.1)', () => {
  it('vise une fois un joueur hors portée', () => {
    const lanceur = player('A', { nen: 'emission', book: book(mkSort('sp', 'gel'), mkSort('sp2', 'gel')) });
    const loin = player('B', { position: pos(500) });
    expect(code(castOffensive(world(), offensive({ lanceur, cible: loin }), rng()))).toBe('cible_hors_portee');
    const r = castOffensive(world(), offensive({ lanceur, cible: loin, emission: true }), rng());
    expect(r).toMatchObject({ ok: true, resultat: 'reussi' });
    if (!r.ok) return;
    expect(r.lanceur.pouvoirsA).toEqual({ emission: NOW });
  });

  it('n’est pas consommée si la cible est à portée', () => {
    const lanceur = player('A', { nen: 'emission', book: book(mkSort('sp', 'gel')) });
    const r = castOffensive(world(), offensive({ lanceur, emission: true }), rng());
    expect(r.ok && r.lanceur.pouvoirsA).toEqual({});
  });
});

describe('Sorts non offensifs', () => {
  it('Barrière : passive, ne se lance pas', () => {
    expect(castBarrier()).toMatchObject({ ok: false, code: 'sort_passif' });
  });

  it('Radar : zone de la dernière position connue', () => {
    const zones = [{ id: 'masadora', polygon: [{ lat: 48, lng: 2 }, { lat: 48, lng: 3 }, { lat: 49, lng: 3 }, { lat: 49, lng: 2 }] }];
    const lanceur = player('A', { book: book(mkSort('r', 'radar')) });
    const r = castRadar(world(), { lanceur, itemId: 'r', cible: { id: 'B', position: pos(0, 0) }, zones });
    expect(r).toMatchObject({ ok: true, resultat: { zoneId: 'masadora' }, notice: { cible: 'B', sort: 'radar' } });
    expect(r.ok && r.lanceur.book.items).toEqual([]);
  });

  it('Amendement 2026-10-09 : Regard montre les cartes d’un joueur déjà rencontré, contrefaçons comprises (non démasquées = vraies)', () => {
    const lanceur = player('A', { book: book(mkSort('g', 'regard')) });
    const livreB = book(
      carte('c1', 'SS1'),
      carte('c2', 'X'),
      carte('c3', 'X'),
      carte('c4', 'Y', 0, { faux: { nature: 'copie' }, marque: 'creee' }),
      carte('c5', 'Z', 0, { faux: { nature: 'copie' }, marque: 'demasquee' }),
      mkSort('s', 'vol'),
    );
    const r = castRegard(world(), { lanceur, itemId: 'g', cible: { id: 'B', book: livreB, livreGele: false }, rencontre: true });
    expect(r).toMatchObject({ ok: true, notice: { lanceur: 'A', cible: 'B', sort: 'regard', resultat: 'reussi' } });
    expect(r.ok && r.resultat.cartes).toEqual([
      { cardId: 'SS1', n: 1, contrefacon: false },
      { cardId: 'X', n: 2, contrefacon: false },
      { cardId: 'Y', n: 1, contrefacon: false }, // bluff : la fausse paraît vraie
      { cardId: 'Z', n: 1, contrefacon: true }, // déjà démasquée par son détenteur
    ]);
    expect(r.ok && r.lanceur.book.items).toEqual([]);
  });

  it('Regard : refus sans rencontre, sur soi-même, sur un Book gelé (RG-13.1) ; le sort n’est pas consommé', () => {
    const lanceur = player('A', { book: book(mkSort('g', 'regard')) });
    const cible = { id: 'B', book: emptyBook(), livreGele: false };
    expect(castRegard(world(), { lanceur, itemId: 'g', cible, rencontre: false })).toMatchObject({
      ok: false,
      code: 'cible_non_rencontree',
      message: 'Tu n’as encore jamais croisé ce joueur',
    });
    expect(castRegard(world(), { lanceur, itemId: 'g', cible: { ...cible, id: 'A' }, rencontre: true })).toMatchObject({ code: 'cible_invalide' });
    expect(castRegard(world(), { lanceur, itemId: 'g', cible: { ...cible, livreGele: true }, rencontre: true })).toMatchObject({ code: 'cible_livre_gele' });
  });

  it('Révélation : zone d’une balise rare active, ou rien', () => {
    const lanceur = player('A', { book: book(mkSort('r', 'revelation')) });
    expect(castRevelation(world(), { lanceur, itemId: 'r', balisesRaresActives: [{ zoneId: 'z2' }] }, rng())).toMatchObject({
      resultat: { zoneId: 'z2' },
    });
    expect(castRevelation(world(), { lanceur, itemId: 'r', balisesRaresActives: [] }, rng())).toMatchObject({
      resultat: { zoneId: null },
      notice: { resultat: 'sans_effet' },
    });
  });

  it('RG-10.7 Duplication : vraie copie sous la limite, contrefaçon à la limite', () => {
    const lanceur = player('A', { book: book(mkSort('d', 'duplication'), carte('c', '004')) });
    const vraie = castDuplication(world(), { lanceur, itemId: 'd', carteItemId: 'c', sousLimite: () => true });
    expect(vraie.ok && vraie.resultat.copie).toMatchObject({ cardId: '004', origine: { type: 'duplication' } });
    expect(vraie.ok && vraie.resultat.copie.faux).toBeUndefined();

    const fausse = castDuplication(world(), { lanceur, itemId: 'd', carteItemId: 'c', sousLimite: () => false });
    expect(fausse.ok && fausse.resultat.copie).toMatchObject({ faux: { nature: 'copie' }, marque: 'creee' });
    expect(fausse.ok && fausse.lanceur.book.items.map((i) => i.id)).toEqual(['c', expect.any(String)]);
  });

  it('Duplication d’une contrefaçon : toujours une contrefaçon', () => {
    const lanceur = player('A', { book: book(mkSort('d', 'duplication'), carte('c', '004', 0, { faux: { nature: 'copie' } })) });
    const r = castDuplication(world(), { lanceur, itemId: 'd', carteItemId: 'c', sousLimite: () => true });
    expect(r.ok && r.resultat.copie.faux).toEqual({ nature: 'copie' });
  });

  it('RG-10.8 Analyse : révèle les contrefaçons d’une page de son Book', () => {
    const designees = ['001', '002'];
    const lanceur = player('A', {
      book: book(mkSort('an', 'analyse'), carte('vrai', '001'), carte('faux', '002', 1, { faux: { nature: 'copie' } })),
    });
    const r = castAnalyse(world(), { lanceur, itemId: 'an', page: 1, designees });
    expect(r).toMatchObject({ ok: true, resultat: { contrefacons: ['faux'] } });
    if (!r.ok) return;
    expect(r.lanceur.book.items.find((i) => i.id === 'faux')).toMatchObject({ marque: 'demasquee' });
    expect(code(castAnalyse(world(), { lanceur, itemId: 'an', page: 9, designees }))).toBe('page_invalide');
  });
});
