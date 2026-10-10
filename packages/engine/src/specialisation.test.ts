import type { Rank } from '@gq/shared';
import { describe, expect, it } from 'vitest';
import { emptyBook, type Book, type BookItem, type CardItem } from './book.js';
import type { Position } from './geo.js';
import { seededRng } from './rng.js';
import { activerFortune, activerZetsu, alchimie, estInvisible, pouvoirSpeDepuisReponse, QUESTION_SPE, speDisponibleDans, tirerPouvoirSpe } from './specialisation.js';
import { castOffensive, castRadar, castRegard, type SpellPlayer, type SpellWorld } from './spells.js';

const NOW = 100 * 60_000;
const MIN = 60_000;
const RECHARGE = 40 * MIN;
const ici: Position = { lat: 48.85, lng: 2.35, precisionM: 0, a: NOW };
const rangs: Record<string, Rank> = { SS1: 'SS', S1: 'S', A1: 'A', A2: 'A', B1: 'B', C1: 'C' };
const rangDe = (id: string): Rank => rangs[id] ?? 'D';
const designees = Object.keys(rangs);
const carte = (id: string, cardId: string, extra: Partial<CardItem> = {}): CardItem => ({ kind: 'carte', id, cardId, origine: { type: 'balise', baliseId: 'b' }, obtenuA: 0, ...extra });
const book = (...items: BookItem[]): Book => ({ ...emptyBook(), items });
const code = (r: { ok: boolean; code?: string }) => (r.ok ? 'ok' : r.code);
const ctx = { now: NOW, gameState: 'en_cours' as const, rechargeMs: RECHARGE };

