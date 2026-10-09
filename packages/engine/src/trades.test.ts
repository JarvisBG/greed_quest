import type { Rank } from '@gq/shared';
import { describe, expect, it } from 'vitest';
import { emptyBook, type Book, type BookItem, type CardItem } from './book.js';
import {
  AUCTION_DURATION_MS,
  PAIR_TRADE_INTERVAL_MS,
  TRADE_IDLE_TIMEOUT_MS,
  TRADE_INVITATION_TIMEOUT_MS,
  answerTrade,
  cancelTrade,
  confirmTrade,
  expireTradeSession,
  proposeTrade,
  setTradeOffer,
  closeAuction,
  joinAuction,
  openAuction,
  placeBid,
  trade,
  type Auction,
  type TradeInput,
  type ProposeInput,
  type TradeParty,
  type TradeSession,
} from './trades.js';
import type { Position } from './geo.js';

const NOW = 5_000_000;
const rangDe = (cardId: string): Rank => (cardId.startsWith('S') ? 'S' : 'C');

const carte = (id: string, cardId = id, extra: Partial<CardItem> = {}): CardItem => ({
  kind: 'carte',
  id,
  cardId,
  origine: { type: 'balise', baliseId: 'b' },
  obtenuA: 0,
  ...extra,
});
const book = (...items: BookItem[]): Book => ({ ...emptyBook(), items });
const party = (id: string, over: Partial<TradeParty> = {}): TradeParty => ({
  id,
  status: 'actif',
  book: emptyBook(),
  jenny: 100,
  livreGele: false,
  ...over,
});

const input = (over: Partial<TradeInput> = {}): TradeInput => ({
  now: NOW,
  gameState: 'en_cours',
  a: party('A', { book: book(carte('a1', '001'), carte('a2', '002')) }),
  b: party('B', { book: book(carte('b1', '003')) }),
  donneA: { itemIds: ['a1'], jenny: 0 },
  donneB: { itemIds: ['b1'], jenny: 0 },
  dernierEchangePaireA: null,
  ...over,
});

const code = (r: { ok: boolean; code?: string }) => (r.ok ? 'ok' : r.code);

describe('RG-11.1 échange atomique', () => {
  it('chaque carte change de main avec provenance et perte', () => {
    const r = trade(input(), rangDe);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.a.book.items.map((i) => i.id)).toEqual(['a2', 'b1']);
    expect(r.b.book.items.map((i) => i.id)).toEqual(['a1']);
    expect(r.recuParB[0]).toMatchObject({ id: 'a1', origine: { type: 'echange', avec: 'A' }, obtenuA: NOW });
    expect(r.a.book.pertes).toEqual([{ cardId: '001', cause: 'echange', par: 'B', a: NOW }]);
    expect(r.publicSurEcran).toBe(false);
  });

  it('cartes et jenny', () => {
    const r = trade(input({ donneA: { itemIds: ['a1', 'a2'], jenny: 0 }, donneB: { itemIds: [], jenny: 30 } }), rangDe);
    expect(r.ok && [r.a.jenny, r.b.jenny]).toEqual([130, 70]);
  });

  it('une carte absente : rien ne passe', () => {
    expect(code(trade(input({ donneB: { itemIds: ['zz'], jenny: 0 } }), rangDe))).toBe('element_invalide');
    expect(code(trade(input({ donneA: { itemIds: ['a1', 'a1'], jenny: 0 } }), rangDe))).toBe('element_invalide');
  });

  it('les sorts ne s’échangent pas', () => {
    const a = party('A', { book: book({ kind: 'sort', id: 's', spell: 'gel', obtenuA: 0 }) });
    expect(code(trade(input({ a, donneA: { itemIds: ['s'], jenny: 0 } }), rangDe))).toBe('element_invalide');
  });

  it('jenny insuffisants ou montant invalide', () => {
    expect(code(trade(input({ donneB: { itemIds: [], jenny: 500 } }), rangDe))).toBe('jenny_insuffisants');
    expect(code(trade(input({ donneB: { itemIds: ['b1'], jenny: -5 } }), rangDe))).toBe('element_invalide');
  });

  it('une carte S ou SS échangée apparaît sur l’écran géant', () => {
    const b = party('B', { book: book(carte('b1', 'S01')) });
    expect(trade(input({ b }), rangDe)).toMatchObject({ ok: true, publicSurEcran: true });
  });
});

