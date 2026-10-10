import type { ObjetType, Rank } from '@gq/shared';
import { describe, expect, it } from 'vitest';
import { emptyBook, isBookFull, layoutBook, transferItem, type Book, type BookItem, type CardItem, type ObjetItem } from './book.js';
import type { Position } from './geo.js';
import { DEFAULT_OBJETS_CONFIG, PLACES_OBJETS, direction, gratterTicket, objetDeRepli, utiliserBoussole, utiliserCoffre } from './objets.js';
import { seededRng, sequenceRng } from './rng.js';
import { checkScan, type ScanContext } from './scan.js';
import { sellObjet } from './shop.js';
import { castRadar, castRegard, takeableCards, type SpellPlayer, type SpellWorld } from './spells.js';
import { trade, type TradeInput } from './trades.js';

const NOW = 10_000_000;
const M = 1 / 111_195; // degrés par mètre (latitude)
const ici: Position = { lat: 48.85, lng: 2.35, precisionM: 5, a: NOW };

const objet = (id: string, o: ObjetType, obtenuA = 0): ObjetItem => ({ kind: 'objet', id, objet: o, obtenuA });
const carte = (id: string, cardId = id, extra: Partial<CardItem> = {}): CardItem => ({
  kind: 'carte',
  id,
  cardId,
  origine: { type: 'balise', baliseId: 'b' },
  obtenuA: 0,
  ...extra,
});
const book = (...items: BookItem[]): Book => ({ ...emptyBook(), items });
const code = (r: { ok: boolean; code?: string }) => (r.ok ? 'ok' : r.code);

