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
  'porteeSortsM',
  'margeGpsMaxM',
  'ciblableMin',
  'dureePartieMin',
  'cartesDesignees',
  'kitJenny',
  'bonusExamenJ',
  'specialisationPct',
  'rattrapageJParMin',
  'agendaIntervalleMin',
  'areneMiseJ',
  'areneDelaiMin',
  'objetsReplisPct',
  'coffreMin',
  'rechargeRenforcementMin',
  'rechargeEmissionMin',
  'rechargeManipulationMin',
  'reserveMaterialisationMin',
  'rechargeSpeMin',
  'zetsuMin',
  'retourMin',
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
  // Amendement 2026-10-09 : une seule SS, 1 exemplaire pour 10 joueurs, au moins 4 (document : max(1, floor(J/20))).
  limiteSS: (c) => Math.max(4, Math.ceil(c.J / 10)),
  limiteS: (c) => Math.max(2, Math.ceil(c.J / 10)),
  limiteA: (c) => Math.max(3, Math.ceil(c.J / 5)),
  limiteB: (c) => Math.max(4, Math.ceil(c.J / 3)),
  limiteCD: (c) => Math.max(5, Math.ceil(c.J / 2)),
  paquetsParVague: (c) => Math.ceil(c.J / 2),
  pvBoss: (c) => c.J * 10,
  kBoucle: (c) => (c.balisesActivesCourantes < 8 ? 2 : 3),
  // RG-10.11 : portée des sorts et plafond de la marge GPS, à adapter au lieu (parking, parc…).
  porteeSortsM: () => 30,
  margeGpsMaxM: () => 20,
  /** Amendement RG-10.10 : minutes pendant lesquelles un joueur sans nouvelle position reste ciblable ; au-delà, alerte à l'équipe. */
  ciblableMin: () => 10,
  // Amendement 2026-10-09 (Sivraj) : 120 min par défaut (150 dans le document).
  dureePartieMin: () => 120,
  cartesDesignees: () => 30,
  // RG-5.3 / 5.5 / 5.6 / 5.4 : montants non chiffrés dans le document, valeurs proposées (PROGRESS.md).
  kitJenny: () => 50,
  bonusExamenJ: () => 10,
  specialisationPct: () => 5,
  /** RG-5.6 : 0 = rattrapage désactivé. */
  // Amendement 2026-10-10 : plus de bonus de rattrapage par défaut (simulation : ≈ 0,3 carte seulement).
  rattrapageJParMin: () => 0,
  /** RG-12.3 : agenda automatique, une proposition d'événement au GM toutes les N min ; 0 = désactivé (défaut). */
  agendaIntervalleMin: () => 0,
  /** Arène de Soufrabi (amendement 2026-10-09) : mise d'entrée et délai entre deux tentatives d'un joueur. */
  areneMiseJ: () => 30,
  areneDelaiMin: () => 15,
  // Amendement 2026-10-10 : 1 repli « carte épuisée » sur 3 donne un objet en plus des jenny ; Coffre scellé 20 min.
  objetsReplisPct: () => 33,
  coffreMin: () => 20,
  // Amendement 2026-10-10 : pouvoirs de Nen rechargeables (document : une fois par partie) ; Matérialisation
  // reçoit en plus un tirage bonus de réserve toutes les 40 min.
  rechargeRenforcementMin: () => 30,
  rechargeEmissionMin: () => 40,
  rechargeManipulationMin: () => 40,
  reserveMaterialisationMin: () => 40,
  // Amendement 2026-10-10 : pouvoirs de Spécialisation, recharge 40 min ; Zetsu dure 10 min.
  rechargeSpeMin: () => 40,
  zetsuMin: () => 10,
  // Amendement 2026-10-10 : Retour ouvre une visite à distance de 10 min d'une ville déjà visitée.
  retourMin: () => 10,
};

/** Calibrage validé le 2026-10-09 (docs/SIMULATION.md) : limites d'exemplaires × 2 par défaut. */
export const LIMITES_PAR_DEFAUT: ParamSetting = { mode: 'multiplicateur', coef: 2 };

/**
 * Modes par défaut (RG-14) : tout en auto sauf durée et N, verrouillés.
 * Amendements RG-14 (calibrage) : limites d'exemplaires en Multiplicateur × 2 (SS : formule propre, en Auto) ; durée 120 min.
 */
export const DEFAULT_SETTINGS: ParamSettings = {
  ...(Object.fromEntries(PARAM_KEYS.map((k) => [k, { mode: 'auto' }])) as ParamSettings),
  limiteS: LIMITES_PAR_DEFAUT,
  limiteA: LIMITES_PAR_DEFAUT,
  limiteB: LIMITES_PAR_DEFAUT,
  limiteCD: LIMITES_PAR_DEFAUT,
  dureePartieMin: { mode: 'verrouille', value: 120 },
  porteeSortsM: { mode: 'verrouille', value: 30 },
  margeGpsMaxM: { mode: 'verrouille', value: 20 },
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
