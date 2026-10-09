// Cycle de vie des balises (RG-6.2 à RG-6.4). Fonctions pures : elles renvoient
// les nouvelles balises et la liste des changements (journal, diffusion).
import type { BeaconState, BeaconType } from '@gq/shared';
import { pick, randomInt, type Rng } from './rng.js';

export const RECHARGE_MS = 15 * 60_000; // RG-6.3
export const ROTATION_INTERVAL_MS = 20 * 60_000; // RG-6.4
export const ROTATION_SHARE = 0.3; // RG-6.4

export interface Beacon {
  id: string;
  zoneId: string;
  /**
   * Type tiré par le serveur à chaque activation (standard ou rare), ou fantôme pendant
   * une Apparition. null quand la balise n'est pas active. Les QR imprimés sont tous identiques.
   */
  type: BeaconType | null;
  state: BeaconState;
  stock: number;
  /** Heure de passage à « épuisée », pour la recharge. */
  epuiseeA: number | null;
}

export interface BeaconChange {
  beaconId: string;
  zoneId: string;
  from: BeaconState;
  to: BeaconState;
  cause: 'tirage' | 'recharge' | 'remplacement' | 'cible' | 'rotation';
  type?: BeaconType;
  stock?: number;
}

export interface BeaconUpdate {
  beacons: Beacon[];
  changes: BeaconChange[];
}

/** Une balise en mode fantôme (Apparition, RG-12) échappe à la rotation et à la cible. */
const isRotating = (b: Beacon) => b.type !== 'fantome';

/** Type tiré à l'activation (décision 2026-10-09) : rare avec la probabilité partRaresPct. */
export function rollBeaconType(partRaresPct: number, rng: Rng): BeaconType {
  return rng.next() * 100 < partRaresPct ? 'rare' : 'standard';
}

/** RG-6.2 et tableau RG-6 : stock à l'activation. Rare = moitié du normal ; fantôme = 1 ou 2. */
export function initialStock(type: BeaconType, stockBalise: number, rng: Rng): number {
  if (type === 'rare') return Math.max(1, Math.ceil(stockBalise / 2));
  if (type === 'fantome') return 1 + randomInt(rng, 2);
  return stockBalise;
}

export interface ActivationOptions {
  /** Nombre de balises à activer. */
  count: number;
  /** Paramètre stockBalise (RG-14). */
  stockBalise: number;
  /** Paramètre partRaresPct (RG-14) : part des activations en balise rare. */
  partRaresPct: number;
  /** Visites récentes par zone : les zones les moins visitées passent en premier (RG-6.4). */
  visitesParZone: ReadonlyMap<string, number>;
  /** Zones à éviter (RG-6.3 : remplacer dans une autre zone). */
  zonesExclues?: ReadonlySet<string>;
  /** Balises à ne pas réactiver tout de suite (celles qu'on vient de retirer). */
  balisesExclues?: ReadonlySet<string>;
  cause: BeaconChange['cause'];
}

/**
 * Active des balises dormantes, une par une, en choisissant à chaque fois la zone la moins visitée
 * (visites + balises déjà activées par cet appel), puis une balise au hasard dans cette zone.
 * Si les zones exclues ne laissent aucun candidat, elles redeviennent éligibles.
 */
export function activateBeacons(beacons: readonly Beacon[], opts: ActivationOptions, rng: Rng): BeaconUpdate {
  const next = beacons.map((b) => ({ ...b }));
  const changes: BeaconChange[] = [];
  const charge = new Map(opts.visitesParZone);

  const eligible = (b: Beacon) => isRotating(b) && b.state === 'dormante' && !opts.balisesExclues?.has(b.id);

  for (let n = 0; n < opts.count; n++) {
    let candidates = next.filter((b) => eligible(b) && !opts.zonesExclues?.has(b.zoneId));
    if (candidates.length === 0) candidates = next.filter(eligible);
    if (candidates.length === 0) break;

    const minCharge = Math.min(...candidates.map((b) => charge.get(b.zoneId) ?? 0));
    const zones = [...new Set(candidates.filter((b) => (charge.get(b.zoneId) ?? 0) === minCharge).map((b) => b.zoneId))];
    const zone = pick(rng, zones);
    const beacon = pick(rng, candidates.filter((b) => b.zoneId === zone));

    beacon.state = 'active';
    beacon.type = rollBeaconType(opts.partRaresPct, rng);
    beacon.stock = initialStock(beacon.type, opts.stockBalise, rng);
    beacon.epuiseeA = null;
    charge.set(zone, minCharge + 1);
    changes.push({
      beaconId: beacon.id,
      zoneId: zone,
      from: 'dormante',
      to: 'active',
      cause: opts.cause,
      type: beacon.type,
      stock: beacon.stock,
    });
  }
  return { beacons: next, changes };
}

