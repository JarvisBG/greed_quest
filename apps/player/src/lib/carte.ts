// Carte de l'île (accueil, amendement du 2026-10-10 ; prototype docs/prototype/carte-ile.html).
// Projette les contours des zones (`GET /carte`) sur un plan à l'échelle, cadré automatiquement sur les zones.
// RG-6.5 : chaque zone porte seulement son nombre de balises actives, jamais leur place.
// RG-10.12 : la seule position dessinée est celle du joueur.

export type TypeZone = 'masadora' | 'antokiba' | 'soufrabi' | 'sauvage';

export interface ZoneRecue {
  id: string;
  nom: string;
  type: TypeZone;
  polygone: readonly { lat: number; lng: number }[];
}

export interface ZonePlan {
  id: string;
  nom: string;
  type: TypeZone;
  points: [number, number][];
  /** Point où poser le nom et le compteur (centre de gravité de la surface). */
  centre: [number, number];
  haut: number;
  balises: number;
  niveau: 0 | 1 | 2 | 3;
}

export interface Plan {
  /** Largeur du plan en unités : les tailles du dessin (texte, trames, traits) sont fixées pour cette largeur. */
  largeur: number;
  hauteur: number;
  zones: ZonePlan[];
  /** Ta position, si elle tombe sur le plan (ou tout près). */
  moi: { x: number; y: number; r: number } | null;
}

/** Largeur fixe du plan : le dessin garde la même allure quelle que soit la taille du terrain. */
export const LARGEUR = 420;
const MARGE = 0.08;
const M_PAR_DEGRE_LAT = 110_540;
const M_PAR_DEGRE_LNG = 111_320;

/** RG-6.5 : trame de la zone selon son nombre de balises actives (aucune, 1, 2 ou 3, 4 et plus). */
export function niveauBalises(n: number): 0 | 1 | 2 | 3 {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  return n <= 3 ? 2 : 3;
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

/**
 * Plan cadré sur l'ensemble des zones (marge de 8 %), mis à l'échelle sur `LARGEUR` unités.
 * Projection équirectangulaire autour du centre du terrain : exacte à quelques centimètres sur un terrain de jeu.
 */
export function construirePlan(
  zones: readonly ZoneRecue[],
  balisesParZone: Readonly<Record<string, number>>,
  position: { lat: number; lng: number; precisionM: number } | null,
): Plan {
  const tous = zones.flatMap((z) => z.polygone);
  if (tous.length === 0) return { largeur: LARGEUR, hauteur: LARGEUR * 0.75, zones: [], moi: null };
  const lat0 = (Math.min(...tous.map((p) => p.lat)) + Math.max(...tous.map((p) => p.lat))) / 2;
  const kx = M_PAR_DEGRE_LNG * Math.cos((lat0 * Math.PI) / 180);
  const metres = (p: { lat: number; lng: number }): [number, number] => [p.lng * kx, -p.lat * M_PAR_DEGRE_LAT];

  const brut = tous.map(metres);
  const minX = Math.min(...brut.map((p) => p[0]));
  const maxX = Math.max(...brut.map((p) => p[0]));
  const minY = Math.min(...brut.map((p) => p[1]));
  const maxY = Math.max(...brut.map((p) => p[1]));
  // Un terrain très étiré garde une hauteur lisible (au moins la moitié de la largeur).
  const w0 = Math.max(maxX - minX, 1);
  const h0 = Math.max(maxY - minY, w0 * 0.5);
  const cy0 = (minY + maxY) / 2;
  const m = Math.max(w0, h0) * MARGE;
  const ox = minX - m;
  const oy = cy0 - h0 / 2 - m;
  const echelle = LARGEUR / (w0 + 2 * m);
  const plan = (p: { lat: number; lng: number }): [number, number] => {
    const [x, y] = metres(p);
    return [(x - ox) * echelle, (y - oy) * echelle];
  };
  const hauteur = (h0 + 2 * m) * echelle;

  const zs: ZonePlan[] = zones.map((z) => {
    const points = z.polygone.map(plan);
    const n = balisesParZone[z.id] ?? 0;
    return {
      id: z.id,
      nom: z.nom,
      type: z.type,
      points,
      centre: centreDeSurface(points),
      haut: Math.min(...points.map((p) => p[1])),
      balises: n,
      niveau: niveauBalises(n),
    };
  });

  let moi: Plan['moi'] = null;
  if (position) {
    const [x, y] = plan(position);
    // Hors du plan (au-delà d'une demi-marge), on ne dessine pas : « Tu es hors de la carte ».
    const tol = m * echelle * 0.5;
    if (x >= -tol && x <= LARGEUR + tol && y >= -tol && y <= hauteur + tol) moi = { x, y, r: Math.max(6, position.precisionM * echelle) };
  }
  return { largeur: LARGEUR, hauteur, zones: zs, moi };
}

/** Zoom du plein écran : cadre de vue borné au plan (de 1/5 du plan au plan entier). */
export interface Vue {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function bornerVue(v: Vue, largeur: number, hauteur: number): Vue {
  const w = Math.min(largeur, Math.max(largeur / 5, v.w));
  const h = w * (hauteur / largeur);
  return {
    w,
    h,
    x: Math.min(largeur - w, Math.max(0, v.x)),
    y: Math.min(hauteur - h, Math.max(0, v.y)),
  };
}

/** Zoom d'un facteur `f` autour du point (ux, uy) du plan, qui reste sous le doigt. */
export function zoomerVue(v: Vue, f: number, ux: number, uy: number, largeur: number, hauteur: number): Vue {
  const w = Math.min(largeur, Math.max(largeur / 5, v.w * f));
  const k = w / v.w;
  return bornerVue({ x: ux - (ux - v.x) * k, y: uy - (uy - v.y) * k, w, h: 0 }, largeur, hauteur);
}
