import { describe, expect, it } from 'vitest';
import {
  RECHARGE_MS,
  activateBeacons,
  consumeDraw,
  countActive,
  fillToTarget,
  initialStock,
  rechargeBeacons,
  replaceExhausted,
  rotate,
  type Beacon,
} from './beacons.js';
import { seededRng } from './rng.js';

const b = (id: string, zoneId: string, over: Partial<Beacon> = {}): Beacon => ({
  id,
  zoneId,
  type: null,
  state: 'dormante',
  stock: 0,
  epuiseeA: null,
  ...over,
});

// 3 zones × 4 balises dormantes
const terrain = (): Beacon[] =>
  ['z1', 'z2', 'z3'].flatMap((z) => [1, 2, 3, 4].map((i) => b(`${z}-${i}`, z)));

const noVisits = new Map<string, number>();
const rng = () => seededRng(11);

describe('RG-6.2 stock à l’activation', () => {
  it('standard = stockBalise, rare = moitié, fantôme = 1 ou 2', () => {
    expect(initialStock('standard', 15, rng())).toBe(15);
    expect(initialStock('rare', 15, rng())).toBe(8);
    const r = rng();
    for (let i = 0; i < 50; i++) expect([1, 2]).toContain(initialStock('fantome', 15, r));
  });
});

describe('RG-6.2 / RG-6.3 tirage et épuisement', () => {
  it('décrémente, puis épuise à 0', () => {
    const { beacon: a } = consumeDraw(b('x', 'z1', { type: 'standard', state: 'active', stock: 2 }), 100);
    expect(a).toMatchObject({ state: 'active', stock: 1 });
    const r = consumeDraw(a, 200);
    expect(r.beacon).toMatchObject({ state: 'epuisee', stock: 0, epuiseeA: 200 });
    expect(r.change).toMatchObject({ from: 'active', to: 'epuisee' });
  });

  it('refuse une balise non active', () => {
    expect(() => consumeDraw(b('x', 'z1'), 0)).toThrow();
  });

  it('recharge : épuisée → dormante après 15 min', () => {
    const beacons = [b('x', 'z1', { state: 'epuisee', epuiseeA: 0 })];
    expect(rechargeBeacons(beacons, RECHARGE_MS - 1).changes).toHaveLength(0);
    const r = rechargeBeacons(beacons, RECHARGE_MS);
    expect(r.beacons[0]?.state).toBe('dormante');
    expect(r.changes).toEqual([{ beaconId: 'x', zoneId: 'z1', from: 'epuisee', to: 'dormante', cause: 'recharge' }]);
  });

  it('remplacement dans une autre zone que la balise épuisée', () => {
    const beacons = terrain().map((x) => (x.id === 'z1-1' ? { ...x, state: 'epuisee' as const, epuiseeA: 0 } : x));
    for (let seed = 0; seed < 20; seed++) {
      const r = replaceExhausted(beacons, beacons[0]!, 3, { stockBalise: 10, partRaresPct: 0, visitesParZone: noVisits }, seededRng(seed));
      expect(r.changes).toHaveLength(1);
      expect(r.changes[0]?.zoneId).not.toBe('z1');
    }
  });

  it('pas de remplacement si la cible est déjà atteinte', () => {
    const beacons = terrain().map((x, i) => (i < 3 ? { ...x, type: 'standard' as const, state: 'active' as const, stock: 5 } : x));
    expect(replaceExhausted(beacons, beacons[0]!, 3, { stockBalise: 10, partRaresPct: 0, visitesParZone: noVisits }, rng()).changes).toHaveLength(0);
  });
});

