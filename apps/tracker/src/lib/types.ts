// Ce que l'écran géant reçoit de l'API : `GET /parties/:id/ecran` à l'ouverture, puis la room tracker
// (apps/api/src/core/ecran.ts, apps/api/src/realtime.ts). Public, lecture seule ; jamais de position exacte (RG-10.12).
import type { CarteGm, Rank } from '@gq/shared';

export type EtatPartie = 'brouillon' | 'inscriptions' | 'en_cours' | 'phase_finale' | 'pause' | 'terminee';

export interface Point {
  lat: number;
  lng: number;
}

export interface ZoneEcran {
  id: string;
  nom: string;
  type: 'masadora' | 'antokiba' | 'soufrabi' | 'sauvage';
  polygone: Point[];
}

export interface LigneClassement {
  place: number;
  pseudo: string;
  cartes: number;
  points: number;
}

export interface EvenementEcran {
  id: string;
  type: 'apparition' | 'double_gain' | 'zone_maudite' | 'raid' | 'krach' | 'carte_maudite' | 'mission_secrete';
  zoneId: string | null;
  texte: string | null;
  fin: number;
  resteMs: number;
  pv?: number;
  pvMax?: number;
}

export interface CarteVitrine {
  numero: number;
  nom: string;
  rang: Rank;
  limite: number;
  texte: string | null;
}

/** Entrées du fil (voix du jeu), telles que l'API les pousse et les garde. */
export type EntreeFil =
  | { type: 'tirage'; pseudo: string; carte: string; rang: Rank; numero?: number | null; limite?: number | null; texte?: string | null; heureJeu: number }
  | { type: 'arene'; pseudo: string; carte: string; rang: Rank; numero?: number | null; limite?: number | null; texte?: string | null; heureJeu: number }
  | { type: 'sort'; lanceur: string | null; cible: string | null; sort: string; resultat: string; heureJeu: number }
  | { type: 'echange'; joueurs: [string, string]; heureJeu: number }
  | { type: 'carte_gm'; gm: 'jarvis'; lanceur: string; carte: string; figes: string[]; reprisA: string | null; heureJeu: number }
  | { type: 'carte_gm'; gm: 'ange'; lanceur: string; cible: string; heureJeu: number }
  | { type: 'carte_gm'; gm: CarteGm; pseudo: string; heureJeu: number }
  | { type: 'carte_gm_obtenue'; gm: CarteGm; pseudo: string; heureJeu: number }
  /** Fin de raid : ajoutée par l'écran lui-même (pas gardée par l'API). */
  | { type: 'raid'; reussi: boolean; frappeurs: number; heureJeu: number };

export interface EtatEcran {
  partie: { id: string; nom: string; etat: EtatPartie; heureJeu: number; restantMs: number; zones: ZoneEcran[] };
  classement: LigneClassement[];
  classementFinal: boolean;
  heatmap: Point[];
  balisesParZone: Record<string, number>;
  halos: Point[];
  balisesRevelees: Point[];
  nCartes: number;
  vitrine: CarteVitrine[];
  arrivants: string[];
  evenements: EvenementEcran[];
  fil: EntreeFil[];
  clear: { pseudo: string } | null;
}

/** Barre de vie du raid (évènement `raid`). */
export interface BarreRaid {
  id: string;
  pv: number;
  pvMax: number;
  par: { id: string; pseudo: string } | null;
  frappeurs: number;
  resteMs: number;
}
