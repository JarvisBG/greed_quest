// Données de départ : préréglages système (RG-14.5) et partie de démonstration
// (catalogue de 30 cartes RG-8.1, zones, balises), en brouillon (RG-4.1).
import type { Rank } from '@gq/shared';
import { SYSTEM_PRESETS, presetSettings, type LatLng, type Polygon } from '@gq/engine';
import { newBeaconId, newId } from '../ids.js';
import type { DbOrTx } from './client.js';
import { balises, cartes, parties, prereglages, zones, type ZoneType } from './schema.js';

/** Catalogue proposé (habillage définitif à trancher, REGLES.md « Points ouverts »). Ordre : 001 → 030. */
export const DEMO_CATALOGUE: readonly { nom: string; rang: Rank }[] = [
  { nom: 'Couronne du Roi-Dragon', rang: 'SS' },
  { nom: 'Cœur de l’Île', rang: 'SS' },
  { nom: 'Épée des Sept Vents', rang: 'S' },
  { nom: 'Miroir des Âmes', rang: 'S' },
  { nom: 'Clé du Labyrinthe', rang: 'S' },
  { nom: 'Boussole céleste', rang: 'A' },
  { nom: 'Lanterne éternelle', rang: 'A' },
  { nom: 'Grimoire interdit', rang: 'A' },
  { nom: 'Plume de phénix', rang: 'A' },
  { nom: 'Sablier d’argent', rang: 'A' },
  { nom: 'Masque du bouffon', rang: 'B' },
  { nom: 'Bottes de sept lieues', rang: 'B' },
  { nom: 'Fiole de jouvence', rang: 'B' },
  { nom: 'Carte au trésor', rang: 'B' },
  { nom: 'Anneau d’ombre', rang: 'B' },
  { nom: 'Dé du destin', rang: 'B' },
  { nom: 'Pomme d’or', rang: 'C' },
  { nom: 'Cape de brume', rang: 'C' },
  { nom: 'Flûte enchantée', rang: 'C' },
  { nom: 'Gemme de feu', rang: 'C' },
  { nom: 'Corde infinie', rang: 'C' },
  { nom: 'Bourse sans fond', rang: 'C' },
  { nom: 'Œil de chouette', rang: 'C' },
  { nom: 'Pain magique', rang: 'D' },
  { nom: 'Lampe de poche', rang: 'D' },
  { nom: 'Galet chanceux', rang: 'D' },
  { nom: 'Ticket de bus', rang: 'D' },
  { nom: 'Bonbon arc-en-ciel', rang: 'D' },
  { nom: 'Chaussette perdue', rang: 'D' },
  { nom: 'Fourchette dorée', rang: 'D' },
];

const DEMO_ZONES: readonly { nom: string; type: ZoneType }[] = [
  { nom: 'Masadora', type: 'masadora' },
  { nom: 'Antokiba', type: 'antokiba' },
  { nom: 'Soufrabi', type: 'soufrabi' },
  { nom: 'Forêt', type: 'sauvage' },
  { nom: 'Lac', type: 'sauvage' },
  { nom: 'Collines', type: 'sauvage' },
];

/** RG-14.5 : (ré)écrit les préréglages système. */
export async function seedPresets(db: DbOrTx): Promise<void> {
  for (const p of SYSTEM_PRESETS) {
    const row = { id: p.id, nom: p.nom, description: p.description, systeme: true, reglages: p.reglages };
    await db.insert(prereglages).values(row).onConflictDoUpdate({ target: prereglages.id, set: row });
  }
}

/** Carré de `coteM` mètres centré sur `c`. */
function square(c: LatLng, coteM: number): Polygon {
  const dLat = coteM / 2 / 111_320;
  const dLng = coteM / 2 / (111_320 * Math.cos((c.lat * Math.PI) / 180));
  return [
    { lat: c.lat - dLat, lng: c.lng - dLng },
    { lat: c.lat - dLat, lng: c.lng + dLng },
    { lat: c.lat + dLat, lng: c.lng + dLng },
    { lat: c.lat + dLat, lng: c.lng - dLng },
  ];
}

const offset = (c: LatLng, nordM: number, estM: number): LatLng => ({
  lat: c.lat + nordM / 111_320,
  lng: c.lng + estM / (111_320 * Math.cos((c.lat * Math.PI) / 180)),
});

export interface DemoOptions {
  nom?: string;
  /** Centre du terrain ; les zones sont des carrés de 100 m disposés en grille 3 × 2. */
  centre?: LatLng;
  nbBalises?: number;
  prereglage?: string;
  graine?: number;
}

export interface DemoIds {
  partieId: string;
  zoneIds: string[];
  carteIds: string[];
  baliseIds: string[];
}

/** Partie de démonstration en brouillon : zones, catalogue de 30 cartes, balises réparties dans les zones. */
export async function seedDemoGame(db: DbOrTx, o: DemoOptions = {}): Promise<DemoIds> {
  const centre = o.centre ?? { lat: 48.8566, lng: 2.3522 };
  const preset = SYSTEM_PRESETS.find((p) => p.id === (o.prereglage ?? 'standard')) ?? SYSTEM_PRESETS[1]!;
  const partieId = newId();
  await db.insert(parties).values({
    id: partieId,
    nom: o.nom ?? 'Partie de démonstration',
    parametres: presetSettings(preset),
    graine: o.graine ?? 0,
    perimetre: square(centre, 400),
  });

  const zoneRows = DEMO_ZONES.map((z, i) => ({
    id: newId(),
    partieId,
    nom: z.nom,
    type: z.type,
    polygone: square(offset(centre, (Math.floor(i / 3) - 0.5) * 120, ((i % 3) - 1) * 120), 100),
  }));
  await db.insert(zones).values(zoneRows);

  const carteRows = DEMO_CATALOGUE.map((c, i) => ({ id: newId(), partieId, numero: i + 1, nom: c.nom, rang: c.rang }));
  await db.insert(cartes).values(carteRows);

  const nb = o.nbBalises ?? 20;
  const baliseRows = Array.from({ length: nb }, (_, i) => ({
    id: newBeaconId(),
    partieId,
    zoneId: zoneRows[i % zoneRows.length]!.id,
    libelle: `B${String(i + 1).padStart(2, '0')}`,
  }));
  if (baliseRows.length > 0) await db.insert(balises).values(baliseRows);

  return {
    partieId,
    zoneIds: zoneRows.map((z) => z.id),
    carteIds: carteRows.map((c) => c.id),
    baliseIds: baliseRows.map((b) => b.id),
  };
}
