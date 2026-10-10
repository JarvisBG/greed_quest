// Vocabulaire du domaine partagé entre engine, api et fronts (docs/REGLES.md).

/** Rangs du plus élevé au plus bas (RG-8). */
export const RANKS = ['SS', 'S', 'A', 'B', 'C', 'D'] as const;
export type Rank = (typeof RANKS)[number];

/** Valeur d'un rang pour le classement (RG-13.5). */
export const RANK_POINTS: Record<Rank, number> = { SS: 6, S: 5, A: 4, B: 3, C: 2, D: 1 };

/** Compare deux rangs : > 0 si `a` est plus élevé que `b`. */
export function compareRanks(a: Rank, b: Rank): number {
  return RANK_POINTS[a] - RANK_POINTS[b];
}

/** RG-4 */
export const GAME_STATES = ['brouillon', 'inscriptions', 'en_cours', 'pause', 'phase_finale', 'terminee'] as const;
export type GameState = (typeof GAME_STATES)[number];

/** RG-5.7 */
export const PLAYER_STATUSES = ['actif', 'inactif', 'gele', 'disqualifie', 'abandon'] as const;
export type PlayerStatus = (typeof PLAYER_STATUSES)[number];

/** RG-5.4 */
export const NEN_TYPES = [
  'renforcement',
  'emission',
  'transformation',
  'materialisation',
  'manipulation',
  'specialisation',
] as const;
export type NenType = (typeof NEN_TYPES)[number];

/** RG-6 */
export const BEACON_TYPES = ['standard', 'rare', 'fantome'] as const;
export type BeaconType = (typeof BEACON_TYPES)[number];

export const BEACON_STATES = ['dormante', 'active', 'epuisee', 'coupee'] as const;
export type BeaconState = (typeof BEACON_STATES)[number];

/** RG-10 */
export const SPELL_TYPES = [
  'vol',
  'echange_force',
  'gel',
  'barriere',
  'radar',
  'revelation',
  'duplication',
  'analyse',
  /** Voyance (« Peek » de Greed Island, amendements 2026-10-09 et 2026-10-10) : les emplacements libres d'un joueur déjà rencontré. */
  'regard',
  /** Amendements 2026-10-10 (fidélité à l'anime) : Pickpocket (vol dans les emplacements libres), Clairvoyance (emplacements fixes d'un joueur rencontré), Accompagnement, Retour. */
  'pickpocket',
  'clairvoyance',
  'accompagnement',
  'retour',
] as const;
export type SpellType = (typeof SPELL_TYPES)[number];

/**
 * Amendement 2026-10-10 : cartes objets (hors collection). Pépite d'or, Ticket de la Fortune, Boussole du chercheur,
 * Second souffle, Voile d'ombre, Coffre scellé.
 */
export const OBJET_TYPES = ['pepite', 'ticket', 'boussole', 'souffle', 'voile', 'coffre'] as const;
export type ObjetType = (typeof OBJET_TYPES)[number];

/** Amendement 2026-10-10 : pouvoirs de Spécialisation (RG-5.4), un tiré au hasard pour chaque Spécialiste. */
export const POUVOIRS_SPE = ['alchimie', 'bandit', 'zetsu', 'fortune'] as const;
export type PouvoirSpe = (typeof POUVOIRS_SPE)[number];

/** Sorts offensifs soumis à immunité, délai et protections (RG-10.1 à 10.4) ; Accompagnement vise un joueur déjà croisé, sans portée. */
export const OFFENSIVE_SPELLS: readonly SpellType[] = ['vol', 'echange_force', 'gel', 'pickpocket', 'accompagnement'];

/** RG-8.3 : nature d'un gain. */
export type DrawKind = 'carte' | 'sort' | 'jenny';