describe('Amendement 2026-10-10 : cartes objets', () => {
  it('section à part : les objets ne prennent pas les places libres du Livre (RG-8.5)', () => {
    const b = book(...Array.from({ length: 15 }, (_, i) => objet(`o${i}`, 'pepite')), carte('c1', '001'));
    const l = layoutBook(b, ['001']);
    expect(l.libresUtilises).toBe(0);
    expect(l.designes[0]!.slot.etat).toBe('plein');
    expect(isBookFull(b, ['001'])).toBe(false);
  });

  it('repli « carte épuisée » : un objet en plus des jenny selon objetsReplisPct, rien si la section est pleine', () => {
    expect(objetDeRepli(emptyBook(), 100, seededRng(1))).not.toBeNull();
    expect(objetDeRepli(emptyBook(), 0, seededRng(1))).toBeNull();
    expect(objetDeRepli(emptyBook(), 33, sequenceRng([0.5]))).toBeNull();
    const plein = book(...Array.from({ length: PLACES_OBJETS }, (_, i) => objet(`o${i}`, 'voile')));
    expect(objetDeRepli(plein, 100, seededRng(1))).toBeNull();
    // Tirage pondéré : Pépite et Ticket les plus fréquents, Voile et Coffre les plus rares.
    const rng = seededRng(7);
    const n: Record<string, number> = {};
    for (let i = 0; i < 6000; i++) {
      const o = objetDeRepli(emptyBook(), 100, rng)!;
      n[o] = (n[o] ?? 0) + 1;
    }
    expect(n.pepite!).toBeGreaterThan(n.boussole!);
    expect(n.boussole!).toBeGreaterThan(n.voile!);
  });

  it('Ticket de la Fortune : gratté, il rapporte un gain du tableau et disparaît', () => {
    const p = { status: 'actif' as const, book: book(objet('t', 'ticket')) };
    const r = gratterTicket({ gameState: 'en_cours' }, p, 't', seededRng(3));
    expect(r.ok && r.book.items).toEqual([]);
    expect(r.ok && DEFAULT_OBJETS_CONFIG.ticket.map(([g]) => g)).toContain(r.ok ? r.gain : -1);
    expect(code(gratterTicket({ gameState: 'en_cours' }, p, 'x', seededRng(3)))).toBe('objet_absent');
    expect(code(gratterTicket({ gameState: 'pause' }, p, 't', seededRng(3)))).toBe('partie_fermee');
  });

  it('Boussole du chercheur : direction de la balise active la plus proche jamais scannée, jamais la distance', () => {
    expect(direction(ici, { lat: ici.lat + 0.01, lng: ici.lng })).toBe('N');
    expect(direction(ici, { lat: ici.lat, lng: ici.lng - 0.01 })).toBe('O');
    expect(direction(ici, { lat: ici.lat - 0.01, lng: ici.lng + 0.01 })).toBe('SE');
    const balises = [
      { id: 'vue', state: 'active', type: 'standard', position: { lat: ici.lat + 10 * M, lng: ici.lng } },
      { id: 'dort', state: 'dormante', type: null, position: { lat: ici.lat + 20 * M, lng: ici.lng } },
      { id: 'fantome', state: 'active', type: 'fantome', position: { lat: ici.lat + 30 * M, lng: ici.lng } },
      { id: 'sans_pos', state: 'active', type: 'standard', position: null },
      { id: 'sud', state: 'active', type: 'rare', position: { lat: ici.lat - 200 * M, lng: ici.lng } },
      { id: 'loin', state: 'active', type: 'standard', position: { lat: ici.lat + 900 * M, lng: ici.lng } },
    ];
    const p = { status: 'actif' as const, book: book(objet('b', 'boussole')), position: ici, historiqueTirages: ['vue'] };
    const r = utiliserBoussole({ gameState: 'en_cours', now: NOW }, p, 'b', balises);
    expect(r).toEqual({ ok: true, book: emptyBook(), direction: 'S' });
    // Aucune balise à indiquer : refus, la Boussole n'est pas consommée.
    expect(code(utiliserBoussole({ gameState: 'en_cours', now: NOW }, p, 'b', balises.slice(0, 4)))).toBe('aucune_balise');
    expect(code(utiliserBoussole({ gameState: 'en_cours', now: NOW }, { ...p, position: null }, 'b', balises))).toBe('gps_invalide');
  });

  it('Coffre scellé : la carte ne peut être ni volée ni prise pendant 20 min ; la protection ne suit pas la carte', () => {
    const rangDe = (): Rank => 'C';
    const p = { status: 'actif' as const, book: book(objet('k', 'coffre'), carte('c1', '001'), carte('c2', '002')) };
    const r = utiliserCoffre({ gameState: 'en_cours', now: NOW, dureeMs: 20 * 60_000 }, p, 'k', 'c1');
    expect(r.ok && r.jusqua).toBe(NOW + 20 * 60_000);
    const b = r.ok ? r.book : emptyBook();
    expect(takeableCards(b, NOW, rangDe).map((c) => c.id)).toEqual(['c2']);
    expect(takeableCards(b, NOW + 20 * 60_000, rangDe).map((c) => c.id)).toEqual(['c1', 'c2']);
    const t = transferItem(b, emptyBook(), 'c1', { now: NOW, origine: { type: 'echange', avec: 'P' }, perte: { cause: 'echange' } });
    expect(t.item).not.toHaveProperty('coffreJusqua');
    expect(code(utiliserCoffre({ gameState: 'en_cours', now: NOW, dureeMs: 1 }, p, 'k', 'k'))).toBe('carte_absente');
  });

  const world: SpellWorld = { now: NOW, gameState: 'en_cours', portee: { porteeM: 30, margeMaxM: 20 }, rangDe: () => 'C', newId: () => 'n' };
  const lanceur = (spell: 'radar' | 'regard'): SpellPlayer => ({
    id: 'A',
    status: 'actif',
    position: ici,
    book: book({ kind: 'sort', id: 's', spell, obtenuA: 0 }),
    nen: 'transformation',
    pouvoirsA: {},
    immuniteJusqua: null,
    dernierOffensifA: null,
    geleJusqua: null,
    livreGele: false,
  });

  it('Voile d’ombre : bloque le prochain Radar ; sort consommé, voile consommé, le lanceur ne voit rien', () => {
    const cibleBook = book(objet('v', 'voile'), carte('c1', '001'));
    const r = castRadar(world, { lanceur: lanceur('radar'), itemId: 's', cible: { id: 'B', position: ici, book: cibleBook }, zones: [] });
    expect(r).toMatchObject({ ok: true, resultat: { zoneId: null }, notice: { resultat: 'bloque', sort: 'radar' } });
    expect(r.ok && r.lanceur.book.items).toEqual([]);
    expect(r.ok && r.voile?.cibleBook.items.map((i) => i.id)).toEqual(['c1']);
  });

  it('Voile d’ombre : bloque le prochain Regard', () => {
    const cible = { id: 'B', book: book(objet('v', 'voile'), carte('c1', '001')), livreGele: false };
    const r = castRegard(world, { lanceur: lanceur('regard'), itemId: 's', cible, rencontre: true });
    expect(r).toMatchObject({ ok: true, resultat: { cartes: [] }, notice: { resultat: 'bloque' } });
    const sans = castRegard(world, { lanceur: lanceur('regard'), itemId: 's', cible: { ...cible, book: book(carte('c1', '001')) }, rencontre: true });
    expect(sans.ok && sans.voile).toBeUndefined();
  });

  it('Second souffle : la boucle (RG-7.1) ne s’applique pas, les autres vérifications oui', () => {
    const ctx: ScanContext = {
      now: NOW,
      gameState: 'en_cours',
      zonesFermees: new Set(),
      k: 3,
      player: { status: 'actif', geleJusqua: null, positionValide: true, historiqueTirages: ['b1'], dernierTirageA: null, livrePlein: false },
      beacon: { id: 'b1', state: 'active', zoneId: 'z1', stock: 5 },
    };
    expect(code(checkScan(ctx))).toBe('boucle');
    expect(code(checkScan({ ...ctx, ignorerBoucle: true }))).toBe('ok');
    expect(code(checkScan({ ...ctx, ignorerBoucle: true, beacon: { ...ctx.beacon, state: 'epuisee' } }))).toBe('balise_epuisee');
  });

  it('les objets s’échangent comme les cartes (RG-11), pas les sorts', () => {
    const t = (itemIds: string[]): TradeInput => ({
      now: NOW,
      gameState: 'en_cours',
      a: { id: 'A', status: 'actif', book: book(objet('p', 'pepite'), { kind: 'sort', id: 's', spell: 'gel', obtenuA: 0 }), jenny: 0, livreGele: false },
      b: { id: 'B', status: 'actif', book: book(carte('c', '001')), jenny: 0, livreGele: false },
      donneA: { itemIds, jenny: 0 },
      donneB: { itemIds: ['c'], jenny: 0 },
      dernierEchangePaireA: null,
    });
    const r = trade(t(['p']), () => 'C');
    expect(r.ok && r.b.book.items.map((i) => i.kind)).toEqual(['objet']);
    expect(code(trade(t(['s']), () => 'C'))).not.toBe('ok');
  });

  it('revente à Masadora : Pépite d’or 30 J, autres objets 10 J, le Ticket se gratte', () => {
    const c = { now: NOW, gameState: 'en_cours' as const, qrBoutiqueScanne: true, designees: [] };
    const p = { id: 'P', status: 'actif' as const, position: ici, jenny: 0, book: book(objet('p', 'pepite'), objet('v', 'voile'), objet('t', 'ticket')) };
    expect(sellObjet(c, p, 'p')).toMatchObject({ ok: true, prix: 30, player: { jenny: 30 } });
    expect(sellObjet(c, p, 'v')).toMatchObject({ ok: true, prix: 10 });
    expect(code(sellObjet(c, p, 't'))).toBe('revente_interdite');
    expect(code(sellObjet({ ...c, qrBoutiqueScanne: false }, p, 'p'))).toBe('pas_sur_place');
  });
});