describe('RG-11.2 contrepartie', () => {
  it('un don pur est refusé', () => {
    expect(code(trade(input({ donneB: { itemIds: [], jenny: 0 } }), rangDe))).toBe('don_pur');
    expect(code(trade(input({ donneA: { itemIds: [], jenny: 0 } }), rangDe))).toBe('don_pur');
  });

  it('1 jenny suffit comme contrepartie', () => {
    expect(code(trade(input({ donneB: { itemIds: [], jenny: 1 } }), rangDe))).toBe('ok');
  });
});

describe('RG-11.3 fréquence par paire', () => {
  it('un échange toutes les 10 min pour une même paire', () => {
    expect(trade(input({ dernierEchangePaireA: NOW - 4 * 60_000 }), rangDe)).toMatchObject({
      code: 'frequence_paire',
      message: 'Vous avez déjà échangé : réessayez dans 6 min',
    });
    expect(code(trade(input({ dernierEchangePaireA: NOW - PAIR_TRADE_INTERVAL_MS }), rangDe))).toBe('ok');
  });
});

describe('RG-11.6 contrefaçons', () => {
  it('la marque disparaît chez le receveur : la carte paraît vraie', () => {
    const a = party('A', { book: book(carte('f', '001', { faux: { nature: 'copie' }, marque: 'creee' })) });
    const r = trade(input({ a, donneA: { itemIds: ['f'], jenny: 0 } }), rangDe);
    expect(r.ok && r.recuParB[0]).not.toHaveProperty('marque');
  });
});

describe('états des joueurs et de la partie', () => {
  it('refus : pause, joueur gelé ou exclu, Livre gelé, soi-même', () => {
    expect(code(trade(input({ gameState: 'pause' }), rangDe))).toBe('partie_fermee');
    expect(code(trade(input({ b: party('B', { status: 'gele', book: book(carte('b1')) }) }), rangDe))).toBe('joueur_bloque');
    expect(code(trade(input({ b: party('B', { livreGele: true, book: book(carte('b1')) }) }), rangDe))).toBe('livre_gele');
    expect(code(trade(input({ b: party('A', { book: book(carte('b1')) }) }), rangDe))).toBe('meme_joueur');
  });
});

describe('RG-11.4 / 11.5 enchères', () => {
  const ouverte = (): Auction => openAuction('e1', 'A03', NOW, 10);

  it('dure 3 min ; il faut avoir scanné le QR pour enchérir', () => {
    const a = ouverte();
    expect(a.fin - a.debut).toBe(AUCTION_DURATION_MS);
    expect(placeBid(a, 'P1', 20, 100, NOW)).toMatchObject({ ok: false, code: 'non_inscrit' });
  });

  it('chaque offre dépasse la précédente et le prix de départ', () => {
    let a = ouverte();
    for (const p of ['P1', 'P2']) {
      const j = joinAuction(a, p, NOW);
      if (j.ok) a = j.auction;
    }
    expect(placeBid(a, 'P1', 5, 100, NOW)).toMatchObject({ code: 'offre_trop_basse', message: 'Offre minimale : 10 J' });
    const r1 = placeBid(a, 'P1', 10, 100, NOW);
    if (r1.ok) a = r1.auction;
    expect(placeBid(a, 'P2', 10, 100, NOW)).toMatchObject({ code: 'offre_trop_basse', message: 'Offre minimale : 11 J' });
    expect(placeBid(a, 'P2', 50, 40, NOW)).toMatchObject({ code: 'jenny_insuffisants' });
    expect(placeBid(a, 'P2', 11, 100, a.fin)).toMatchObject({ code: 'terminee' });
  });

  it('clôture : le meilleur enchérisseur solvable gagne, sinon retour au PNJ', () => {
    const a: Auction = {
      ...ouverte(),
      participants: ['P1', 'P2'],
      offres: [
        { playerId: 'P1', montant: 10, a: NOW },
        { playerId: 'P2', montant: 15, a: NOW },
        { playerId: 'P2', montant: 25, a: NOW },
      ],
    };
    expect(closeAuction(a, () => 100)).toEqual({ gagnant: { playerId: 'P2', montant: 25, a: NOW } });
    // P2 a dépensé ses jenny entre-temps : P1 l'emporte à son offre.
    expect(closeAuction(a, (p) => (p === 'P2' ? 5 : 100))).toEqual({ gagnant: { playerId: 'P1', montant: 10, a: NOW } });
    expect(closeAuction(ouverte(), () => 100)).toEqual({ gagnant: null });
  });
});