export const countActive = (beacons: readonly Beacon[]) => beacons.filter((b) => isRotating(b) && b.state === 'active').length;

/** RG-6.2 / RG-6.3 : un tirage réussi décrémente le stock ; à 0, la balise est épuisée. */
export function consumeDraw(beacon: Beacon, now: number): { beacon: Beacon; change?: BeaconChange } {
  if (beacon.state !== 'active' || beacon.stock <= 0) throw new Error(`Balise ${beacon.id} non tirable`);
  const stock = beacon.stock - 1;
  if (stock > 0) return { beacon: { ...beacon, stock } };
  return {
    beacon: { ...beacon, stock: 0, state: 'epuisee', epuiseeA: now },
    change: { beaconId: beacon.id, zoneId: beacon.zoneId, from: 'active', to: 'epuisee', cause: 'tirage', stock: 0 },
  };
}

/** RG-6.3 : une balise épuisée redevient dormante après le délai de recharge. */
export function rechargeBeacons(beacons: readonly Beacon[], now: number, rechargeMs = RECHARGE_MS): BeaconUpdate {
  const changes: BeaconChange[] = [];
  const next = beacons.map((b) => {
    if (b.state !== 'epuisee' || b.epuiseeA === null || now - b.epuiseeA < rechargeMs) return b;
    changes.push({ beaconId: b.id, zoneId: b.zoneId, from: 'epuisee', to: 'dormante', cause: 'recharge' });
    return { ...b, state: 'dormante' as const, type: null, epuiseeA: null };
  });
  return { beacons: next, changes };
}

/**
 * RG-6.3 : remplace une balise épuisée par une dormante d'une autre zone,
 * sans dépasser la cible (paramètre balisesActives).
 */
export function replaceExhausted(
  beacons: readonly Beacon[],
  epuisee: Beacon,
  cible: number,
  opts: Omit<ActivationOptions, 'count' | 'zonesExclues' | 'cause'>,
  rng: Rng,
): BeaconUpdate {
  const manque = cible - countActive(beacons);
  if (manque <= 0) return { beacons: [...beacons], changes: [] };
  return activateBeacons(beacons, { ...opts, count: 1, zonesExclues: new Set([epuisee.zoneId]), cause: 'remplacement' }, rng);
}

/**
 * Complète jusqu'à la cible (démarrage, hausse de J). Une baisse de la cible ne coupe
 * aucune balise active : elle s'applique aux prochaines activations (RG-14.3).
 */
export function fillToTarget(
  beacons: readonly Beacon[],
  cible: number,
  opts: Omit<ActivationOptions, 'count' | 'cause'>,
  rng: Rng,
): BeaconUpdate {
  const manque = cible - countActive(beacons);
  if (manque <= 0) return { beacons: [...beacons], changes: [] };
  return activateBeacons(beacons, { ...opts, count: manque, cause: 'cible' }, rng);
}

/**
 * RG-6.4 : remplace 30 % des balises actives (au moins une), même non épuisées.
 * Les balises retirées sont choisies au hasard et redeviennent dormantes ; les remplaçantes
 * viennent des zones les moins visitées. On active jusqu'à la cible courante.
 */
export function rotate(
  beacons: readonly Beacon[],
  cible: number,
  opts: Omit<ActivationOptions, 'count' | 'cause' | 'balisesExclues'>,
  rng: Rng,
): BeaconUpdate {
  const actives = beacons.filter((b) => isRotating(b) && b.state === 'active');
  if (actives.length === 0) return fillToTarget(beacons, cible, opts, rng);

  const nbRetrait = Math.max(1, Math.round(actives.length * ROTATION_SHARE));
  const pool = [...actives];
  const retirees = new Set<string>();
  for (let i = 0; i < nbRetrait && pool.length > 0; i++) {
    retirees.add(pool.splice(randomInt(rng, pool.length), 1)[0]!.id);
  }

  const changes: BeaconChange[] = [];
  const apresRetrait = beacons.map((b) => {
    if (!retirees.has(b.id)) return b;
    changes.push({ beaconId: b.id, zoneId: b.zoneId, from: 'active', to: 'dormante', cause: 'rotation' });
    return { ...b, state: 'dormante' as const, type: null, stock: 0 };
  });

  const manque = cible - countActive(apresRetrait);
  const activation = activateBeacons(
    apresRetrait,
    { ...opts, count: Math.max(0, manque), balisesExclues: retirees, cause: 'rotation' },
    rng,
  );
  return { beacons: activation.beacons, changes: [...changes, ...activation.changes] };
}