describe('Amendement 2026-10-10 : pouvoirs de Spécialisation (RG-5.4)', () => {
  it('pouvoir tiré au hasard parmi les 4 ; recharge de 40 min après usage', () => {
    const rng = seededRng(4);
    const vus = new Set(Array.from({ length: 200 }, () => tirerPouvoirSpe(rng)));
    expect([...vus].sort()).toEqual(['alchimie', 'bandit', 'fortune', 'zetsu']);
    expect(speDisponibleDans({ pouvoirSpe: 'zetsu', speA: null }, 'zetsu', NOW, RECHARGE)).toBe(0);
    expect(speDisponibleDans({ pouvoirSpe: 'zetsu', speA: NOW - 10 * MIN }, 'zetsu', NOW, RECHARGE)).toBe(30 * MIN);
    expect(speDisponibleDans({ pouvoirSpe: 'zetsu', speA: null }, 'bandit', NOW, RECHARGE)).toBeNull();
  });

  it('Zetsu : 10 min d’invisibilité, refus pendant la recharge', () => {
    const j = { pouvoirSpe: 'zetsu' as const, speA: null, status: 'actif' as const };
    const r = activerZetsu({ ...ctx, dureeMs: 10 * MIN }, j);
    expect(r).toEqual({ ok: true, speA: NOW, zetsuJusqua: NOW + 10 * MIN });
    expect(estInvisible({ zetsuJusqua: NOW + 10 * MIN }, NOW + 9 * MIN)).toBe(true);
    expect(estInvisible({ zetsuJusqua: NOW + 10 * MIN }, NOW + 10 * MIN)).toBe(false);
    expect(activerZetsu({ ...ctx, dureeMs: 10 * MIN }, { ...j, speA: NOW - MIN })).toMatchObject({ ok: false, message: 'Ton pouvoir se recharge encore 39 min' });
    expect(code(activerZetsu({ ...ctx, dureeMs: 1 }, { ...j, pouvoirSpe: 'bandit' }))).toBe('pouvoir_indisponible');
  });

  it('Fortune : arme le prochain scan, une fois', () => {
    const j = { pouvoirSpe: 'fortune' as const, speA: null, status: 'actif' as const, fortuneArmee: false };
    expect(activerFortune(ctx, j)).toEqual({ ok: true, speA: NOW });
    expect(code(activerFortune(ctx, { ...j, fortuneArmee: true }))).toBe('deja_armee');
  });

  describe('Alchimie', () => {
    const c = { ...ctx, newId: () => 'neuf', designees, rangDe, sousLimite: () => true };
    const j = (b: Book) => ({ pouvoirSpe: 'alchimie' as const, speA: null, status: 'actif' as const, book: b });
    // A1 occupe son emplacement ; le second A1 est un doublon.
    const livre = book(carte('a', 'A1'), carte('d', 'A1'), carte('c', 'C1'));

    it('un doublon devient une carte choisie du même rang ou du rang au-dessus', () => {
      const r = alchimie(c, j(livre), 'd', 'S1');
      expect(r).toMatchObject({ ok: true, resultat: 'reussi', speA: NOW, carte: { cardId: 'S1', origine: { type: 'alchimie' } } });
      expect(r.ok && r.book.items.map((i) => i.id)).toEqual(['a', 'c', 'neuf']);
      expect(alchimie(c, j(livre), 'd', 'A2')).toMatchObject({ ok: true });
    });

    it('jamais la SS, jamais plus d’un rang au-dessus ni en dessous, ni une carte rangée à sa place, ni au-delà de la limite', () => {
      expect(alchimie(c, j(livre), 'd', 'SS1')).toMatchObject({ ok: false, message: 'L’alchimie ne peut pas créer la SS' });
      expect(code(alchimie(c, j(book(carte('a', 'A1'), carte('b', 'C1'), carte('d', 'C1'))), 'd', 'A1'))).toBe('carte_invalide');
      expect(code(alchimie(c, j(livre), 'd', 'B1'))).toBe('carte_invalide');
      expect(code(alchimie(c, j(livre), 'a', 'S1'))).toBe('carte_absente'); // carte dans son emplacement désigné
      expect(code(alchimie({ ...c, sousLimite: () => false }, j(livre), 'd', 'S1'))).toBe('limite_atteinte');
    });

    it('une contrefaçon ne se transforme pas : elle disparaît, le pouvoir est consommé', () => {
      const faux = book(carte('a', 'A1'), carte('d', 'A1', { faux: { nature: 'copie' } }));
      const r = alchimie(c, j(faux), 'd', 'S1');
      expect(r).toMatchObject({ ok: true, resultat: 'contrefacon', carte: null, speA: NOW });
      expect(r.ok && r.book.items.map((i) => i.id)).toEqual(['a']);
    });
  });

  const w = (over: Partial<SpellWorld> = {}): SpellWorld => ({ now: NOW, gameState: 'en_cours', portee: { porteeM: 30, margeMaxM: 20 }, rangDe, newId: () => 'n', rechargeSpeMs: RECHARGE, ...over });
  const joueur = (id: string, over: Partial<SpellPlayer> = {}): SpellPlayer => ({
    id,
    status: 'actif',
    position: ici,
    book: emptyBook(),
    nen: 'specialisation',
    pouvoirsA: {},
    immuniteJusqua: null,
    dernierOffensifA: null,
    geleJusqua: null,
    livreGele: false,
    ...over,
  });

  it('Bandit : un Vol sans carte de sort ; la carte visée est prise si la cible l’a, jamais la SS', () => {
    const bandit = joueur('A', { pouvoirSpe: 'bandit', speA: null });
    const cible = joueur('B', { nen: 'emission', book: book(carte('ss', 'SS1'), carte('s', 'S1'), carte('d1', 'D9'), carte('d2', 'D8')) });
    const vol = (voulue: string, b = bandit) => castOffensive(w(), { sort: 'vol', source: { type: 'pouvoir' }, lanceur: b, cible, carteVoulueId: voulue }, seededRng(1));
    const r = vol('S1');
    expect(r).toMatchObject({ ok: true, resultat: 'reussi', recu: { id: 's' } });
    expect(r.ok && r.lanceur.speA).toBe(NOW);
    // SS visée : refusée comme cible, le Vol prend une carte au hasard.
    for (let s = 1; s < 20; s++) {
      const x = castOffensive(w(), { sort: 'vol', source: { type: 'pouvoir' }, lanceur: bandit, cible: { ...cible, book: book(carte('ss', 'SS1'), carte('d1', 'D9')) }, carteVoulueId: 'SS1' }, seededRng(s));
      if (x.ok && x.recu?.id === 'ss') throw new Error('la SS ne doit pas être visée');
      if (x.ok && x.recu?.id === 'd1') break;
    }
    expect(code(vol('S1', { ...bandit, speA: NOW - MIN }))).toBe('pouvoir_indisponible');
    expect(code(vol('S1', { ...bandit, pouvoirSpe: 'zetsu' }))).toBe('pouvoir_indisponible');
  });

  it('Zetsu : un joueur invisible ne peut être visé ni par un sort offensif, ni par Radar, ni par Regard ; attaquer rompt le Zetsu', () => {
    const cache = joueur('B', { zetsuJusqua: NOW + 5 * MIN, book: book(carte('c', 'C1')) });
    const lanceur = joueur('A', { book: book({ kind: 'sort', id: 'v', spell: 'vol', obtenuA: 0 }, { kind: 'sort', id: 'r', spell: 'radar', obtenuA: 0 }, { kind: 'sort', id: 'g', spell: 'regard', obtenuA: 0 }) });
    expect(code(castOffensive(w(), { sort: 'vol', source: { type: 'carte', itemId: 'v' }, lanceur, cible: cache }, seededRng(1)))).toBe('cible_hors_radar');
    expect(code(castRadar(w(), { lanceur, itemId: 'r', cible: cache, zones: [] }))).toBe('cible_hors_radar');
    expect(code(castRegard(w(), { lanceur, itemId: 'g', cible: { ...cache, livreGele: false }, rencontre: true }))).toBe('cible_hors_radar');
    const attaquant = { ...lanceur, zetsuJusqua: NOW + 5 * MIN };
    const r = castOffensive(w(), { sort: 'vol', source: { type: 'carte', itemId: 'v' }, lanceur: attaquant, cible: joueur('C', { book: book(carte('c', 'C1')) }) }, seededRng(1));
    expect(r.ok && r.lanceur.zetsuJusqua).toBeNull();
  });
});

describe('RG-5.4 amendé le 2026-10-10 : question secrète de Wing', () => {
  it('RG-5.4 : chaque réponse donne un pouvoir différent, les quatre sont couverts', () => {
    const donnes = QUESTION_SPE.choix.map((_, i) => pouvoirSpeDepuisReponse(i));
    expect(donnes).toEqual(['alchimie', 'bandit', 'zetsu', 'fortune']);
    expect(new Set(donnes).size).toBe(4);
  });

  it('RG-5.4 : une réponse hors de la liste ne donne rien', () => {
    expect(pouvoirSpeDepuisReponse(4)).toBeNull();
    expect(pouvoirSpeDepuisReponse(-1)).toBeNull();
    expect(pouvoirSpeDepuisReponse(1.5)).toBeNull();
  });
});