describe('RG-11.1 (amendé) session d’échange à la Pokémon', () => {
  const M = 1 / 111_195;
  const pos = (nordM: number): Position => ({ lat: 48.85 + nordM * M, lng: 2.35, precisionM: 0, a: NOW });
  const propose = (over: Partial<ProposeInput> = {}) =>
    proposeTrade({
      id: 't1',
      now: NOW,
      gameState: 'en_cours',
      a: { ...party('A'), position: pos(0) },
      b: { ...party('B'), position: pos(10) },
      portee: { porteeM: 30, margeMaxM: 20 },
      dernierEchangePaireA: null,
      ...over,
    });
  const ouverte = (): TradeSession => {
    const p = propose();
    if (!p.ok) throw new Error('proposition refusée');
    const r = answerTrade(p.session, 'B', true, NOW + 5_000);
    if (!r.ok) throw new Error('réponse refusée');
    return r.session;
  };

  it('proposition à un joueur à portée uniquement', () => {
    expect(propose()).toMatchObject({ ok: true, session: { etat: 'invitation', a: 'A', b: 'B' } });
    expect(code(propose({ b: { ...party('B'), position: pos(200) } }))).toBe('hors_portee');
    expect(code(propose({ a: { ...party('A'), position: null } }))).toBe('gps_invalide');
    expect(code(propose({ dernierEchangePaireA: NOW - 60_000 }))).toBe('frequence_paire');
    expect(code(propose({ gameState: 'pause' }))).toBe('partie_fermee');
  });

  it('l’invité accepte ou refuse dans les 60 s ; seul l’invité répond', () => {
    const p = propose();
    if (!p.ok) return;
    expect(answerTrade(p.session, 'B', false, NOW)).toMatchObject({ ok: true, session: { etat: 'refuse' } });
    expect(code(answerTrade(p.session, 'A', true, NOW))).toBe('pas_participant');
    expect(code(answerTrade(p.session, 'B', true, NOW + TRADE_INVITATION_TIMEOUT_MS + 1))).toBe('etat_invalide');
    expect(expireTradeSession(p.session, NOW + TRADE_INVITATION_TIMEOUT_MS + 1).etat).toBe('expire');
  });

  it('les deux validations sont nécessaires ; toute modification les annule', () => {
    let s = ouverte();
    const step = (r: { ok: true; session: TradeSession } | { ok: false }) => {
      if (!r.ok) throw new Error(JSON.stringify(r));
      s = r.session;
    };
    step(setTradeOffer(s, 'A', { itemIds: ['a1'], jenny: 0 }, NOW + 10_000));
    expect(code(confirmTrade(s, 'A', NOW + 11_000))).toBe('don_pur');
    step(setTradeOffer(s, 'B', { itemIds: ['b1'], jenny: 0 }, NOW + 12_000));

    const ca = confirmTrade(s, 'A', NOW + 13_000);
    expect(ca).toMatchObject({ ok: true, pret: false });
    step(ca);
    // B change sa part : la validation de A tombe.
    step(setTradeOffer(s, 'B', { itemIds: [], jenny: 5 }, NOW + 14_000));
    expect([s.valideA, s.valideB]).toEqual([false, false]);

    step(confirmTrade(s, 'A', NOW + 15_000));
    expect(confirmTrade(s, 'B', NOW + 16_000)).toMatchObject({ ok: true, pret: true });
  });

  it('annulation par l’un ou l’autre ; expiration après 3 min d’inactivité', () => {
    const s = ouverte();
    expect(cancelTrade(s, 'B', NOW)).toMatchObject({ ok: true, session: { etat: 'annule' } });
    expect(code(cancelTrade(s, 'X', NOW))).toBe('pas_participant');
    expect(code(setTradeOffer(s, 'A', { itemIds: ['a1'], jenny: 0 }, NOW + 5_000 + TRADE_IDLE_TIMEOUT_MS + 1))).toBe('etat_invalide');
  });
});
