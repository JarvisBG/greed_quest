// Géolocalisation : portée des sorts (RG-10.9 à 10.11), zones, contrôles anti-triche (RG-15).

export interface Position {
  lat: number;
  lng: number;
  /** Précision annoncée par le téléphone (rayon en m). */
  precisionM: number;
  /** Heure de la mesure (horloge de jeu, ms). */
  a: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export const POSITION_SEND_INTERVAL_MS = 15_000; // RG-10.9
export const POSITION_SEND_MIN_MOVE_M = 10; // RG-10.9
export const RADAR_TIMEOUT_MS = 2 * 60_000; // RG-10.10
/** RG-10.11 : portée des sorts, réglable par partie (paramètres porteeSortsM et margeGpsMaxM). */
export interface RangeSettings {
  porteeM: number;
  margeMaxM: number;
  /** Amendement RG-10.10 : durée pendant laquelle un joueur reste ciblable à sa dernière position (paramètre ciblableMin). */
  ciblableMs?: number;
}
/** Amendement RG-10.10 (2026-10-09) : 10 min par défaut. */
export const TARGETABLE_MS = 10 * 60_000;
export const DEFAULT_RANGE: RangeSettings = { porteeM: 30, margeMaxM: 20, ciblableMs: TARGETABLE_MS };
/** Au-delà, une position est trop imprécise pour jouer (RG-7.6). Valeur proposée. */
export const MAX_PRECISION_M = 100;
export const MAX_WALK_SPEED_KMH = 15; // RG-15
/** En dessous, l'écart entre deux mesures est trop court pour juger une vitesse. */
export const MIN_SPEED_INTERVAL_MS = 5_000;
export const SHARED_PHOTO_WINDOW_MS = 10_000; // RG-15
export const SHARED_PHOTO_DISTANCE_M = 200; // RG-15

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Distance à vol d'oiseau (haversine), en mètres. */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** RG-10.10 : sans position depuis plus de 2 min, le joueur ne peut ni viser ni être visé. */
export function isOffRadar(pos: Position | null, now: number): boolean {
  return pos === null || now - pos.a > RADAR_TIMEOUT_MS;
}

/**
 * Amendement RG-10.10 : un joueur reste ciblable à sa dernière position connue pendant `ciblableMs`
 * (10 min par défaut), même s'il a coupé son GPS ou mis son téléphone en veille. Pour agir lui-même
 * (scan, achat, sort), il lui faut toujours une position de moins de 2 min (RG-7.6).
 */
export function isTargetable(pos: Position | null, now: number, r: RangeSettings = DEFAULT_RANGE): pos is Position {
  return pos !== null && now - pos.a <= (r.ciblableMs ?? TARGETABLE_MS);
}

/** RG-7.6 : position utilisable pour scanner, acheter ou lancer un sort. */
export function isValidPosition(pos: Position | null, now: number): pos is Position {
  return (
    pos !== null &&
    Number.isFinite(pos.lat) &&
    Number.isFinite(pos.lng) &&
    Math.abs(pos.lat) <= 90 &&
    Math.abs(pos.lng) <= 180 &&
    pos.precisionM >= 0 &&
    pos.precisionM <= MAX_PRECISION_M &&
    !isOffRadar(pos, now)
  );
}

/** RG-10.9 : l'app envoie sa position toutes les 15 s si elle a bougé de plus de 10 m. */
export function shouldSendPosition(dernierEnvoi: Position | null, courante: Position): boolean {
  if (dernierEnvoi === null) return true;
  return (
    courante.a - dernierEnvoi.a >= POSITION_SEND_INTERVAL_MS && distanceM(dernierEnvoi, courante) > POSITION_SEND_MIN_MOVE_M
  );
}

/**
 * RG-10.11 : portée + marge GPS plafonnée à 20 m.
 * Marge = somme des précisions des deux joueurs (les deux erreurs s'additionnent).
 */
export function effectiveRangeM(lanceur: Position, cible: Position, r: RangeSettings = DEFAULT_RANGE): number {
  return r.porteeM + Math.min(r.margeMaxM, lanceur.precisionM + cible.precisionM);
}

export function isInRange(lanceur: Position, cible: Position, r: RangeSettings = DEFAULT_RANGE): boolean {
  return distanceM(lanceur, cible) <= effectiveRangeM(lanceur, cible, r);
}

/** RG-10.1 : joueurs ciblables par un sort offensif, calculés au moment du lancement (amendement RG-10.10 pour les cibles). */
export function playersInRange<T extends { id: string; position: Position | null }>(
  lanceur: { id: string; position: Position | null },
  autres: readonly T[],
  now: number,
  r: RangeSettings = DEFAULT_RANGE,
): T[] {
  const pos = lanceur.position;
  if (isOffRadar(pos, now) || pos === null) return [];
  return autres.filter(
    (p) => p.id !== lanceur.id && isTargetable(p.position, now, r) && isInRange(pos, p.position, r),
  );
}

// --- Zones ---

export type Polygon = readonly LatLng[];

/** Point dans un polygone (lancer de rayon). Suffisant à l'échelle d'un lieu de jeu. */
export function isInPolygon(p: LatLng, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.lat > p.lat !== b.lat > p.lat && p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng) {
      inside = !inside;
    }
  }
  return inside;
}

/** Zone contenant le point (sort Radar, Révélation), ou null hors de toute zone. */
export function zoneOf(p: LatLng, zones: readonly { id: string; polygon: Polygon }[]): string | null {
  return zones.find((z) => isInPolygon(p, z.polygon))?.id ?? null;
}

// --- Anti-triche (RG-15) : le moteur alerte, il ne sanctionne jamais ---

/**
 * Vitesse plausible entre deux mesures, en km/h. On retire les précisions annoncées
 * de la distance pour ne pas accuser un joueur à cause du bruit GPS.
 * null si l'intervalle est trop court pour conclure.
 */
export function speedKmh(p1: Position, p2: Position): number | null {
  const dt = Math.abs(p2.a - p1.a);
  if (dt < MIN_SPEED_INTERVAL_MS) return null;
  const d = Math.max(0, distanceM(p1, p2) - p1.precisionM - p2.precisionM);
  return d / 1000 / (dt / 3_600_000);
}

export function isImpossibleMove(p1: Position, p2: Position): boolean {
  const v = speedKmh(p1, p2);
  return v !== null && v > MAX_WALK_SPEED_KMH;
}

/** RG-15 : même balise scannée par deux joueurs à moins de 10 s d'écart et à plus de 200 m l'un de l'autre. */
export function isSharedPhotoSuspect(
  a: { playerId: string; beaconId: string; position: Position },
  b: { playerId: string; beaconId: string; position: Position },
): boolean {
  return (
    a.playerId !== b.playerId &&
    a.beaconId === b.beaconId &&
    Math.abs(a.position.a - b.position.a) < SHARED_PHOTO_WINDOW_MS &&
    distanceM(a.position, b.position) > SHARED_PHOTO_DISTANCE_M
  );
}
