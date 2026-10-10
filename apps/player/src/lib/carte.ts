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

/**
 * Vue de la carte agrandie : le point regardé (cx, cy, en unités du plan) et le zoom z (1 = carte entière, jusqu'à 5).
 * À z = 1, la feuille de parchemin serre la carte ; dès qu'on zoome, elle se déplie jusqu'aux bords de la scène
 * (les rouleaux s'écartent) à échelle constante : on voit plus de carte au lieu d'un saut de zoom (validé le 2026-10-10).
 */
export interface Vue {
  cx: number;
  cy: number;
  z: number;
}

export const ZOOM_MAX = 5;
/** Place laissée autour de la feuille dans la scène (rouleaux à gauche et à droite, bords déchirés en haut et en bas). */
export const GOUTTIERE = { x: 84, y: 36 };

export interface Cadrage {
  vue: Vue;
  /** Taille de la feuille en pixels. */
  feuille: { w: number; h: number };
  /** viewBox du dessin. */
  vb: { x: number; y: number; w: number; h: number };
  /** Pixels par unité du plan. */
  echelle: number;
}

export function cadrer(v: Vue, scene: { w: number; h: number }, largeur: number, hauteur: number): Cadrage {
  const z = Math.min(ZOOM_MAX, Math.max(1, v.z));
  const aw = Math.max(1, scene.w - GOUTTIERE.x);
  const ah = Math.max(1, scene.h - GOUTTIERE.y);
  const fw0 = Math.min(aw, ah * (largeur / hauteur));
  const deplie = z > 1.01;
  const feuille = deplie ? { w: aw, h: ah } : { w: fw0, h: fw0 * (hauteur / largeur) };
  const echelle = (fw0 / largeur) * z;
  const w = feuille.w / echelle;
  const h = feuille.h / echelle;
  // Plus grande que la carte dans un sens : la carte reste centrée dans ce sens.
  const cx = w >= largeur ? largeur / 2 : Math.min(largeur - w / 2, Math.max(w / 2, v.cx));
  const cy = h >= hauteur ? hauteur / 2 : Math.min(hauteur - h / 2, Math.max(h / 2, v.cy));
  return { vue: { cx, cy, z }, feuille, vb: { x: cx - w / 2, y: cy - h / 2, w, h }, echelle };
}

/** Zoom d'un facteur `f` (> 1 = rapprocher) autour du point (ux, uy) du plan, qui reste sous le doigt. */
export function zoomerVue(v: Vue, f: number, ux: number, uy: number): Vue {
  const z = Math.min(ZOOM_MAX, Math.max(1, v.z * f));
  const k = v.z / z;
  return { cx: ux + (v.cx - ux) * k, cy: uy + (v.cy - uy) * k, z };
}
