// Plan de l'île dessinée (reprise de apps/player/src/lib/carte.ts) : contours des zones projetés sur 420 unités
// de large, cadrés sur l'ensemble des zones, avec la marge de mer de l'île v3 (validée le 2026-10-17).
// RG-6.5 : seulement le nombre de balises actives par zone.
import { dessinerIle, MER, type Ile } from '@gq/ui/ile';
import type { Point, ZoneEcran } from './types';

export const LARGEUR = 420;
const M_PAR_DEGRE_LAT = 110_540;
const M_PAR_DEGRE_LNG = 111_320;

export interface ZonePlan {
  id: string;
  nom: string;
  type: ZoneEcran['type'];
  points: [number, number][];
  centre: [number, number];
}

export interface Plan {
  largeur: number;
  hauteur: number;
  zones: ZonePlan[];
  /** Unités du plan pour un mètre du terrain (taille des halos). */
  parMetre: number;
  projeter: (p: Point) => [number, number];
  /** Côte, territoires, lavis (null sans zone). */
  ile: Ile | null;
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
  if (tous.length === 0) return { largeur: LARGEUR, hauteur: 320, zones: [], parMetre: 1, projeter: () => [LARGEUR / 2, 160], ile: null };
  const lat0 = (Math.min(...tous.map((p) => p.lat)) + Math.max(...tous.map((p) => p.lat))) / 2;
  const kx = M_PAR_DEGRE_LNG * Math.cos((lat0 * Math.PI) / 180);
  const metres = (p: Point): [number, number] => [p.lng * kx, -p.lat * M_PAR_DEGRE_LAT];
  const brut = tous.map(metres);
  const minX = Math.min(...brut.map((p) => p[0]));
  const maxX = Math.max(...brut.map((p) => p[0]));
  const minY = Math.min(...brut.map((p) => p[1]));
  const maxY = Math.max(...brut.map((p) => p[1]));
  // L'écran est en paysage : le plan entier (mer comprise) fait de 0,6 à 0,9 de haut pour 1 de large.
  const echelle = Math.min((LARGEUR - 2 * MER) / Math.max(maxX - minX, 1), (LARGEUR * 0.9 - 2 * MER) / Math.max(maxY - minY, 1));
  const hauteur = Math.max((maxY - minY) * echelle + 2 * MER, LARGEUR * 0.6);
  const ox = (minX + maxX) / 2 - LARGEUR / 2 / echelle;
  const oy = (minY + maxY) / 2 - hauteur / 2 / echelle;
  const projeter = (p: Point): [number, number] => {
    const [x, y] = metres(p);
    return [(x - ox) * echelle, (y - oy) * echelle];
  };
  const zs = zones.map((z) => {
    const points = z.polygone.map(projeter);
    return { id: z.id, nom: z.nom, type: z.type, points, centre: centreDeSurface(points) };
  });
  return { largeur: LARGEUR, hauteur, parMetre: echelle, projeter, zones: zs, ile: dessinerIle(zs, LARGEUR, hauteur) };
}
