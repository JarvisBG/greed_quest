// Cartes de Maître du jeu (RG-8.15 à 8.21) côté joueur : ce que l'API envoie et ce que le jeu dit, en clair.
// « Jarvis tout-puissant » (Décret + Jugement) et « Le Sceau d'Ange ». Le serveur décide de tout (P1).
import { NOMS_CARTES_GM, type CarteGm, type Rank } from '@gq/shared';
import { enListe } from './boutique';

/** RG-8.19 : carte que le Décret peut faire apparaître ; `reprise` = à sa limite, elle sera prise à un détenteur. */
export interface CarteDecret {
  carteId: string;
  numero: number | null;
  nom: string;
  rang: Rank | null;
  texte: string | null;
  limite: number | null;
  reprise: boolean;
}

/** Réponse de POST /cartes-gm/jouer. */
export type ResultatGm =
  | { gm: 'jarvis'; carte: Omit<CarteDecret, 'reprise'>; reprisA: string | null; figes: string[]; intouchableMs: number }
  | { gm: 'ange'; cible: string; scelleMs: number };

/** Évènement `carte_gm_jouee` (à tous) : « Jarvis a parlé ». */
export interface EvGmJouee {
  gm: 'jarvis';
  lanceur: string;
  carte: string;
  figes: string[];
  reprisA: string | null;
}

/** Évènement `carte_gm_recue` (au joueur touché). */
export type EvGmRecue =
  | { gm: 'jarvis'; lanceur: string; figeMs: number }
  | { gm: 'jarvis'; lanceur: string; perdue: { nom: string } }
  | { gm: 'ange'; lanceur: string; scelleMs: number };

export const nomGm = (gm: CarteGm) => NOMS_CARTES_GM[gm].nom;

/** Ce que dit la fiche d'une carte de Maître du jeu (l'effet n'est pas écrit sur la carte, demande de Sivraj). */
export const EFFETS_GM: Record<CarteGm, string> = {
  jarvis: 'Décret : la carte désignée de ton choix apparaît dans ton Book, reprise à un joueur si elle est à sa limite. Jugement : les joueurs à portée sont figés 3 min et tu es intouchable 10 min. Rien ne l’arrête.',
  ange: 'Le Book d’un joueur à portée se scelle 5 min : ni scan, ni sort, ni échange, ni rangement. Le Mur défensif ne la bloque pas.',
};

const ilsSont = (noms: string[]) => (noms.length === 1 ? `${noms[0]} est figé` : `${enListe(noms)} sont figés`);

/** Boîte du jeu chez le lanceur, à la fin de la cinématique de Jarvis. */
export function texteJarvis(r: Extract<ResultatGm, { gm: 'jarvis' }>): string {
  const carte = `${r.carte.nom} apparaît dans ton Book${r.reprisA ? `, reprise à ${r.reprisA}` : ''}.`;
  const figes = r.figes.length ? `${ilsSont(r.figes)} 3 min.` : 'Personne n’était à portée.';
  return `Jarvis a parlé. ${carte} ${figes} Tu es intouchable 10 min.`;
}

/** Annonce à tous : un autre joueur a joué Jarvis tout-puissant. `moi` : mon pseudo (pour « tu es figé »). */
export function texteJarvisAutres(e: EvGmJouee, moi: string): string {
  const base = `${e.lanceur} a joué Jarvis tout-puissant.`;
  if (e.figes.includes(moi)) return `${base} Tu es figé 3 min : ni scan, ni sort, ni échange.`;
  if (e.reprisA === moi) return `${base} Le Décret te reprend ${e.carte}.`;
  return base;
}

export function texteGmRecue(e: EvGmRecue): string {
  if (e.gm === 'ange') return `${e.lanceur} a joué Le Sceau d’Ange : ton Book est scellé 5 min, ni scan, ni sort, ni échange, ni rangement.`;
  if ('perdue' in e) return `${e.lanceur} a joué Jarvis tout-puissant : le Décret te reprend ${e.perdue.nom}.`;
  return `${e.lanceur} a joué Jarvis tout-puissant : tu es figé 3 min, ni scan, ni sort, ni échange.`;
}

export const texteSceau = (cible: string) => `Le Book de ${cible} est scellé pendant 5 min.`;

/** RG-8.16 : une carte de Maître du jeu arrive dans le Book (scan, raid, enchère, don du GM). */
export function texteGmObtenue(gm: CarteGm, par: 'scan' | 'raid' | 'gm' | 'enchere'): string {
  const d = { scan: '', raid: ' Récompense du meilleur chasseur du raid.', gm: ' Cadeau du Game Master.', enchere: '' }[par];
  return `Tu obtiens ${nomGm(gm)}, une carte de Maître du jeu.${d} Elle t’attend à la fin de ton Book.`;
}

/** RG-8.17 : rendue au Maître du jeu (inactivité, abandon, disqualification). */
export const texteGmRendue = (gms: CarteGm[]) =>
  `${enListe(gms.map(nomGm))} ${gms.length > 1 ? 'reviennent' : 'revient'} au Maître du jeu.`;

/** Bandeaux : ms restantes de chaque état, d'après /moi lu à `recuA`. */
export function etatsGmRestants(m: { etatsGm: { fige: number; scelle: number; intouchable: number }; recuA: number }, maintenant: number) {
  const ecoule = Math.max(0, maintenant - m.recuA);
  return {
    fige: Math.max(0, m.etatsGm.fige - ecoule),
    scelle: Math.max(0, m.etatsGm.scelle - ecoule),
    intouchable: Math.max(0, m.etatsGm.intouchable - ecoule),
  };
}
