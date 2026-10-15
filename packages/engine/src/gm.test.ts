import type { Rank } from '@gq/shared';
import { describe, expect, it } from 'vitest';
import { emptyBook, type Book, type BookItem, type CardItem, type GmItem } from './book.js';
import type { Position } from './geo.js';
import {
  JUGEMENT_FIGE_MS,
  JUGEMENT_INTOUCHABLE_MS,
  SCEAU_MS,
  blocageGm,
  carteGmDeScan,
  cartesDuDecret,
  jouerJarvis,
  jouerSceau,
  rendreCartesGm,
  type GmJoueur,
  type GmMonde,
} from './gm.js';
import { seededRng } from './rng.js';
import { IMMUNITY_MS, castOffensive, castRadar, type SpellPlayer, type SpellWorld } from './spells.js';
import { checkScan } from './scan.js';
import { trade } from './trades.js';

const NOW = 10_000_000;
const M = 1 / 111_195;
const pos = (nordM: number, a = NOW): Position => ({ lat: 48.85 + nordM * M, lng: 2.35, precisionM: 0, a });
let n = 0;
const DESIGNEES = ['c1', 'c2', 'c3', 'SS0'];
const monde = (over: Partial<GmMonde> = {}): GmMonde => ({
  now: NOW,
  gameState: 'en_cours',
  portee: { porteeM: 30, margeMaxM: 20 },
  rangDe: (id) => (id.startsWith('SS') ? 'SS' : 'C') as Rank,
  designees: DESIGNEES,
  newId: () => `new${n++}`,
  ...over,
});
const carte = (id: string, cardId = id, extra: Partial<CardItem> = {}): CardItem => ({ kind: 'carte', id, cardId, origine: { type: 'kit' }, obtenuA: 0, ...extra });
const gm = (id: string, g: GmItem['gm']): GmItem => ({ kind: 'gm', id, gm: g, obtenuA: 0 });
const book = (...items: BookItem[]): Book => ({ ...emptyBook(), items });
const joueur = (id: string, over: Partial<GmJoueur> = {}): GmJoueur => ({ id, status: 'actif', position: pos(0), book: emptyBook(), livreGele: false, immuniteJusqua: null, ...over });

describe('RG-8.16 obtention au scan', () => {
  it('RG-8.16 : une carte encore au Maître du jeu tombe avec la probabilité réglée', () => {
    expect(carteGmDeScan(['jarvis', 'ange'], 100, seededRng(1))).not.toBeNull();
    expect(carteGmDeScan(['jarvis', 'ange'], 0, seededRng(1))).toBeNull();
    expect(carteGmDeScan([], 100, seededRng(1))).toBeNull(); // déjà toutes en jeu
  });
  it('RG-8.16 : 0,5 % par scan, environ 1 scan sur 200', () => {
    const rng = seededRng(7);
    let k = 0;
    for (let i = 0; i < 20_000; i++) if (carteGmDeScan(['jarvis'], 0.5, rng)) k++;
    expect(k).toBeGreaterThan(60);
    expect(k).toBeLessThan(140);
  });
});

