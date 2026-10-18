// Dessin de l'île (prototype v3 validé le 2026-10-17 : docs/prototype/carte-ile-v3.html). Le jeu se joue n'importe
// où : l'île est tirée des zones du GM. Côte = enveloppe des zones poussée au large d'une marge qui ondule ;
// territoires = chaque point de l'île revient à la zone dont le contour est le plus proche (Voronoï), ils se touchent
// jusqu'à la côte ; lavis de couleur par type de zone. Tout est tiré d'une graine (les identifiants des zones) :
// la même partie donne toujours la même île. Les vrais contours restent la référence du jeu (« dans » / « près de »).
import { Delaunay } from 'd3-delaunay';

export type Pt = [number, number];

/** Marge de mer autour des zones, en unités du plan (largeur 420). */
export const MER = 70;
/** Lavis des villes ; les zones de chasse prennent tour à tour un vert ou un ocre. */
export const LAVIS: Record<string, string> = { masadora: '#d79a55', antokiba: '#c4705f', soufrabi: '#d3ad4c' };
export const LAVIS_CHASSE = ['#8fb26a', '#5f8f57', '#b3c27a', '#a3b08a'];
/** Icônes à l'encre, même trait partout : sac (boutique), marteau (enchères), poing (arène), feuille (chasse). */
export const ICONES_ZONE: Record<'masadora' | 'antokiba' | 'soufrabi' | 'sauvage', string> = {
  masadora: 'M-7 -2h14l-1.6 10h-10.8z M-4 -2v-2a4 4 0 0 1 8 0v2',
  antokiba: 'M-8 8h9 M-5.5 2.5l7-7 4 4-7 7z M3 -2.5l5.5 5.5',
  soufrabi: 'M-6 8v-6c0-2 1-3 2.6-3h6.8c1.8 0 2.6 1 2.6 3v2c0 2.6-2 4-4.4 4z M-6 1h12 M-2.2 -2v3 M1.6 -2v3 M-6 3.5c-1.6 0-2.4-1-2.4-2.4',
  sauvage: 'M-7 7c0-8 5-13 14-14 0 9-5 14-13 14z M-7 7l7-7',
};

export const graine = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
/** Tirage reproductible (mulberry32). */
export function hasard(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Enveloppe convexe (chaîne monotone). */
export function enveloppe(pts: readonly Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const x = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const bas: Pt[] = [];
  const haut: Pt[] = [];
  for (const q of p) {
    while (bas.length >= 2 && x(bas[bas.length - 2]!, bas[bas.length - 1]!, q) <= 0) bas.pop();
    bas.push(q);
  }
  for (const q of [...p].reverse()) {
    while (haut.length >= 2 && x(haut[haut.length - 2]!, haut[haut.length - 1]!, q) <= 0) haut.pop();
    haut.push(q);
  }
  return bas.slice(0, -1).concat(haut.slice(0, -1));
}

/** Points tous les `pas` le long du contour fermé. */
export function reechantillonner(poly: readonly Pt[], pas: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / pas));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

/** Coins arrondis (Chaikin, contour fermé). */
export function chaikin(pts: Pt[], n: number): Pt[] {
  for (let r = 0; r < n; r++) {
    const o: Pt[] = [];
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length]!;
      o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    });
    pts = o;
  }
  return pts;
}

