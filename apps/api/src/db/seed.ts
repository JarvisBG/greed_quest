// Données de départ : préréglages système (RG-14.5) et partie de démonstration
// (catalogue de 30 cartes de l'anime RG-8.1, zones, balises), en brouillon (RG-4.1).
import { carteDeBanque, type CarteBanque } from '@gq/shared';
import { SYSTEM_PRESETS, presetSettings, type LatLng, type Polygon } from '@gq/engine';
import { eq } from 'drizzle-orm';
import { Refus } from '../errors.js';
import { newBeaconId, newId, newSecret } from '../ids.js';
import type { DbOrTx } from './client.js';
import { balises, cartes, parties, prereglages, zones, type ZoneType } from './schema.js';

/**
 * Catalogue de démonstration : 30 cartes de la banque de l'anime (numéros de l'anime, RG-8.1 amendé),
 * réparties selon repartitionCatalogue(30) : 1 SS, 4 S, 5 A, 6 B, 7 C, 7 D. Listé par rang décroissant.
 */
const DEMO_NUMEROS = [0, 17, 99, 5, 81, 51, 94, 15, 12, 8, 46, 73, 82, 3, 10, 13, 21, 22, 79, 90, 14, 83, 95, 11, 25, 84, 23, 52, 76, 63];
export const DEMO_CATALOGUE: readonly CarteBanque[] = DEMO_NUMEROS.map((n) => {
  const c = carteDeBanque(n);
  if (!c) throw new Error(`Carte ${n} absente de la banque`);
  return c;
});

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

/** RG-4.1 : nouvelle partie en brouillon, paramètres pris dans un préréglage (RG-14.5). */
export async function createPartie(db: DbOrTx, o: { nom: string; prereglage?: string; graine?: number }): Promise<string> {
  const id = o.prereglage ?? 'standard';
  const [enBase] = await db.select().from(prereglages).where(eq(prereglages.id, id));
  const preset = enBase ?? SYSTEM_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Refus('prereglage_inconnu', 'Préréglage inconnu', 400);
  const partieId = newId();
  await db.insert(parties).values({ id: partieId, nom: o.nom, parametres: presetSettings(preset), graine: o.graine ?? 0 });
  return partieId;
}

/** Contenu de démonstration : zones, catalogue de 30 cartes, balises réparties dans les zones. */
export async function seedDemoContent(
  db: DbOrTx,
  partieId: string,
  o: Pick<DemoOptions, 'centre' | 'nbBalises'> = {},
): Promise<Omit<DemoIds, 'partieId'>> {
  const centre = o.centre ?? { lat: 48.8566, lng: 2.3522 };
  await db.update(parties).set({ perimetre: square(centre, 400) }).where(eq(parties.id, partieId));

  const zoneRows = DEMO_ZONES.map((z, i) => ({
    id: newId(),
    partieId,
    nom: z.nom,
    type: z.type,
    polygone: square(offset(centre, (Math.floor(i / 3) - 0.5) * 120, ((i % 3) - 1) * 120), 100),
    qr: z.type === 'sauvage' ? null : newSecret(12),
  }));
  await db.insert(zones).values(zoneRows);

  const carteRows = DEMO_CATALOGUE.map((c) => ({ id: newId(), partieId, numero: c.numero, nom: c.nom, rang: c.rang, texte: c.texte }));
  await db.insert(cartes).values(carteRows);

  const nb = o.nbBalises ?? 20;
  const baliseRows = Array.from({ length: nb }, (_, i) => ({
    id: newBeaconId(),
    partieId,
    zoneId: zoneRows[i % zoneRows.length]!.id,
    libelle: `B${String(i + 1).padStart(2, '0')}`,
  }));
  if (baliseRows.length > 0) await db.insert(balises).values(baliseRows);

  return { zoneIds: zoneRows.map((z) => z.id), carteIds: carteRows.map((c) => c.id), baliseIds: baliseRows.map((b) => b.id) };
}

/** Partie de démonstration complète, en brouillon. */
export async function seedDemoGame(db: DbOrTx, o: DemoOptions = {}): Promise<DemoIds> {
  const partieId = await createPartie(db, {
    nom: o.nom ?? 'Partie de démonstration',
    ...(o.prereglage ? { prereglage: o.prereglage } : {}),
    ...(o.graine !== undefined ? { graine: o.graine } : {}),
  });
  return { partieId, ...(await seedDemoContent(db, partieId, o)) };
}