describe('RG-8.19 Jarvis tout-puissant', () => {
  const lanceur = joueur('jarvis', { book: book(gm('g1', 'jarvis'), carte('e1', 'c1')) });

  it('RG-8.19 : le Décret propose les désignées absentes des emplacements fixes, jamais la SS', () => {
    expect(cartesDuDecret(lanceur.book, monde())).toEqual(['c2', 'c3']);
  });

  it('RG-8.19 : Décret sous la limite, la carte est créée ; la carte jouée revient au Maître du jeu', () => {
    const r = jouerJarvis(monde(), { lanceur, autres: [], itemId: 'g1', carteVoulueId: 'c2', limite: 3, enCirculation: 1 }, seededRng(1));
    if (!r.ok) throw new Error(r.message);
    expect(r.carte).toMatchObject({ kind: 'carte', cardId: 'c2', origine: { type: 'decret' } });
    expect(r.lanceur.book.items.some((i) => i.kind === 'gm')).toBe(false);
    expect(r.rendue.gm).toBe('jarvis');
    expect(r.reprisA).toBeUndefined();
  });

  it('RG-8.19 : Décret à la limite, la carte est reprise à un détenteur, malgré son Coffre et sa carte cachée', () => {
    const kirua = joueur('kirua', { position: pos(500), book: book(carte('k1', 'c2', { coffreJusqua: NOW + 60_000, cachee: true })) });
    const r = jouerJarvis(monde(), { lanceur, autres: [kirua], itemId: 'g1', carteVoulueId: 'c2', limite: 1, enCirculation: 1 }, seededRng(1));
    if (!r.ok) throw new Error(r.message);
    expect(r.reprisA).toBe('kirua');
    expect(r.autres.find((p) => p.id === 'kirua')!.book.items).toHaveLength(0);
    expect(r.autres.find((p) => p.id === 'kirua')!.book.pertes[0]).toMatchObject({ cause: 'decret', par: 'jarvis' });
    expect(r.carte).toMatchObject({ cardId: 'c2', origine: { type: 'decret' } });
    expect(r.carte.cachee).toBeUndefined();
  });

  it('RG-8.19 : jamais à un Book gelé par un Clear provisoire, ni une contrefaçon ; sinon refus en clair', () => {
    const gele = joueur('g', { livreGele: true, book: book(carte('x', 'c2')) });
    const faux = joueur('f', { book: book(carte('y', 'c2', { faux: { nature: 'copie' } })) });
    const r = jouerJarvis(monde(), { lanceur, autres: [gele, faux], itemId: 'g1', carteVoulueId: 'c2', limite: 1, enCirculation: 1 }, seededRng(1));
    expect(r).toMatchObject({ ok: false, code: 'carte_imprenable' });
  });

  it('RG-8.19 : pas la SS, ni une carte déjà en place', () => {
    expect(jouerJarvis(monde(), { lanceur, autres: [], itemId: 'g1', carteVoulueId: 'SS0', limite: 1, enCirculation: 0 }, seededRng(1))).toMatchObject({ ok: false, message: 'Le Décret ne peut pas créer la carte SS' });
    expect(jouerJarvis(monde(), { lanceur, autres: [], itemId: 'g1', carteVoulueId: 'c1', limite: 3, enCirculation: 1 }, seededRng(1))).toMatchObject({ ok: false, code: 'carte_invalide' });
  });

  it('RG-8.19 : Jugement, les joueurs à portée sont figés 3 min malgré immunité et Zetsu ; le lanceur est intouchable 10 min', () => {
    const proche = joueur('proche', { position: pos(10), immuniteJusqua: NOW + 60_000 });
    const loin = joueur('loin', { position: pos(400) });
    const r = jouerJarvis(monde(), { lanceur, autres: [proche, loin], itemId: 'g1', carteVoulueId: 'c2', limite: 3, enCirculation: 0 }, seededRng(1));
    if (!r.ok) throw new Error(r.message);
    expect(r.figes).toEqual(['proche']);
    expect(r.autres.find((p) => p.id === 'proche')!.figeJusqua).toBe(NOW + JUGEMENT_FIGE_MS);
    expect(r.autres.find((p) => p.id === 'loin')).toBeUndefined();
    expect(r.lanceur.intouchableJusqua).toBe(NOW + JUGEMENT_INTOUCHABLE_MS);
  });

  it('RG-8.15 : refusé en pause, Book gelé, sans la carte ; RG-8.20 : refusé Book scellé', () => {
    const args = { autres: [], itemId: 'g1', carteVoulueId: 'c2', limite: 3, enCirculation: 0 };
    expect(jouerJarvis(monde({ gameState: 'pause' }), { lanceur, ...args }, seededRng(1))).toMatchObject({ ok: false, code: 'partie_fermee' });
    expect(jouerJarvis(monde(), { lanceur: { ...lanceur, livreGele: true }, ...args }, seededRng(1))).toMatchObject({ ok: false, code: 'joueur_bloque' });
    expect(jouerJarvis(monde(), { lanceur: { ...lanceur, scelleJusqua: NOW + 1000 }, ...args }, seededRng(1))).toMatchObject({ ok: false, code: 'joueur_bloque' });
    expect(jouerJarvis(monde(), { lanceur: { ...lanceur, book: emptyBook() }, ...args }, seededRng(1))).toMatchObject({ ok: false, code: 'carte_absente' });
  });
});

