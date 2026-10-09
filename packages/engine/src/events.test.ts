import type { Rank } from '@gq/shared';
import { describe, expect, it } from 'vitest';
import type { Beacon } from './beacons.js';
import { emptyBook, transferItem, type Book, type BookItem, type CardItem } from './book.js';
import { countInCirculation, viewCard } from './counterfeits.js';
import {
  SS_RETURN_INACTIVITY_MS,
  answerRaid,
  announce,
  cancelEvent,
  closedZones,
  endApparition,
  expireEvents,
  gainsPerDraw,
  raidRewards,
  reclaimSS,
  shopPriceMultiplier,
  startApparition,
  startCurse,
  startMission,
  startRaid,
  startSimpleEvent,
  triggerCurse,
  validateMission,
  type GameEvent,
} from './events.js';
import { DEFAULT_SHOP_CONFIG } from './shop.js';
import { seededRng } from './rng.js';

const NOW = 1_000_000;
const MIN = 60_000;
const rng = () => seededRng(9);
let n = 0;
const newId = () => `id${n++}`;
const base = (events: GameEvent[] = [], over: Partial<{ gameState: 'en_cours' | 'pause'; now: number }> = {}) => ({
  id: `ev${n++}`,
  now: NOW,
  gameState: 'en_cours' as const,
  events,
  ...over,
});
const rangDe = (id: string): Rank => (id.startsWith('SS') ? 'SS' : 'C');

const carte = (id: string, cardId = id, extra: Partial<CardItem> = {}): CardItem => ({
  kind: 'carte',
  id,
  cardId,
  origine: { type: 'balise', baliseId: 'b' },
  obtenuA: 0,
  ...extra,
});
const book = (...items: BookItem[]): Book => ({ ...emptyBook(), items });

const ok = <T extends { ok: boolean }>(r: T) => {
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r as Extract<T, { ok: true }>;
};

describe('RG-12.1 un seul événement de zone à la fois par zone', () => {
  it('refus d’un 2e événement de zone, globaux cumulables', () => {
    const zm = ok(startSimpleEvent(base(), 'zone_maudite', 'z1')).event;
    expect(startSimpleEvent(base([zm]), 'double_gain', 'z1')).toMatchObject({ ok: false });
    expect(startSimpleEvent(base([zm]), 'double_gain', 'z2').ok).toBe(true);
    const k1 = ok(startSimpleEvent(base([zm]), 'krach', null)).event;
    expect(startSimpleEvent(base([zm, k1]), 'krach', null).ok).toBe(true);
  });

  it('un événement terminé libère la zone', () => {
    const zm = ok(startSimpleEvent(base(), 'zone_maudite', 'z1')).event;
    expect(startSimpleEvent(base([zm], { now: zm.fin }), 'double_gain', 'z1').ok).toBe(true);
  });

  it('pas d’événement hors partie en cours', () => {
    expect(startSimpleEvent(base([], { gameState: 'pause' }), 'krach', null).ok).toBe(false);
  });
});

describe('effets', () => {
  it('Zone maudite ferme la zone pendant 10 min', () => {
    const zm = ok(startSimpleEvent(base(), 'zone_maudite', 'z1')).event;
    expect([...closedZones([zm], NOW + 9 * MIN)]).toEqual(['z1']);
    expect(closedZones([zm], NOW + 10 * MIN).size).toBe(0);
  });

  it('Double gain dans la zone seulement', () => {
    const dg = ok(startSimpleEvent(base(), 'double_gain', 'z1')).event;
    expect(gainsPerDraw([dg], 'z1', NOW)).toBe(2);
    expect(gainsPerDraw([dg], 'z2', NOW)).toBe(1);
  });

  it('Krach : moitié prix pendant 15 min', () => {
    const k = ok(startSimpleEvent(base(), 'krach', null)).event;
    expect(shopPriceMultiplier([k], NOW + 14 * MIN)).toBe(0.5);
    expect(shopPriceMultiplier([k], NOW + 15 * MIN)).toBe(1);
  });

  it('RG-12.2 annulation : les effets cessent', () => {
    const zm = ok(startSimpleEvent(base(), 'zone_maudite', 'z1')).event;
    expect(closedZones([cancelEvent(zm, NOW + MIN)], NOW + 2 * MIN).size).toBe(0);
  });
});

describe('Apparition', () => {
  const beacons: Beacon[] = [
    { id: 'b1', zoneId: 'z1', type: null, state: 'dormante', stock: 0, epuiseeA: null },
    { id: 'b2', zoneId: 'z1', type: 'standard', state: 'active', stock: 5, epuiseeA: null },
    { id: 'b3', zoneId: 'z2', type: null, state: 'dormante', stock: 0, epuiseeA: null },
  ];

  it('une balise dormante de la zone devient fantôme (1 ou 2 tirages)', () => {
    const r = ok(startApparition(base(), 'z1', beacons, rng()));
    const f = r.beacons?.beacons.find((b) => b.id === 'b1');
    expect(f).toMatchObject({ state: 'active', type: 'fantome' });
    expect([1, 2]).toContain(f?.stock);
    expect(announce(r.event, () => 'Masadora')).toEqual({ ecran: true, push: true, texte: 'Apparition dans la zone Masadora !' });
  });

  it('refus sans balise dormante dans la zone', () => {
    expect(startApparition(base(), 'z9', beacons, rng()).ok).toBe(false);
  });

  it('à la fin, la fantôme non épuisée redevient dormante', () => {
    const r = ok(startApparition(base(), 'z1', beacons, rng()));
    const fin = endApparition(r.event, r.beacons!.beacons);
    expect(fin.beacons.find((b) => b.id === 'b1')).toMatchObject({ state: 'dormante', type: null });
    expect(fin.changes).toHaveLength(1);
  });
});

