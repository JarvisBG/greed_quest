// Carte de l'île (accueil, amendement du 2026-10-10 ; prototype docs/prototype/carte-ile.html).
// Projette les contours des zones (`GET /carte`) sur un plan à l'échelle, cadré automatiquement sur les zones.
// RG-6.5 : chaque zone porte seulement son nombre de balises actives, jamais leur place.
// RG-10.12 : la seule position dessinée est celle du joueur.

import { dessinerIle, distanceAuContour, MER, type Ile } from '@gq/ui/ile';

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
  /** Point du terrain → point du plan (Accompagnement : la cible, au seul lanceur). */
  projeter: (p: { lat: number; lng: number }) => [number, number];
  /** Côte, territoires, lavis, vagues (prototype v3 validé le 2026-10-17) ; null sans zone. */
  ile: Ile | null;
  /** Mètres du terrain pour une unité du plan (distances affichées au joueur). */
  metresParUnite: number;
}

/** Largeur fixe du plan : le dessin garde la même allure quelle que soit la taille du terrain. */
export const LARGEUR = 420;
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
  if (tous.length === 0) return { largeur: LARGEUR, hauteur: LARGEUR * 0.75, zones: [], moi: null, projeter: () => [LARGEUR / 2, LARGEUR * 0.375], ile: null, metresParUnite: 1 };
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
  // v3 : une marge de mer fixe (MER unités) autour des zones, pour la côte et les vagues ; un terrain très haut
  // reste limité à 420 unités de haut (hors mer).
  const echelle = Math.min((LARGEUR - 2 * MER) / w0, 420 / h0);
  const ox = minX - (LARGEUR - w0 * echelle) / 2 / echelle;
  const oy = cy0 - h0 / 2 - MER / echelle;
  const plan = (p: { lat: number; lng: number }): [number, number] => {
    const [x, y] = metres(p);
    return [(x - ox) * echelle, (y - oy) * echelle];
  };
  const hauteur = h0 * echelle + 2 * MER;

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
    const tol = MER * 0.5;
    if (x >= -tol && x <= LARGEUR + tol && y >= -tol && y <= hauteur + tol) moi = { x, y, r: Math.max(6, position.precisionM * echelle) };
  }
  return { largeur: LARGEUR, hauteur, zones: zs, moi, projeter: plan, ile: ileDe(zs, hauteur), metresParUnite: 1 / echelle };
}

// L'île ne dépend que des zones : calculée une fois, pas à chaque pas du joueur.
let ileCache: { cle: string; ile: Ile } | null = null;
function ileDe(zs: readonly ZonePlan[], hauteur: number): Ile {
  const cle = zs.map((z) => `${z.id}:${z.type}:${z.points.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ')}`).join('|');
  if (ileCache?.cle !== cle) ileCache = { cle, ile: dessinerIle(zs, LARGEUR, hauteur) };
  return ileCache.ile;
}

/**
 * Où es-tu ? Dans une zone (son vrai contour, celui du GM), sinon près de la plus proche. null sans position.
 */
export function ouSuisJe(plan: Plan): { zone: ZonePlan; dedans: boolean } | null {
  if (!plan.moi || plan.zones.length === 0) return null;
  const p: [number, number] = [plan.moi.x, plan.moi.y];
  const dans = plan.zones.find((z) => dansPolygone(p, z.points));
  if (dans) return { zone: dans, dedans: true };
  const proche = [...plan.zones].sort((a, b) => distanceAuContour(p, a.points) - distanceAuContour(p, b.points))[0]!;
  return { zone: proche, dedans: false };
}

const POINTS_CARDINAUX = ['le nord', 'le nord-est', 'l’est', 'le sud-est', 'le sud', 'le sud-ouest', 'l’ouest', 'le nord-ouest'];

/**
 * Guidage vers une zone (son centre) : distance arrondie à 5 m, cap en degrés (0 = nord, sens horaire) et
 * direction en clair : « tout droit / à ta droite… » si l'on connaît l'orientation du téléphone, sinon « vers le nord-est ».
 */
