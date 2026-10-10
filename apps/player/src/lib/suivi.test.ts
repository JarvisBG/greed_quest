import { describe, expect, it } from 'vitest';
import { creerSuivi, doitEnvoyer } from './suivi';

// 0,0001° de latitude ≈ 11 m
const at = (dLat: number, a: number) => ({ lat: 48 + dLat, lng: 2, precisionM: 5, a });

function fauxGps() {
  let cb: PositionCallback = () => undefined;
  const geo = {
    watchPosition: (ok: PositionCallback) => {
      cb = ok;
      return 1;
    },
    clearWatch: () => undefined,
  } as unknown as Geolocation;
  const bouger = (latitude: number, accuracy = 5) => cb({ coords: { latitude, longitude: 2, accuracy } } as GeolocationPosition);
  return { geo, bouger };
}

describe('suivi de position (RG-10.9, RG-10.10)', () => {
  it('RG-10.9 : première position, puis toutes les 15 s si déplacement > 10 m', () => {
    expect(doitEnvoyer(null, at(0, 0))).toBe(true);
    expect(doitEnvoyer(at(0, 0), at(0.0002, 10_000))).toBe(false);
    expect(doitEnvoyer(at(0, 0), at(0.0002, 15_000))).toBe(true);
    expect(doitEnvoyer(at(0, 0), at(0.00005, 30_000))).toBe(false);
  });

  it('RG-10.10 : immobile, renvoi toutes les 60 s pour rester sur le radar', () => {
    expect(doitEnvoyer(at(0, 0), at(0, 59_999))).toBe(false);
    expect(doitEnvoyer(at(0, 0), at(0, 60_000))).toBe(true);
  });

  it('suit le GPS, envoie, garde la position fraîche 30 s', async () => {
    let t = 0;
    const { geo, bouger } = fauxGps();
    const envois: unknown[] = [];
    const s = creerSuivi({ geo, envoyer: async (p) => void envois.push(p), now: () => t });
    s.demarrer();
    expect(s.fraiche()).toBeNull();
    bouger(48, 7);
    await Promise.resolve();
    expect(envois).toEqual([{ lat: 48, lng: 2, precisionM: 7 }]);
    expect(s.fraiche()).toEqual({ lat: 48, lng: 2, precisionM: 7 });
    t = 31_000;
    expect(s.fraiche()).toBeNull();
    // RG-10.10 : la carte garde la dernière position 2 min, même sans nouveau relevé (téléphone immobile).
    expect(s.derniere()).toEqual({ lat: 48, lng: 2, precisionM: 7 });
    t = 121_000;
    expect(s.derniere()).toBeNull();
    s.arreter();
  });

  it('RG-10.9 : une intention qui porte la position compte comme envoi', async () => {
    let t = 0;
    const { geo, bouger } = fauxGps();
    const envois: unknown[] = [];
    const s = creerSuivi({ geo, envoyer: async (p) => void envois.push(p), now: () => t });
    s.marquerEnvoyee({ lat: 48, lng: 2, precisionM: 5 });
    s.demarrer();
    t = 5_000;
    bouger(48);
    await s.tick();
    expect(envois).toEqual([]);
    s.arreter();
  });
});
