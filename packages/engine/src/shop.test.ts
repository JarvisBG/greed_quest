import type { Rank } from '@gq/shared';
import { describe, expect, it } from 'vitest';
import { emptyBook, type Book, type BookItem, type CardItem } from './book.js';
import { countInCirculation } from './counterfeits.js';
import type { Position } from './geo.js';
import { seededRng } from './rng.js';
import { WAVE_DURATION_MS, buyPack, currentWave, sellCard, type ShopContext, type ShopPlayer, type ShopWave } from './shop.js';

const NOW = 3_000_000;
const pos: Position = { lat: 48.85, lng: 2.35, precisionM: 5, a: NOW };
const designees = ['001', '002'];
const rangs: Record<string, Rank> = { '001': 'D', '002': 'B', A01: 'A', SS1: 'SS' };
const rangDe = (id: string) => rangs[id] ?? 'C';

const carte = (id: string, cardId: string, extra: Partial<CardItem> = {}): CardItem => ({
  kind: 'carte',
  id,
  cardId,
  origine: { type: 'balise', baliseId: 'b' },
  obtenuA: 0,
  ...extra,
});
const book = (...items: BookItem[]): Book => ({ ...emptyBook(), items });
const sorts = (n: number) => Array.from({ length: n }, (_, i): BookItem => ({ kind: 'sort', id: `s${i}`, spell: 'gel', obtenuA: 0 }));

const player = (over: Partial<ShopPlayer> = {}): ShopPlayer => ({ id: 'P', status: 'actif', position: pos, jenny: 200, book: emptyBook(), ...over });
const ctx = (over: Partial<ShopContext> = {}): ShopContext => ({ now: NOW, gameState: 'en_cours', qrBoutiqueScanne: true, designees, ...over });
const wave = (over: Partial<ShopWave> = {}): ShopWave => ({ index: 0, stock: 5, achats: {}, ...over });

let n = 0;
const buy = (p = player(), w = wave(), over: Partial<ShopContext> & { multiplicateurPrix?: number } = {}) =>
  buyPack({ ...ctx(over), wave: w, newId: () => `new${n++}`, ...(over.multiplicateurPrix ? { multiplicateurPrix: over.multiplicateurPrix } : {}) }, p, seededRng(2));

const code = (r: { ok: boolean; code?: string }) => (r.ok ? 'ok' : r.code);

describe('RG-9.3 vagues de 20 min', () => {
  it('nouvelle vague : stock recalculé, compteurs remis à zéro', () => {
    const w = currentWave(null, 0, 0, 8);
    expect(w).toEqual({ index: 0, stock: 8, achats: {} });
    const used = { ...w, stock: 3, achats: { P: 2 } };
    expect(currentWave(used, WAVE_DURATION_MS - 1, 0, 20)).toBe(used);
    expect(currentWave(used, WAVE_DURATION_MS, 0, 20)).toEqual({ index: 1, stock: 20, achats: {} });
  });
});

describe('RG-9.2 achat d’un paquet', () => {
  it('3 sorts, 50 J, stock et compteur de la vague mis à jour', () => {
    const r = buy();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.prix).toBe(50);
    expect(r.player.jenny).toBe(150);
    expect(r.sorts).toHaveLength(3);
    expect(r.player.book.items).toHaveLength(3);
    expect(r.wave).toMatchObject({ stock: 4, achats: { P: 1 } });
  });

  it('Krach de Masadora : moitié prix', () => {
    expect(buy(player(), wave(), { multiplicateurPrix: 0.5 })).toMatchObject({ ok: true, prix: 25 });
  });

  it('refus : pas sur place, sans GPS, pause, joueur gelé', () => {
    expect(code(buy(player(), wave(), { qrBoutiqueScanne: false }))).toBe('pas_sur_place');
    expect(code(buy(player({ position: null })))).toBe('gps_invalide');
    expect(code(buy(player(), wave(), { gameState: 'pause' }))).toBe('partie_fermee');
    expect(code(buy(player({ status: 'gele' })))).toBe('joueur_bloque');
  });

  it('refus : stock de la vague épuisé, 2 paquets max par joueur', () => {
    expect(code(buy(player(), wave({ stock: 0 })))).toBe('stock_epuise');
    expect(buy(player(), wave({ achats: { P: 2 } }))).toMatchObject({ code: 'limite_joueur', message: 'Maximum 2 paquets par vague' });
  });

  it('refus : jenny insuffisants, moins de 3 emplacements libres', () => {
    expect(code(buy(player({ jenny: 49 })))).toBe('jenny_insuffisants');
    expect(code(buy(player({ book: book(...sorts(13)) })))).toBe('livre_plein');
    expect(code(buy(player({ book: book(...sorts(12)) })))).toBe('ok');
  });
});

describe('RG-9.4 revente', () => {
  it('prix par rang ; l’exemplaire sort du jeu et libère la limite', () => {
    const p = player({ jenny: 0, book: book(carte('x', '002'), carte('y', '002')) });
    const r = sellCard(ctx(), p, 'x', rangDe);
    expect(r).toMatchObject({ ok: true, prix: 20, contrefacon: null, cardId: '002' });
    if (!r.ok) return;
    expect(r.player.jenny).toBe(20);
    expect(countInCirculation([r.player.book]).get('002')).toBe(1);
    expect(r.player.book.pertes).toEqual([{ cardId: '002', cause: 'revente', a: NOW }]);
  });

  it('les SS ne se revendent pas', () => {
    expect(code(sellCard(ctx(), player({ book: book(carte('s', 'SS1')) }), 's', rangDe))).toBe('revente_interdite');
  });

  it('les sorts ne se revendent pas', () => {
    expect(code(sellCard(ctx(), player({ book: book(...sorts(1)) }), 's0', rangDe))).toBe('carte_absente');
  });

  it('refus hors de la boutique', () => {
    expect(code(sellCard(ctx({ qrBoutiqueScanne: false }), player({ book: book(carte('x', '001')) }), 'x', rangDe))).toBe('pas_sur_place');
  });
});

describe('RG-8.9 Masadora révèle les contrefaçons vendues', () => {
  it('copie non démasquée : 1 J, révélée à la vente', () => {
    const p = player({ jenny: 0, book: book(carte('f', 'A01', { faux: { nature: 'copie' } })) });
    expect(sellCard(ctx(), p, 'f', rangDe)).toMatchObject({ ok: true, prix: 1, contrefacon: 'copie' });
  });

  it('copie démasquée : 1 J', () => {
    const p = player({ book: book(carte('f', 'SS1', { faux: { nature: 'copie' }, marque: 'demasquee' })) });
    expect(sellCard(ctx(), p, 'f', rangDe)).toMatchObject({ ok: true, prix: 1 });
  });

  it('doublon déguisé : prix de sa vraie carte', () => {
    const p = player({ book: book(carte('d', '001', { faux: { nature: 'deguise', vraieCarteId: '002' } })) });
    expect(sellCard(ctx(), p, 'd', rangDe)).toMatchObject({ ok: true, prix: 20, contrefacon: 'deguise', cardId: '002' });
  });

  it('une SS apparente non démasquée est refusée (rien n’est révélé)', () => {
    const p = player({ book: book(carte('f', 'SS1', { faux: { nature: 'copie' } })) });
    expect(code(sellCard(ctx(), p, 'f', rangDe))).toBe('revente_interdite');
  });
});
