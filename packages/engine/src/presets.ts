// Préréglages de paramètres (RG-14.5) : Petit groupe, Standard, Grande foule, + ceux enregistrés par le GM.
// Un préréglage ne liste que ce qu'il change : le reste reprend les réglages par défaut (DEFAULT_SETTINGS).
import { DEFAULT_SETTINGS, PARAM_KEYS, type ParamKey, type ParamSetting, type ParamSettings } from './params.js';

export interface Preset {
  id: string;
  nom: string;
  description: string;
  /** Préréglage fourni avec le jeu (non modifiable) ou enregistré par un GM. */
  systeme: boolean;
  reglages: Partial<Record<ParamKey, ParamSetting>>;
}

/**
 * RG-14.5 : le document nomme les trois préréglages sans en donner le contenu.
 * Valeurs proposées (PROGRESS.md, « Ambiguïtés ») ; les formules auto s'adaptent déjà à J,
 * les préréglages ne règlent donc que ce que J ne capte pas : la taille du lieu et la rareté.
 */
export const SYSTEM_PRESETS: readonly Preset[] = [
  {
    id: 'petit_groupe',
    nom: 'Petit groupe',
    description: 'Moins de 15 joueurs sur un petit lieu : portée réduite, marge GPS 10 m.',
    systeme: true,
    reglages: {
      porteeSortsM: { mode: 'verrouille', value: 20 },
      margeGpsMaxM: { mode: 'verrouille', value: 10 },
    },
  },
  {
    id: 'standard',
    nom: 'Standard',
    description: 'Réglages par défaut : formules du document, limites d’exemplaires × 2 (SS : 1 pour 10 joueurs, au moins 4), durée 120 min, portée 30 m.',
    systeme: true,
    reglages: {},
  },
  {
    id: 'grande_foule',
    nom: 'Grande foule',
    description: 'Plus de 50 joueurs : portée réduite (foule dense), marge GPS 15 m.',
    systeme: true,
    reglages: {
      porteeSortsM: { mode: 'verrouille', value: 20 },
      margeGpsMaxM: { mode: 'verrouille', value: 15 },
    },
  },
];

/** RG-14.5 : réglages complets d'un préréglage (les clés absentes reprennent les valeurs par défaut). */
export function presetSettings(preset: Pick<Preset, 'reglages'>): ParamSettings {
  return { ...DEFAULT_SETTINGS, ...preset.reglages };
}

/** RG-14.5 : enregistre les réglages courants comme nouveau préréglage (seules les différences sont gardées). */
export function presetFromSettings(id: string, nom: string, description: string, settings: ParamSettings): Preset {
  const reglages: Partial<Record<ParamKey, ParamSetting>> = {};
  for (const k of PARAM_KEYS) {
    if (JSON.stringify(settings[k]) !== JSON.stringify(DEFAULT_SETTINGS[k])) reglages[k] = settings[k];
  }
  return { id, nom, description, systeme: false, reglages };
}
