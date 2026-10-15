// Plan de l'île dessinée (reprise de apps/player/src/lib/carte.ts) : contours des zones projetés sur 420 unités
// de large, cadrés sur l'ensemble des zones. RG-6.5 : seulement le nombre de balises actives par zone.
import type { Point, ZoneEcran } from './types';

export const LARGEUR = 420;
const MARGE = 0.08;
const M_PAR_DEGRE_LAT = 110_540;
const M_PAR_DEGRE_LNG = 111_320;

export interface ZonePlan {
  id: string;
  nom: string;
  ville: boolean;
  points: [number, number][];
  centre: [number, number];
  haut: number;
}

export interface Plan {
  largeur: number;
  hauteur: number;
  zones: ZonePlan[];
  /** Unités du plan pour un mètre du terrain (taille des halos). */
  parMetre: number;
  projeter: (p: Point) => [number, number];
}

function centreDeSurface(pts: [number, number][]): [number, number] {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[(i + 1) % pts.length]!;
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-9) {
    const n = pts.length || 1;
    return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

export function construirePlan(zones: readonly ZoneEcran[]): Plan {
  const tous = zones.flatMap((z) => z.polygone);
  if (tous.length === 0) return { largeur: LARGEUR, hauteur: 320, zones: [], parMetre: 1, projeter: () => [LARGEUR / 2, 160] };
  const lat0 = (Math.min(...tous.map((p) => p.lat)) + Math.max(...tous.map((p) => p.lat))) / 2;
  const kx = M_PAR_DEGRE_LNG * Math.cos((lat0 * Math.PI) / 180);
  const metres = (p: Point): [number, number] => [p.lng * kx, -p.lat * M_PAR_DEGRE_LAT];
  const brut = tous.map(metres);
  const minX = Math.min(...brut.map((p) => p[0]));
  const maxX = Math.max(...brut.map((p) => p[0]));
  const minY = Math.min(...brut.map((p) => p[1]));
  const maxY = Math.max(...brut.map((p) => p[1]));
  // L'écran est en paysage : au moins 0,6 de haut pour 1 de large, au plus 0,9 (le cadre garde sa place).
  const w0 = Math.max(maxX - minX, (maxY - minY) / 0.9, 1);
  const h0 = Math.max(maxY - minY, w0 * 0.6);
  const cx0 = (minX + maxX) / 2;
  const cy0 = (minY + maxY) / 2;
  const m = Math.max(w0, h0) * MARGE;
  const ox = cx0 - w0 / 2 - m;
  const oy = cy0 - h0 / 2 - m;
  const echelle = LARGEUR / (w0 + 2 * m);
  const projeter = (p: Point): [number, number] => {
    const [x, y] = metres(p);
    return [(x - ox) * echelle, (y - oy) * echelle];
  };
  return {
    largeur: LARGEUR,
    hauteur: (h0 + 2 * m) * echelle,
    parMetre: echelle,
    projeter,
    zones: zones.map((z) => {
      const points = z.polygone.map(projeter);
      return { id: z.id, nom: z.nom, ville: z.type !== 'sauvage', points, centre: centreDeSurface(points), haut: Math.min(...points.map((p) => p[1])) };
    }),
  };
}
