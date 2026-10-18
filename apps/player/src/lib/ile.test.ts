import { describe, expect, it } from 'vitest';
import { construirePlan, ouSuisJe, versZone, type ZoneRecue } from './carte';
import { cote, dedans, dessinerIle, distanceAuContour, hasard, territoires, type Pt } from '@gq/ui/ile';

const LAT = 4.05;
const LNG = 9.77;
const dLat = 1 / 110_540;
const dLng = 1 / (111_320 * Math.cos((LAT * Math.PI) / 180));
// Carré de c mètres, coin nord-ouest à (x, y) mètres (x vers l'est, y vers le sud), comme la démo.
const carre = (id: string, type: ZoneRecue['type'], x: number, y: number, c = 100): ZoneRecue => ({
  id,
  nom: id,
  type,
  polygone: [
    { lat: LAT - y * dLat, lng: LNG + x * dLng },
    { lat: LAT - y * dLat, lng: LNG + (x + c) * dLng },
    { lat: LAT - (y + c) * dLat, lng: LNG + (x + c) * dLng },
    { lat: LAT - (y + c) * dLat, lng: LNG + x * dLng },
  ],
});
const DEMO = [
  carre('masadora', 'masadora', 0, 0),
  carre('prairie', 'sauvage', 120, 0),
  carre('antokiba', 'antokiba', 240, 0),
  carre('foret', 'sauvage', 0, 120),
  carre('rives', 'sauvage', 120, 120),
  carre('soufrabi', 'soufrabi', 240, 120),
];
const ici = (x: number, y: number) => ({ lat: LAT - y * dLat, lng: LNG + x * dLng, precisionM: 5 });

describe('île de la carte (v3, 2026-10-17)', () => {
  it('la côte entoure toutes les zones sans jamais en toucher une (au moins 13 unités de mer)', () => {
    const zones: Pt[][] = [
      [
        [100, 100],
        [200, 100],
        [200, 200],
        [100, 200],
      ],
    ];
    const L = cote(zones, hasard(1));
    for (const q of zones[0]!) {
      expect(dedans(q, L)).toBe(true);
      expect(distanceAuContour(q, L)).toBeGreaterThan(12);
    }
  });

  it('chaque zone reçoit un territoire, et les zones voisines ont une frontière', () => {
    const a: Pt[] = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ];
    const b: Pt[] = [
      [120, 0],
      [220, 0],
      [220, 100],
      [120, 100],
    ];
    const t = territoires([a, b], 420, 200);
    expect(t.chemins).toHaveLength(2);
    expect(t.chemins.every((c) => c.startsWith('M'))).toBe(true);
    // Frontière à mi-chemin des deux carrés (x = 110).
    const xs = [...t.frontieres.matchAll(/[ML](-?[\d.]+) /g)].map((m) => Number(m[1]));
    expect(xs.length).toBeGreaterThan(0);
    expect(xs.every((x) => Math.abs(x - 110) < 1)).toBe(true);
  });

  it('la même partie donne toujours la même île ; villes à leur couleur, chasse en verts et ocres', () => {
    const plan = construirePlan(DEMO, {}, null);
    const z = plan.zones.map((x) => ({ id: x.id, type: x.type, points: x.points }));
    expect(dessinerIle(z, plan.largeur, plan.hauteur)).toEqual(dessinerIle(z, plan.largeur, plan.hauteur));
    expect(plan.ile!.lavis[0]).toBe('#d79a55');
    expect(new Set([plan.ile!.lavis[1], plan.ile!.lavis[3], plan.ile!.lavis[4]]).size).toBe(3);
  });

  it('mer autour des zones : 70 unités de marge, largeur 420', () => {
    const plan = construirePlan(DEMO, {}, null);
    const xs = plan.zones.flatMap((z) => z.points.map((q) => q[0]));
    const ys = plan.zones.flatMap((z) => z.points.map((q) => q[1]));
    expect(Math.min(...xs)).toBeCloseTo(70, 0);
    expect(Math.max(...xs)).toBeCloseTo(350, 0);
    expect(Math.min(...ys)).toBeCloseTo(70, 0);
    expect(plan.hauteur - Math.max(...ys)).toBeCloseTo(70, 0);
  });

  it('« Tu es dans » d’après le vrai contour, sinon « près de » la zone la plus proche', () => {
    const dans = ouSuisJe(construirePlan(DEMO, {}, ici(50, 170)));
    expect(dans).toMatchObject({ dedans: true, zone: { id: 'foret' } });
    const entre = ouSuisJe(construirePlan(DEMO, {}, ici(105, 170)));
    expect(entre).toMatchObject({ dedans: false, zone: { id: 'foret' } });
    expect(ouSuisJe(construirePlan(DEMO, {}, null))).toBeNull();
  });

  it('guidage : distance arrondie à 5 m et direction, en clair avec ou sans boussole', () => {
    const plan = construirePlan(DEMO, {}, ici(50, 170));
    const masadora = plan.zones.find((z) => z.id === 'masadora')!;
    const v = versZone(plan, masadora)!;
    // Centre de Masadora à (50, 50) : 120 m plein nord.
    expect(v.metres).toBe(120);
    expect(v.direction).toBe('vers le nord');
    expect(v.arrive).toBe(false);
    expect(versZone(plan, masadora, 0)!.direction).toBe('tout droit');
    expect(versZone(plan, masadora, 90)!.direction).toBe('à ta gauche');
    expect(versZone(plan, masadora, 180)!.direction).toBe('derrière toi');
    expect(versZone(plan, plan.zones.find((z) => z.id === 'foret')!)!.arrive).toBe(true);
  });
});
