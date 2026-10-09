import { describe, expect, it } from 'vitest';
import {
  distanceM,
  effectiveRangeM,
  isImpossibleMove,
  isInPolygon,
  isInRange,
  isOffRadar,
  isTargetable,
  isSharedPhotoSuspect,
  isValidPosition,
  playersInRange,
  shouldSendPosition,
  speedKmh,
  zoneOf,
  type Position,
} from './geo.js';

// ~1 m de latitude ≈ 0,000009°
const M = 1 / 111_195;
const ORIGIN = { lat: 48.8566, lng: 2.3522 };
const at = (nordM: number, a = 0, precisionM = 0): Position => ({ lat: ORIGIN.lat + nordM * M, lng: ORIGIN.lng, precisionM, a });

describe('distance', () => {
  it('haversine : 100 m vers le nord', () => {
    expect(distanceM(at(0), at(100))).toBeCloseTo(100, 0);
  });

  it('Paris → Lyon ≈ 392 km', () => {
    expect(distanceM(ORIGIN, { lat: 45.764, lng: 4.8357 }) / 1000).toBeCloseTo(392, -1);
  });
});

describe('RG-10.10 hors radar / RG-7.6 position valide', () => {
  it('hors radar après 2 min sans position', () => {
    expect(isOffRadar(null, 0)).toBe(true);
    expect(isOffRadar(at(0, 0), 120_000)).toBe(false);
    expect(isOffRadar(at(0, 0), 120_001)).toBe(true);
  });

  it('position valide : fraîche, précise, coordonnées correctes', () => {
    expect(isValidPosition(at(0, 0, 15), 1000)).toBe(true);
    expect(isValidPosition(at(0, 0, 150), 1000)).toBe(false);
    expect(isValidPosition({ ...at(0), lat: Number.NaN }, 0)).toBe(false);
    expect(isValidPosition(at(0, 0), 200_000)).toBe(false);
  });
});

describe('RG-10.9 envoi de position', () => {
  it('premier envoi, puis toutes les 15 s si déplacement > 10 m', () => {
    expect(shouldSendPosition(null, at(0))).toBe(true);
    expect(shouldSendPosition(at(0, 0), at(20, 10_000))).toBe(false);
    expect(shouldSendPosition(at(0, 0), at(5, 20_000))).toBe(false);
    expect(shouldSendPosition(at(0, 0), at(20, 15_000))).toBe(true);
  });
});

describe('RG-10.11 portée', () => {
  it('30 m + marge GPS plafonnée à 20 m', () => {
    expect(effectiveRangeM(at(0, 0, 0), at(0, 0, 0))).toBe(30);
    expect(effectiveRangeM(at(0, 0, 5), at(0, 0, 8))).toBe(43);
    expect(effectiveRangeM(at(0, 0, 50), at(0, 0, 50))).toBe(50);
    expect(effectiveRangeM(at(0, 0, 0), at(0, 0, 0), { porteeM: 40, margeMaxM: 20 })).toBe(40);
  });

  it('portée réduite pour un petit lieu (parking)', () => {
    const parking = { porteeM: 10, margeMaxM: 5 };
    expect(effectiveRangeM(at(0, 0, 8), at(0, 0, 8), parking)).toBe(15);
    expect(isInRange(at(0, 0, 8), at(20, 0, 8), parking)).toBe(false);
  });

  it('à portée ou non', () => {
    expect(isInRange(at(0), at(29))).toBe(true);
    expect(isInRange(at(0), at(35))).toBe(false);
    expect(isInRange(at(0, 0, 5), at(35, 0, 5))).toBe(true);
  });

  it('amendement RG-10.10 : ciblable 10 min à sa dernière position, durée réglable', () => {
    expect(isTargetable(null, 0)).toBe(false);
    expect(isTargetable(at(0, 0), 600_000)).toBe(true);
    expect(isTargetable(at(0, 0), 600_001)).toBe(false);
    expect(isTargetable(at(0, 0), 200_000, { porteeM: 30, margeMaxM: 20, ciblableMs: 120_000 })).toBe(false);
  });

  it('RG-10.1 liste à portée : exclut le lanceur, les hors radar et les trop loin', () => {
    const now = 60_000;
    const lanceur = { id: 'me', position: at(0, now) };
    const autres = [
      { id: 'me', position: at(0, now) },
      { id: 'proche', position: at(10, now) },
      { id: 'loin', position: at(80, now) },
      { id: 'perdu', position: at(5, now - 130_000) }, // amendement RG-10.10 : encore ciblable
      { id: 'disparu', position: at(5, now - 600_001) },
      { id: 'sans', position: null },
    ];
    expect(playersInRange(lanceur, autres, now).map((p) => p.id)).toEqual(['proche', 'perdu']);
    expect(playersInRange({ id: 'me', position: null }, autres, now)).toEqual([]);
  });
});

describe('zones', () => {
  const carre = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 1 },
    { lat: 1, lng: 1 },
    { lat: 1, lng: 0 },
  ];

  it('point dans un polygone', () => {
    expect(isInPolygon({ lat: 0.5, lng: 0.5 }, carre)).toBe(true);
    expect(isInPolygon({ lat: 1.5, lng: 0.5 }, carre)).toBe(false);
  });

  it('zone d’un point', () => {
    const zones = [{ id: 'masadora', polygon: carre }];
    expect(zoneOf({ lat: 0.2, lng: 0.2 }, zones)).toBe('masadora');
    expect(zoneOf({ lat: 2, lng: 2 }, zones)).toBeNull();
  });
});

describe('RG-15 anti-triche', () => {
  it('vitesse : 100 m en 60 s = 6 km/h', () => {
    expect(speedKmh(at(0, 0), at(100, 60_000))).toBeCloseTo(6, 1);
  });

  it('déplacement impossible au-delà de 15 km/h', () => {
    expect(isImpossibleMove(at(0, 0), at(300, 60_000))).toBe(true); // 18 km/h
    expect(isImpossibleMove(at(0, 0), at(200, 60_000))).toBe(false); // 12 km/h
  });

  it('le bruit GPS ne déclenche pas d’alerte', () => {
    expect(isImpossibleMove(at(0, 0, 30), at(80, 10_000, 30))).toBe(false); // 20 m nets en 10 s
    expect(speedKmh(at(0, 0), at(50, 2_000))).toBeNull();
  });

  it('photo de balise partagée', () => {
    const scan = (playerId: string, nordM: number, a: number) => ({ playerId, beaconId: 'b1', position: at(nordM, a) });
    expect(isSharedPhotoSuspect(scan('p1', 0, 0), scan('p2', 300, 5_000))).toBe(true);
    expect(isSharedPhotoSuspect(scan('p1', 0, 0), scan('p2', 300, 15_000))).toBe(false);
    expect(isSharedPhotoSuspect(scan('p1', 0, 0), scan('p2', 50, 5_000))).toBe(false);
    expect(isSharedPhotoSuspect(scan('p1', 0, 0), scan('p1', 300, 5_000))).toBe(false);
  });
});
