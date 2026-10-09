// Position du téléphone. RG-5.1 : géolocalisation obligatoire ; RG-10.9 : jointe aux intentions.
// L'API Geolocation est injectée pour les tests.
import type { PositionInput } from '@gq/shared';

export class GeoError extends Error {
  constructor(
    public code: 'indisponible' | 'refusee' | 'introuvable' | 'delai',
    message: string,
  ) {
    super(message);
  }
}

export function versPosition(c: Pick<GeolocationCoordinates, 'latitude' | 'longitude' | 'accuracy'>): PositionInput {
  return { lat: c.latitude, lng: c.longitude, precisionM: Math.max(0, Math.round(c.accuracy)) };
}

export function messageGeo(code: number): GeoError {
  if (code === 1) return new GeoError('refusee', 'La géolocalisation est obligatoire pour jouer : autorise-la dans les réglages du navigateur');
  if (code === 3) return new GeoError('delai', 'Position introuvable à temps : réessaie à découvert');
  return new GeoError('introuvable', 'Position introuvable : active le GPS et réessaie');
}

export function positionActuelle(geo: Geolocation | undefined = globalThis.navigator?.geolocation, delaiMs = 15_000): Promise<PositionInput> {
  if (!geo) return Promise.reject(new GeoError('indisponible', 'Ce téléphone ou ce navigateur ne donne pas sa position (HTTPS requis)'));
  return new Promise((ok, ko) => {
    geo.getCurrentPosition(
      (p) => ok(versPosition(p.coords)),
      (e) => ko(messageGeo(e.code)),
      { enableHighAccuracy: true, timeout: delaiMs, maximumAge: 10_000 },
    );
  });
}