export function versZone(plan: Plan, z: ZonePlan, orientation: number | null = null): { metres: number; cap: number; direction: string; arrive: boolean } | null {
  if (!plan.moi) return null;
  const dx = z.centre[0] - plan.moi.x;
  const dy = z.centre[1] - plan.moi.y;
  const metres = Math.round((Math.hypot(dx, dy) * plan.metresParUnite) / 5) * 5;
  const cap = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  const arrive = dansPolygone([plan.moi.x, plan.moi.y], z.points);
  let direction = `vers ${POINTS_CARDINAUX[Math.round(cap / 45) % 8]}`;
  if (orientation !== null) {
    const rel = (cap - orientation + 360) % 360;
    direction = rel < 30 || rel > 330 ? 'tout droit' : rel < 150 ? 'à ta droite' : rel <= 210 ? 'derrière toi' : 'à ta gauche';
  }
  return { metres, cap, direction, arrive };
}

/** Le point est-il dans le polygone (lancer de rayon) ? */
export function dansPolygone([x, y]: readonly [number, number], pts: readonly (readonly [number, number])[]): boolean {
  let dedans = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!;
    const [xj, yj] = pts[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

const premierDedans = (z: ZonePlan, l: [number, number][]) => l.find((q) => dansPolygone(q, z.points)) ?? z.centre;

/**
 * Page ⑨, Trace : des pas d'encre dans la zone, sous son nom, du plus ancien au plus récent (le dernier est le
 * point d'impact de la comète). Décor seulement : la zone est tout ce que le sort apprend (RG-10.12).
 */
export function cheminDeTrace(z: ZonePlan, n = 4): { pas: { x: number; y: number; angle: number; cote: 1 | -1 }[]; etiquette: [number, number] } {
  const [cx, cy] = z.centre;
  // On marche vers le nord-est ; le chemin raccourcit jusqu'à ce que chaque pas tienne dans la zone.
  const [ux, uy] = [0.93, -0.37];
  const angle = (Math.atan2(uy, ux) * 180) / Math.PI + 90;
  const chemin = (fin: [number, number], l: number) => {
    const debut: [number, number] = [fin[0] - ux * l, fin[1] - uy * l];
    const pas = Array.from({ length: n }, (_, i) => {
      const t = n > 1 ? i / (n - 1) : 1;
      const cote: 1 | -1 = i % 2 ? 1 : -1;
      return { x: debut[0] + (fin[0] - debut[0]) * t - uy * 6 * cote, y: debut[1] + (fin[1] - debut[1]) * t + ux * 6 * cote, angle, cote };
    });
    return { pas, etiquette: [debut[0], Math.max(debut[1], fin[1]) + 14] as [number, number] };
  };
  const fins: [number, number][] = [
    [cx + 14, cy + 24],
    [cx, cy + 20],
    [cx, cy],
  ];
  for (const fin of fins)
    for (let l = 100; l >= 16; l -= 6) {
      const c = chemin(fin, l);
      if (c.pas.every((q) => dansPolygone([q.x, q.y], z.points))) return c;
    }
  return chemin(z.centre, 0);
}

/** Page ⑨, Guide : pied de la colonne de lumière, à côté du nom de la zone pour qu'il reste lisible (RG-6.5 : jamais la balise). */
export function piedDeGuide(z: ZonePlan): [number, number] {
  const [cx, cy] = z.centre;
  return premierDedans(z, [
    [cx + 34, cy + 30],
    [cx - 34, cy + 30],
    [cx + 34, cy + 22],
    [cx, cy + 32],
    [cx, cy + 26],
  ]);
}

/** Suivi d'Accompagnement : vue carrée sur toi et la cible, marge de 45 unités, jamais plus serrée que `min`. */
export function cadrageSuivi(a: readonly [number, number], b: readonly [number, number], min = 210): { x: number; y: number; w: number; h: number } {
  const cote = Math.max(min, Math.abs(a[0] - b[0]) + 90, Math.abs(a[1] - b[1]) + 90);
  return { x: (a[0] + b[0]) / 2 - cote / 2, y: (a[1] + b[1]) / 2 - cote / 2, w: cote, h: cote };
}

/** Les deux points sont-ils encore bien dans la vue (à 22 unités du bord) ? Sinon on recadre. */
export function resteCadre(v: { x: number; y: number; w: number; h: number }, ...pts: readonly (readonly [number, number])[]): boolean {
  return pts.every(([x, y]) => x > v.x + 22 && x < v.x + v.w - 22 && y > v.y + 22 && y < v.y + v.h - 22);
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
