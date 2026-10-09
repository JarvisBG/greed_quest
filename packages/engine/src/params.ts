// Paramètres dynamiques (RG-14). Aucune valeur métier ne doit être codée en dur ailleurs.

export const PARAM_KEYS = [
  'balisesActives',
  'stockBalise',
  'partRaresPct',
  'limiteSS',
  'limiteS',
  'limiteA',
  'limiteB',
  'limiteCD',
  'paquetsParVague',
  'pvBoss',
  'kBoucle',
  'dureePartieMin',
  'cartesDesignees',
] as const;
export type ParamKey = (typeof PARAM_KEYS)[number];

/** Données nécessaires aux formules auto. */
export interface ParamContext {
  /** Joueurs actifs, déjà lissé (RG-14.1). */
  J: number;
  /** Nombre de balises posées sur le terrain. */
  balisesPosees: number;
  /** Nombre de balises actives à cet instant (pour kBoucle). */
  balisesActivesCourantes: number;
}

/** RG-14.2 */
export type ParamSetting =
  | { mode: 'auto' }
  | { mode: 'verrouille'; value: number }
  | { mode: 'multiplicateur'; coef: number };

export type ParamSettings = Record<ParamKey, ParamSetting>;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Formules auto du tableau RG-14. */
export const AUTO_FORMULAS: Record<ParamKey, (c: ParamContext) => number> = {
  balisesActives: (c) => clamp(Math.ceil(c.J / 3), Math.min(5, c.balisesPosees), c.balisesPosees),
  stockBalise: (c) => clamp(Math.ceil(c.J / 2), 5, 30),
  // Décision 2026-10-09 : type de balise tiré à l'activation (hors document, valeur proposée).
  partRaresPct: () => 15,
  limiteSS: (c) => Math.max(1, Math.floor(c.J / 20)),
  limiteS: (c) => Math.max(2, Math.ceil(c.J / 10)),
  limiteA: (c) => Math.max(3, Math.ceil(c.J / 5)),
  limiteB: (c) => Math.max(4, Math.ceil(c.J / 3)),
  limiteCD: (c) => Math.max(5, Math.ceil(c.J / 2)),
  paquetsParVague: (c) => Math.ceil(c.J / 2),
  pvBoss: (c) => c.J * 10,
  kBoucle: (c) => (c.balisesActivesCourantes < 8 ? 2 : 3),
  dureePartieMin: () => 150,
  cartesDesignees: () => 30,
};

/** Modes par défaut (RG-14) : tout en auto sauf durée et N, verrouillés. */
export const DEFAULT_SETTINGS: ParamSettings = {
  ...(Object.fromEntries(PARAM_KEYS.map((k) => [k, { mode: 'auto' }])) as ParamSettings),
  dureePartieMin: { mode: 'verrouille', value: 150 },
  cartesDesignees: { mode: 'verrouille', value: 30 },
};

/** Ce que la console GM affiche pour un paramètre (RG-14.6). */
export interface ResolvedParam {
  key: ParamKey;
  J: number;
  auto: number;
  setting: ParamSetting;
  applied: number;
}

export function resolveParam(key: ParamKey, setting: ParamSetting, ctx: ParamContext): ResolvedParam {
  const auto = AUTO_FORMULAS[key](ctx);
  let applied: number;
  switch (setting.mode) {
    case 'auto':
      applied = auto;
      break;
    case 'verrouille':
      applied = setting.value;
      break;
    case 'multiplicateur':
      applied = Math.round(auto * setting.coef);
      break;
  }
  // On ne peut pas activer plus de balises qu'il n'en existe sur le terrain.
  if (key === 'balisesActives') applied = Math.min(applied, ctx.balisesPosees);
  return { key, J: ctx.J, auto, setting, applied: Math.max(0, applied) };
}

/** Toutes les valeurs appliquées, indexées par clé. */
export function resolveParams(settings: ParamSettings, ctx: ParamContext): Record<ParamKey, number> {
  return Object.fromEntries(PARAM_KEYS.map((k) => [k, resolveParam(k, settings[k], ctx).applied])) as Record<
    ParamKey,
    number
  >;
}

// --- RG-14.1 : lissage de J ---

export const J_RECALC_INTERVAL_MS = 2 * 60_000;
export const J_DECREASE_INTERVAL_MS = 10 * 60_000;

export interface JState {
  value: number;
  /** Heure (horloge de jeu, ms) de la dernière baisse appliquée. */
  lastDecreaseAt: number | null;
}

/**
 * RG-14.1 : une hausse s'applique tout de suite ; une baisse au plus une fois toutes les 10 min.
 * Interprétation de « un palier » : une baisse appliquée par fenêtre de 10 min (voir PROGRESS.md).
 */
export function smoothJ(prev: JState, measured: number, now: number): JState {
  if (measured >= prev.value) return { value: measured, lastDecreaseAt: prev.lastDecreaseAt };
  if (prev.lastDecreaseAt !== null && now - prev.lastDecreaseAt < J_DECREASE_INTERVAL_MS) return prev;
  return { value: measured, lastDecreaseAt: now };
}