describe('RG-8.20 Le Sceau d’Ange', () => {
  const ange = joueur('ange', { book: book(gm('g2', 'ange')) });

  it('RG-8.20 : Book de la cible scellé 5 min, puis immunité de 5 min ; la carte revient au Maître du jeu', () => {
    const r = jouerSceau(monde(), { lanceur: ange, cible: joueur('kirua', { position: pos(10) }), itemId: 'g2' });
    if (!r.ok) throw new Error(r.message);
    expect(r.cible.scelleJusqua).toBe(NOW + SCEAU_MS);
    expect(r.cible.immuniteJusqua).toBe(NOW + SCEAU_MS + IMMUNITY_MS);
    expect(r.lanceur.book.items).toHaveLength(0);
  });

  it('RG-8.20 : le Mur défensif ne la bloque pas, le Zetsu non plus', () => {
    const cible = joueur('kirua', { position: pos(10), book: book({ kind: 'sort', id: 'm', spell: 'barriere', obtenuA: 0 }) });
    const r = jouerSceau(monde(), { lanceur: ange, cible, itemId: 'g2' });
    expect(r.ok && r.cible.book.items).toHaveLength(1); // Mur défensif intact
  });

  it('RG-8.20 : refus hors de portée, cible immunisée, intouchable ou Book gelé', () => {
    const w = monde();
    expect(jouerSceau(w, { lanceur: ange, cible: joueur('k', { position: pos(400) }), itemId: 'g2' })).toMatchObject({ code: 'cible_hors_portee' });
    expect(jouerSceau(w, { lanceur: ange, cible: joueur('k', { immuniteJusqua: NOW + 5000 }), itemId: 'g2' })).toMatchObject({ code: 'cible_immunisee' });
    expect(jouerSceau(w, { lanceur: ange, cible: joueur('k', { intouchableJusqua: NOW + 5000 }), itemId: 'g2' })).toMatchObject({ code: 'cible_intouchable' });
    expect(jouerSceau(w, { lanceur: ange, cible: joueur('k', { livreGele: true }), itemId: 'g2' })).toMatchObject({ code: 'cible_livre_gele' });
  });

  it('RG-8.20 : un Book scellé ne scanne, ne lance, n’échange, ne range ni n’utilise d’objet ; figé : scan, sort, échange', () => {
    const scelle = { scelleJusqua: NOW + 1000 };
    for (const a of ['scan', 'sort', 'echange', 'livre', 'objet'] as const) expect(blocageGm(scelle, NOW, a)).toMatch(/scellé par Ange/);
    const fige = { figeJusqua: NOW + 1000 };
    for (const a of ['scan', 'sort', 'echange'] as const) expect(blocageGm(fige, NOW, a)).toMatch(/Jugement de Jarvis/);
    expect(blocageGm(fige, NOW, 'livre')).toBeNull();
    expect(blocageGm(scelle, NOW + 2000, 'scan')).toBeNull(); // le sceau est levé
  });
});