describe('Raid de la Brigade', () => {
  it('chaque bonne réponse retire 1 PV, une fois par question et par joueur', () => {
    let e = ok(startRaid(base(), 3)).event;
    e = answerRaid(e, 'P1', 'q1', true, NOW);
    e = answerRaid(e, 'P1', 'q1', true, NOW);
    e = answerRaid(e, 'P2', 'q1', false, NOW);
    expect(e.data).toMatchObject({ pv: 2, participants: ['P1'] });
  });

  it('boss vaincu : 3 sorts pour chaque participant', () => {
    let e = ok(startRaid(base(), 2)).event;
    e = answerRaid(e, 'P1', 'q1', true, NOW + MIN);
    e = answerRaid(e, 'P2', 'q1', true, NOW + 2 * MIN);
    expect(e).toMatchObject({ etat: 'termine', reussi: true, fin: NOW + 2 * MIN });
    const gains = raidRewards(e, DEFAULT_SHOP_CONFIG.sorts, NOW, newId, rng());
    expect([...gains.keys()]).toEqual(['P1', 'P2']);
    expect(gains.get('P1')).toHaveLength(3);
  });

  it('boss non vaincu à l’échéance : aucun gain', () => {
    const e = ok(startRaid(base(), 50)).event;
    const { termines } = expireEvents([e], e.fin);
    expect(termines[0]).toMatchObject({ etat: 'termine', reussi: false });
    expect(raidRewards(termines[0]!, DEFAULT_SHOP_CONFIG.sorts, NOW, newId, rng()).size).toBe(0);
  });
});

describe('Carte maudite', () => {
  const joueurs = [
    { id: 'P1', status: 'actif' as const, livreGele: false },
    { id: 'P2', status: 'inactif' as const, livreGele: false },
    { id: 'P3', status: 'actif' as const, livreGele: true },
  ];

  it('arrive chez un joueur actif ; ne compte jamais ; le porteur sait, pas les autres', () => {
    const r = startCurse({ ...base(), newId }, joueurs, ['001', '002'], rng());
    if (!r.ok) throw new Error(r.message);
    expect(r.porteur).toBe('P1');
    expect(countInCirculation([book(r.carte)]).size).toBe(0);
    expect(viewCard(r.carte, true).badge).toBe('maudite');
    expect(viewCard(r.carte, false).badge).toBeUndefined();
    expect(announce(r.event, () => '')?.texte).toBe('Une carte maudite circule…');
  });

  it('reste maudite en changeant de main', () => {
    const r = startCurse({ ...base(), newId }, joueurs, ['001'], rng());
    if (!r.ok) throw new Error(r.message);
    const t = transferItem(book(r.carte), emptyBook(), r.carte.id, { now: NOW, origine: { type: 'vol', sur: 'P1' }, perte: { cause: 'vol', par: 'P2' } });
    expect(viewCard(t.item as CardItem, true).badge).toBe('maudite');
  });

  it('à l’échéance : le porteur perd 2 cartes hors SS, la carte maudite disparaît', () => {
    const b = book(carte('m', '001', { maudite: true, faux: { nature: 'copie' } }), carte('a'), carte('b'), carte('c'), carte('s', 'SS1'));
    const r = triggerCurse(b, 'm', NOW, rangDe, rng(), true);
    expect(r.perdues).toHaveLength(2);
    expect(r.book.items.map((i) => i.id)).toContain('s');
    expect(r.book.items.some((i) => i.id === 'm')).toBe(false);
    expect(r.book.pertes.every((p) => p.cause === 'malediction')).toBe(true);
  });

  it('annulée : seule la carte maudite disparaît', () => {
    const b = book(carte('m', '001', { maudite: true }), carte('a'));
    expect(triggerCurse(b, 'm', NOW, rangDe, rng(), false)).toEqual({ book: book(carte('a')), perdues: [] });
  });

  it('une seule carte maudite à la fois', () => {
    const r = startCurse({ ...base(), newId }, joueurs, ['001'], rng());
    if (!r.ok) throw new Error(r.message);
    expect(startCurse({ ...base([r.event]), newId }, joueurs, ['001'], rng()).ok).toBe(false);
  });
});

describe('Mission secrète', () => {
  it('validée par un PNJ avant l’échéance ; aucune annonce publique', () => {
    const e = ok(startMission(base(), 'P1', 'Photographier la statue', 30)).event;
    expect(announce(e, () => '')).toBeNull();
    expect(validateMission(e, NOW + MIN)).toMatchObject({ ok: true, joueurId: 'P1', jenny: 30, event: { reussi: true } });
    expect(validateMission(e, e.fin).ok).toBe(false);
  });
});

describe('RG-8.12 retour en jeu des SS', () => {
  const b = book(carte('s', 'SS1'), carte('c', '001'), carte('f', 'SS2', { faux: { nature: 'copie' } }));

  it('inactif depuis 20 min : ses vraies SS quittent son Livre', () => {
    const r = reclaimSS({ status: 'inactif', derniereActionA: NOW - SS_RETURN_INACTIVITY_MS, book: b }, NOW, rangDe);
    expect(r.rendues.map((i) => i.id)).toEqual(['s']);
    expect(r.book.pertes).toEqual([{ cardId: 'SS1', cause: 'retour_en_jeu', a: NOW }]);
  });

  it('abandon ou disqualification : immédiat', () => {
    expect(reclaimSS({ status: 'abandon', derniereActionA: NOW, book: b }, NOW, rangDe).rendues).toHaveLength(1);
  });

  it('joueur actif récent : rien', () => {
    expect(reclaimSS({ status: 'actif', derniereActionA: NOW - MIN, book: b }, NOW, rangDe).rendues).toEqual([]);
  });
});
