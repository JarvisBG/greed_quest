import { describe, expect, it } from 'vitest';
import { bornerVue, construirePlan, LARGEUR, niveauBalises, zoomerVue, type ZoneRecue } from './carte';

const LAT = 48.85;
const LNG = 2.35;
// ~1 m en degrés autour de Paris.
const dLat = 1 / 110_540;
const dLng = 1 / (111_320 * Math.cos((LAT * Math.PI) / 180));
const carre = (id: string, type: ZoneRecue['type'], x: number, y: number, c: number): ZoneRecue => ({
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

describe('carte de l’île', () => {
  it('RG-6.5 : la trame dit seulement combien de balises actives (aucune, 1, 2 ou 3, 4 et plus)', () => {
    expect([0, 1, 2, 3, 4, 9].map(niveauBalises)).toEqual([0, 1, 2, 2, 3, 3]);
  });

  it('cadre automatique : toutes les zones tiennent dans le plan, avec une marge, à l’échelle', () => {
    const zones = [carre('a', 'masadora', 0, 0, 100), carre('b', 'sauvage', 200, 0, 100), carre('c', 'sauvage', 0, 150, 100)];
    const p = construirePlan(zones, { a: 2 }, null);
    const pts = p.zones.flatMap((z) => z.points);
    expect(Math.min(...pts.map((q) => q[0]))).toBeGreaterThan(0);
    expect(Math.max(...pts.map((q) => q[0]))).toBeLessThan(LARGEUR);
    expect(Math.min(...pts.map((q) => q[1]))).toBeGreaterThan(0);
    expect(Math.max(...pts.map((q) => q[1]))).toBeLessThan(p.hauteur);
    // Échelle respectée : un carré reste carré.
    const [z] = p.zones;
    const larg = z!.points[1]![0] - z!.points[0]![0];
    const haut = z!.points[2]![1] - z!.points[1]![1];
    expect(haut / larg).toBeCloseTo(1, 2);
    expect(p.zones.map((x) => [x.id, x.balises, x.niveau])).toEqual([
      ['a', 2, 2],
      ['b', 0, 0],
      ['c', 0, 0],
    ]);
    expect(z!.centre[0]).toBeCloseTo(z!.points[0]![0] + larg / 2, 1);
  });

  it('RG-10.12 : seule ta position est dessinée, et seulement si elle tombe sur le plan', () => {
    const zones = [carre('a', 'sauvage', 0, 0, 100)];
    const dedans = construirePlan(zones, {}, { lat: LAT - 50 * dLat, lng: LNG + 50 * dLng, precisionM: 5 });
    expect(dedans.moi).not.toBeNull();
    expect(dedans.moi!.x).toBeCloseTo(LARGEUR / 2, 0);
    const loin = construirePlan(zones, {}, { lat: LAT - 5000 * dLat, lng: LNG, precisionM: 5 });
    expect(loin.moi).toBeNull();
  });

  it('sans zone, le plan est vide', () => {
    expect(construirePlan([], {}, null).zones).toEqual([]);
  });

  it('zoom borné au plan, le point visé reste sous le doigt', () => {
    const v = zoomerVue({ x: 0, y: 0, w: 420, h: 300 }, 0.5, 210, 150, 420, 300);
    expect(v).toEqual({ x: 105, y: 75, w: 210, h: 150 });
    expect(zoomerVue(v, 0.01, 0, 0, 420, 300).w).toBe(84);
    expect(bornerVue({ x: -50, y: 999, w: 9999, h: 0 }, 420, 300)).toEqual({
      x: 0,
      y: 0,
      w: 420,
      h: 300,
    });
  });
});