describe('RG-8.17, RG-8.18, RG-8.19 avec les autres règles', () => {
  const sw: SpellWorld = { now: NOW, gameState: 'en_cours', portee: { porteeM: 30, margeMaxM: 20 }, rangDe: () => 'C', newId: () => `s${n++}` };
  const sp = (id: string, over: Partial<SpellPlayer> = {}): SpellPlayer => ({
    id, status: 'actif', position: pos(0), book: emptyBook(), nen: 'transformation', pouvoirsA: {}, immuniteJusqua: null, dernierOffensifA: null, geleJusqua: null, livreGele: false, ...over,
  });

  it('RG-8.18 : le Vol peut viser la carte de Maître du jeu de la cible', () => {
    const r = castOffensive(sw, { sort: 'vol', source: { type: 'carte', itemId: 'v' }, viserCarteGm: true, lanceur: sp('a', { book: book({ kind: 'sort', id: 'v', spell: 'vol', obtenuA: 0 }) }), cible: sp('b', { position: pos(5), book: book(gm('g', 'ange'), carte('x')) }) }, seededRng(1));
    expect(r.ok && r.recu).toMatchObject({ kind: 'gm', gm: 'ange' });
  });

  it('RG-8.18 : sans viser, le Vol ne prend jamais une carte de Maître du jeu', () => {
    const r = castOffensive(sw, { sort: 'vol', source: { type: 'carte', itemId: 'v' }, lanceur: sp('a', { book: book({ kind: 'sort', id: 'v', spell: 'vol', obtenuA: 0 }) }), cible: sp('b', { position: pos(5), book: book(gm('g', 'ange')) }) }, seededRng(1));
    expect(r.ok && r.resultat).toBe('sans_effet');
  });

  it('RG-8.19 : un joueur intouchable ne peut être visé par aucun sort ; figé, il ne lance plus', () => {
    const lanceur = sp('a', { book: book({ kind: 'sort', id: 'v', spell: 'vol', obtenuA: 0 }, { kind: 'sort', id: 'r', spell: 'radar', obtenuA: 0 }) });
    const cible = sp('b', { position: pos(5), intouchableJusqua: NOW + 1000 });
    expect(castOffensive(sw, { sort: 'vol', source: { type: 'carte', itemId: 'v' }, lanceur, cible }, seededRng(1))).toMatchObject({ ok: false, code: 'cible_intouchable' });
    expect(castRadar(sw, { lanceur, itemId: 'r', cible, zones: [] })).toMatchObject({ ok: false, code: 'cible_intouchable' });
    expect(castOffensive(sw, { sort: 'vol', source: { type: 'carte', itemId: 'v' }, lanceur: { ...lanceur, figeJusqua: NOW + 1000 }, cible: sp('c', { position: pos(5) }) }, seededRng(1))).toMatchObject({ ok: false, code: 'lanceur_bloque' });
  });

  it('RG-8.19, RG-8.20 : figé ou scellé, le scan est refusé', () => {
    const ctx = (over: object) => ({ now: NOW, gameState: 'en_cours' as const, player: { status: 'actif' as const, geleJusqua: null, positionValide: true, historiqueTirages: [], dernierTirageA: null, livrePlein: false, ...over }, beacon: { id: 'b', state: 'active' as const, zoneId: 'z', stock: 3 }, zonesFermees: new Set<string>(), k: 3 });
    expect(checkScan(ctx({ scelleJusqua: NOW + 1000 }) as never)).toMatchObject({ ok: false });
    expect(checkScan(ctx({ figeJusqua: NOW + 1000 }) as never)).toMatchObject({ ok: false });
  });

  it('RG-8.17 : les cartes de Maître du jeu s’échangent', () => {
    const a = { id: 'a', status: 'actif' as const, book: book(gm('g', 'jarvis')), jenny: 0, livreGele: false };
    const b = { id: 'b', status: 'actif' as const, book: emptyBook(), jenny: 50, livreGele: false };
    const r = trade({ now: NOW, gameState: 'en_cours', a, b, donneA: { itemIds: ['g'], jenny: 0 }, donneB: { itemIds: [], jenny: 50 }, dernierEchangePaireA: null }, () => 'C');
    expect(r.ok && r.recuParB[0]).toMatchObject({ kind: 'gm', gm: 'jarvis' });
  });

  it('RG-8.17 : un joueur qui quitte la partie rend ses cartes de Maître du jeu', () => {
    const r = rendreCartesGm(book(gm('g', 'jarvis'), carte('x')));
    expect(r.rendues.map((i) => i.gm)).toEqual(['jarvis']);
    expect(r.book.items).toHaveLength(1);
  });
});

describe('RG-8.16 récompense de raid', () => {
  it('RG-8.16 : la carte promise va au meilleur chasseur (le plus de bonnes réponses, à égalité le premier)', async () => {
    const { answerRaid, meilleurChasseur, startRaid } = await import('./events.js');
    const r = startRaid({ id: 'e', now: 0, gameState: 'en_cours', events: [] }, 4, 'jarvis');
    if (!r.ok) throw new Error(r.message);
    let e = r.event;
    e = answerRaid(e, 'kirua', 'q1', true, 1);
    e = answerRaid(e, 'gon', 'q1', true, 2);
    e = answerRaid(e, 'gon', 'q2', true, 3);
    e = answerRaid(e, 'kirua', 'q2', true, 4); // le boss tombe
    expect(e.reussi).toBe(true);
    expect(meilleurChasseur(e)).toBe('kirua'); // 2 coups chacun : Kirua a frappé le premier
    const sans = startRaid({ id: 'f', now: 0, gameState: 'en_cours', events: [] }, 1);
    expect(sans.ok && sans.event.data).not.toHaveProperty('carteGm');
  });
});
