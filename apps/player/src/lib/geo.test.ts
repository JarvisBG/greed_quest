import { describe, expect, it } from 'vitest';
import { GeoError, positionActuelle, versPosition } from './geo';

const geo = (r: { coords?: { latitude: number; longitude: number; accuracy: number }; code?: number }) =>
  ({
    getCurrentPosition: (ok: PositionCallback, ko: PositionErrorCallback) =>
      r.coords ? ok({ coords: r.coords } as GeolocationPosition) : ko({ code: r.code } as GeolocationPositionError),
  }) as unknown as Geolocation;

describe('géolocalisation', () => {
  it('RG-10.9 : coordonnées converties en position d’intention', () => {
    expect(versPosition({ latitude: 48.8, longitude: 2.3, accuracy: 12.6 })).toEqual({ lat: 48.8, lng: 2.3, precisionM: 13 });
  });

  it('RG-5.1 : position obtenue', async () => {
    await expect(positionActuelle(geo({ coords: { latitude: 1, longitude: 2, accuracy: 5 } }))).resolves.toEqual({ lat: 1, lng: 2, precisionM: 5 });
  });

  it('RG-5.1 : refus de la géolocalisation = message clair, inscription impossible', async () => {
    const e = await positionActuelle(geo({ code: 1 })).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(GeoError);
    expect((e as GeoError).code).toBe('refusee');
    expect((e as GeoError).message).toMatch(/obligatoire/);
  });

  it('délai dépassé et navigateur sans géolocalisation', async () => {
    await expect(positionActuelle(geo({ code: 3 }))).rejects.toMatchObject({ code: 'delai' });
    await expect(positionActuelle(undefined)).rejects.toMatchObject({ code: 'indisponible' });
  });
});