/** Courbe fermée lisse (Catmull-Rom → Bézier). */
export function courbe(pts: readonly Pt[]): string {
  const n = pts.length;
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(pts[0]![0])} ${f(pts[0]![1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!;
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % n]!;
    const p3 = pts[(i + 2) % n]!;
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
}

const centre = (pts: readonly Pt[]): Pt => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

export function dedans([x, y]: Pt, pts: readonly Pt[]): boolean {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!;
    const [xj, yj] = pts[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Distance d'un point au contour d'un polygone (0 au bord, positive dedans comme dehors). */
export function distanceAuContour(p: Pt, pts: readonly Pt[]): number {
  let m = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    m = Math.min(m, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy));
  }
  return m;
}

/**
 * Côte : l'enveloppe des zones, poussée vers le large d'une marge qui ondule en baies et en caps
 * (32 ± 17 unités : jamais moins de 13, la côte ne touche jamais une zone).
 */
export function cote(zones: readonly (readonly Pt[])[], r: () => number): Pt[] {
  const env = enveloppe(zones.flat());
  const c = centre(env);
  const s = reechantillonner(env, 5);
  const n = s.length;
  const ph = [r() * 6.3, r() * 6.3, r() * 6.3];
  return chaikin(
    s.map((p, i) => {
      const a = s[(i - 1 + n) % n]!;
      const b = s[(i + 1) % n]!;
      let nx = b[1] - a[1];
      let ny = -(b[0] - a[0]);
      const L = Math.hypot(nx, ny) || 1;
      nx /= L;
      ny /= L;
      if (nx * (p[0] - c[0]) + ny * (p[1] - c[1]) < 0) {
        nx = -nx;
        ny = -ny;
      }
      const t = (i / n) * Math.PI * 2;
      const d = 32 + 17 * (0.5 * Math.sin(2 * t + ph[0]!) + 0.3 * Math.sin(3 * t + ph[1]!) + 0.2 * Math.sin(7 * t + ph[2]!)) + 1.6 * Math.sin(23 * t);
      return [p[0] + nx * d, p[1] + ny * d] as Pt;
    }),
    1,
  );
}

/**
 * Territoires : Voronoï de points pris tous les 6 unités sur les contours des zones ; les cellules d'une même zone
 * forment son territoire (un chemin SVG), les arêtes entre deux zones différentes forment les frontières.
 */
export function territoires(zones: readonly (readonly Pt[])[], largeur: number, hauteur: number): { chemins: string[]; frontieres: string } {
  const sites: Pt[] = [];
  const lab: number[] = [];
  zones.forEach((z, zi) =>
    reechantillonner(z, 6).forEach((q) => {
      sites.push(q);
      lab.push(zi);
    }),
  );
  const chemins = zones.map(() => '');
  if (sites.length < 3) return { chemins, frontieres: '' };
  const vor = Delaunay.from(sites).voronoi([-60, -60, largeur + 60, hauteur + 60]);
  const f = (v: number) => v.toFixed(1);
  const cle = (q: ArrayLike<number>) => `${q[0]!.toFixed(3)},${q[1]!.toFixed(3)}`;
  const frontieres: string[] = [];
  for (let i = 0; i < sites.length; i++) {
    const poly = vor.cellPolygon(i);
    if (!poly) continue;
    const ring = poly.slice(0, -1);
    chemins[lab[i]!] += 'M' + ring.map((q) => `${f(q[0]!)} ${f(q[1]!)}`).join('L') + 'Z';
    for (const j of vor.neighbors(i)) {
      if (j <= i || lab[j] === lab[i]) continue;
      const voisins = new Set((vor.cellPolygon(j) ?? []).map(cle));
      const communs = ring.filter((q) => voisins.has(cle(q)));
      if (communs.length >= 2) frontieres.push(`M${f(communs[0]![0]!)} ${f(communs[0]![1]!)}L${f(communs[1]![0]!)} ${f(communs[1]![1]!)}`);
    }
  }
  return { chemins, frontieres: frontieres.join('') };
}

export interface Ile {
  /** Côte, chemin SVG fermé. */
  littoral: string;
  /** Territoire de chaque zone (même ordre que les zones). */
  territoires: string[];
  /** Lavis de chaque zone. */
  lavis: string[];
  frontieres: string;
  vagues: Pt[];
  /** Îlots : centre et rayon. */
  ilots: [number, number, number][];
}

/** L'île entière pour des zones déjà projetées sur le plan. Reproductible : la graine vient des identifiants. */
export function dessinerIle(zones: readonly { id: string; type: string; points: readonly Pt[] }[], largeur: number, hauteur: number): Ile {
  const r = hasard(graine(zones.map((z) => z.id).join()));
  const L = cote(
    zones.map((z) => z.points),
    r,
  );
  const loin = (p: Pt, m: number) => !dedans(p, L) && L.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > m);
  const vagues: Pt[] = [];
  for (let i = 0; i < 400 && vagues.length < 22; i++) {
    const p: Pt = [r() * largeur, r() * hauteur];
    if (loin(p, 14) && vagues.every((v) => Math.hypot(v[0] - p[0], v[1] - p[1]) > 34)) vagues.push(p);
  }
  const ilots: [number, number, number][] = [];
  for (let i = 0; i < 200 && ilots.length < 2; i++) {
    const p: Pt = [10 + r() * (largeur - 20), 10 + r() * (hauteur - 20)];
    // Jamais sur le titre « GREED ISLAND » (en haut à gauche).
    if (loin(p, 22) && !(p[0] < 156 && p[1] < 46)) ilots.push([p[0], p[1], 4 + r() * 5]);
  }
  const t = territoires(
    zones.map((z) => z.points),
    largeur,
    hauteur,
  );
  let iChasse = 0;
  const lavis = zones.map((z) => LAVIS[z.type] ?? LAVIS_CHASSE[iChasse++ % LAVIS_CHASSE.length]!);
  return { littoral: courbe(L), territoires: t.chemins, lavis, frontieres: t.frontieres, vagues, ilots };
}