describe('activation par zones les moins visitées', () => {
  it('va d’abord dans la zone la moins visitée, puis répartit', () => {
    const visites = new Map([
      ['z1', 10],
      ['z2', 0],
      ['z3', 1],
    ]);
    const r = activateBeacons(terrain(), { count: 3, stockBalise: 10, partRaresPct: 0, visitesParZone: visites, cause: 'cible' }, rng());
    // z2 d'abord (0 visite) ; ensuite z2 et z3 sont à égalité (1) et partagés ; z1 jamais.
    const zones = r.changes.map((c) => c.zoneId);
    expect(zones[0]).toBe('z2');
    expect([...zones].sort()).toEqual(['z2', 'z2', 'z3']);
    expect(r.changes.every((c) => c.stock === 10)).toBe(true);
  });

  it('n’active jamais une balise fantôme ni coupée', () => {
    const beacons = [b('f', 'z1', { type: 'fantome', state: 'active', stock: 1 }), b('c', 'z1', { state: 'coupee' }), b('s', 'z2')];
    const r = activateBeacons(beacons, { count: 3, stockBalise: 10, partRaresPct: 0, visitesParZone: noVisits, cause: 'cible' }, rng());
    expect(r.changes.map((c) => c.beaconId)).toEqual(['s']);
  });

  it('le type est tiré à l’activation selon partRaresPct', () => {
    const many = Array.from({ length: 2000 }, (_, i) => b(`b${i}`, `z${i % 5}`));
    const r = activateBeacons(many, { count: 2000, stockBalise: 10, partRaresPct: 15, visitesParZone: noVisits, cause: 'cible' }, rng());
    const rares = r.changes.filter((c) => c.type === 'rare');
    expect(rares.length / 2000).toBeCloseTo(0.15, 1);
    expect(rares.every((c) => c.stock === 5)).toBe(true);
    expect(r.changes.filter((c) => c.type === 'standard').every((c) => c.stock === 10)).toBe(true);
  });

  it('retour en dormante : le type est effacé', () => {
    const r = rechargeBeacons([b('x', 'z1', { type: 'rare', state: 'epuisee', epuiseeA: 0 })], RECHARGE_MS);
    expect(r.beacons[0]?.type).toBeNull();
  });
});

describe('cible (RG-14.3)', () => {
  it('complète jusqu’à la cible', () => {
    const r = fillToTarget(terrain(), 5, { stockBalise: 10, partRaresPct: 0, visitesParZone: noVisits }, rng());
    expect(countActive(r.beacons)).toBe(5);
  });

  it('une cible plus basse ne coupe rien', () => {
    const beacons = terrain().map((x) => ({ ...x, type: 'standard' as const, state: 'active' as const, stock: 5 }));
    expect(fillToTarget(beacons, 2, { stockBalise: 10, partRaresPct: 0, visitesParZone: noVisits }, rng()).changes).toHaveLength(0);
  });
});

describe('RG-6.4 rotation', () => {
  it('remplace 30 % des actives par d’autres balises', () => {
    const start = fillToTarget(terrain(), 10, { stockBalise: 10, partRaresPct: 0, visitesParZone: noVisits }, rng()).beacons;
    const avant = new Set(start.filter((x) => x.state === 'active').map((x) => x.id));
    const r = rotate(start, 10, { stockBalise: 10, partRaresPct: 0, visitesParZone: noVisits }, rng());

    const retirees = r.changes.filter((c) => c.to === 'dormante');
    const ajoutees = r.changes.filter((c) => c.to === 'active');
    expect(retirees).toHaveLength(3);
    expect(ajoutees).toHaveLength(2); // seules 2 dormantes restent hors balises retirées
    expect(ajoutees.every((c) => !avant.has(c.beaconId))).toBe(true);
  });

  it('au moins une balise tourne', () => {
    const beacons = [b('a', 'z1', { type: 'standard', state: 'active', stock: 5 }), b('d', 'z2')];
    const r = rotate(beacons, 1, { stockBalise: 10, partRaresPct: 0, visitesParZone: noVisits }, rng());
    expect(r.changes.map((c) => `${c.beaconId}:${c.to}`)).toEqual(['a:dormante', 'd:active']);
  });
});
