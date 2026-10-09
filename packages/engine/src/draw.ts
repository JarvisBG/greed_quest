// Tirage sur une balise (RG-8.3), avec rendement décroissant (RG-7.2) et limites d'exemplaires (RG-8.2).
import { RANKS, SPELL_TYPES, compareRanks, type BeaconType, type DrawKind, type Rank, type SpellType } from '@gq/shared';
import { pick, weightedPick, type Rng } from './rng.js';

export interface DrawConfig {
  /** RG-8.3 : carte 82 %, sort 13 %, jenny 5 %. */
  nature: Record<BeaconType, Record<DrawKind, number>>;
  /** Poids des rangs par type de balise (RG-6, RG-8). Rang absent = jamais tiré. */
  rangs: Record<BeaconType, Partial<Record<Rank, number>>>;
  sorts: Record<SpellType, number>;
  /** Montant d'un gain en jenny (nature jenny ou repli quand tout est épuisé). */
  jenny: number;
}

/**
 * Valeurs par défaut. Le document ne fixe que la nature et les poids standard ;
 * les autres sont des propositions à valider (PROGRESS.md, « Ambiguïtés »).
 */
export const DEFAULT_DRAW_CONFIG: DrawConfig = {
  nature: {
    standard: { carte: 82, sort: 13, jenny: 5 },
    rare: { carte: 82, sort: 13, jenny: 5 },
    fantome: { carte: 100, sort: 0, jenny: 0 },
  },
  rangs: {
    // RG-6 : rangs D à A (le 1 % de S du tableau RG-8 est exclu).
    standard: { A: 4, B: 12, C: 25, D: 40 },
    // RG-6 : rangs C à S, « poids relevés » (non chiffrés dans le document).
    rare: { S: 15, A: 25, B: 30, C: 30 },
    // RG-6 : rangs S et SS.
    fantome: { SS: 50, S: 50 },
  },
  sorts: Object.fromEntries(SPELL_TYPES.map((s) => [s, 1])) as Record<SpellType, number>,
  jenny: 10,
};

export interface CatalogCard {
  id: string;
  rank: Rank;
  /** Exemplaires vrais en circulation (les contrefaçons ne comptent pas, RG-8.6). */
  enCirculation: number;
}

export interface DrawInput {
  beaconType: BeaconType;
  /** Tirages réussis déjà faits par ce joueur sur cette balise. */
  tiragesPrecedents: number;
  catalogue: readonly CatalogCard[];
  /** Limite d'exemplaires par rang (paramètres RG-14). */
  limites: Record<Rank, number>;
}

export type DrawResult =
  | { kind: 'carte'; cardId: string; rank: Rank }
  | { kind: 'sort'; spell: SpellType }
  | { kind: 'jenny'; amount: number; repli: boolean };

/** RG-7.2 : 2e tirage plafonné au rang B, 3e et suivants au rang D. */
export function rankCap(tiragesPrecedents: number): Rank | null {
  if (tiragesPrecedents <= 0) return null;
  return tiragesPrecedents === 1 ? 'B' : 'D';
}

/** RG-8.2 : une carte à sa limite sort de la table de tirage. */
export function isAvailable(card: CatalogCard, limites: Record<Rank, number>): boolean {
  return card.enCirculation < limites[card.rank];
}

export function draw(input: DrawInput, rng: Rng, config: DrawConfig = DEFAULT_DRAW_CONFIG): DrawResult {
  const nature = weightedPick(rng, Object.entries(config.nature[input.beaconType]) as [DrawKind, number][]);

  if (nature === 'sort') {
    const spell = weightedPick(rng, Object.entries(config.sorts) as [SpellType, number][]);
    if (spell) return { kind: 'sort', spell };
  }
  if (nature !== 'carte') return { kind: 'jenny', amount: config.jenny, repli: false };

  let rank = weightedPick(rng, Object.entries(config.rangs[input.beaconType]) as [Rank, number][]);
  if (!rank) return { kind: 'jenny', amount: config.jenny, repli: true };

  // RG-7.2 : un rang au-dessus du plafond est ramené au plafond.
  const cap = rankCap(input.tiragesPrecedents);
  if (cap && compareRanks(rank, cap) > 0) rank = cap;

  // RG-8.3 : rang épuisé → rang inférieur ; tout épuisé → jenny.
  for (const r of RANKS.slice(RANKS.indexOf(rank))) {
    const dispo = input.catalogue.filter((c) => c.rank === r && isAvailable(c, input.limites));
    if (dispo.length > 0) {
      const card = pick(rng, dispo);
      return { kind: 'carte', cardId: card.id, rank: card.rank };
    }
  }
  return { kind: 'jenny', amount: config.jenny, repli: true };
}
