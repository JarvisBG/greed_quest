// Page ⑯ (prototype validé le 2026-10-13 : docs/prototype/raid.html) : le raid lu côté joueur (RG-12).
// Le serveur tient les PV et les réponses ; l'app suit la barre de vie en direct (évènement `raid`), garde ses
// réponses (reprise : GET /raid) et prépare l'issue (victoire avec le paquet de 3 sorts, ou fuite).
import type { SpellType } from '@gq/shared';
import type { Question } from './quiz';

/** Rendu du boss : le dessin du boss de base, une image détourée (dans l'arène) ou une affiche « AVIS DE RECHERCHE ». */
export type RenduBoss = 'dessin' | 'detoure' | 'affiche';

/**
 * Un boss de la bibliothèque (choix de Sivraj du 2026-10-13) : nom, image, répliques ; PV, durée et paquet suivent
 * les règles communes. Seul le boss de base existe pour l'instant ; les méchants de l'anime viendront avec leurs images.
 */
export interface Boss {
  id: string;
  nom: string;
  /** Sujet des phrases (« La Brigade est tombée »). */
  sujet: string;
  feminin: boolean;
  rendu: RenduBoss;
  image?: string;
  /** Titre du combat, du bandeau, seconde ligne du cri de l'alarme, cri de la victoire. */
  titre: string;
  bandeau: string;
  cri: string;
  vaincu: [string, string];
  /** Phrase d'arrivée (boîte de l'alarme), ricanements (mauvaise réponse), phrase de fuite. */
  entree: string;
  ricane: string[];
  fuite: string | null;
}

export const BOSS_BASE: Boss = {
  id: 'brigade',
  nom: 'Le chef de la Brigade',
  sujet: 'La Brigade',
  feminin: true,
  rendu: 'dessin',
  titre: 'RAID DE LA BRIGADE',
  bandeau: 'Raid de la Brigade',
  cri: 'DE LA BRIGADE !',
  vaincu: ['BRIGADE', 'VAINCUE !'],
  entree: 'Le chef de la Brigade débarque sur l’île',
  ricane: ['Hé hé hé !', 'Raté, gamin !', 'C’est tout ?'],
  fuite: null,
};

const BIBLIOTHEQUE: Record<string, Boss> = { [BOSS_BASE.id]: BOSS_BASE };
export const bossDe = (id?: string | null): Boss => (id && BIBLIOTHEQUE[id]) || BOSS_BASE;

/** « tombé » → « tombée » pour un boss au féminin. */
export const accord = (b: Boss, mot: string) => mot + (b.feminin ? 'e' : '');

/** Raid en cours tel que le joueur le voit (GET /raid, puis évènements `raid`). */
export interface VueRaid {
  id: string;
  bossId?: string | null;
  pv: number;
  pvMax: number;
  resteMs: number;
  frappeurs: number;
  /** Mes réponses : question → juste ou non. */
  reponses: Record<string, boolean>;
  recuA: number;
}

/** Évènement `raid` : un coup est tombé (barre de vie, qui a frappé). */
export interface EvRaid {
  id: string;
  pv: number;
  pvMax: number;
  par: { id: string; pseudo: string } | null;
  frappeurs: number;
  resteMs: number;
}

export type IssueRaid =
  | { type: 'victoire'; id: string; boss: Boss; coups: number; coupFinal: boolean; sorts: SpellType[] }
  | { type: 'fuite'; id: string; boss: Boss; pv: number };

/** Applique un coup reçu en direct. Un autre raid (ou aucun connu) : la vue repart de l'évènement, réponses à relire. */
export function fusionnerCoup(vue: VueRaid | null, ev: EvRaid, maintenant: number): VueRaid {
  const meme = vue?.id === ev.id;
  return {
    id: ev.id,
    bossId: meme ? (vue.bossId ?? null) : null,
    pv: meme ? Math.min(vue.pv, ev.pv) : ev.pv,
    pvMax: ev.pvMax,
    resteMs: ev.resteMs,
    frappeurs: Math.max(meme ? vue.frappeurs : 0, ev.frappeurs),
    reponses: meme ? vue.reponses : {},
    recuA: maintenant,
  };
}

export const tempsRestant = (v: VueRaid, maintenant: number) => Math.max(0, v.resteMs - (maintenant - v.recuA));
export const enCombat = (v: VueRaid | null, maintenant: number): boolean => !!v && v.pv > 0 && tempsRestant(v, maintenant) > 0;
export const coupsDe = (reponses: Record<string, boolean>) => Object.values(reponses).filter(Boolean).length;
/** La prochaine question sans réponse, dans l'ordre de la liste. */
export const questionSuivante = (questions: Question[], reponses: Record<string, boolean>) => questions.find((q) => !(q.id in reponses)) ?? null;

export function mmss(ms: number): string {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const texteEquipe = (n: number) => (n ? `${n} joueur${n > 1 ? 's ont' : ' a'} frappé` : 'Personne n’a encore frappé');
const pluriel = (n: number, mot: string) => mot + (n > 1 ? 's' : '');
export const texteCoups = (n: number) => `${pluriel(n, 'coup')} ${pluriel(n, 'porté')}`;

/** La Brigade → « la Brigade », en milieu de phrase. */
const minuscule = (sujet: string) => sujet.replace(/^L(a|e|es) /, (m) => m.toLowerCase());

export function texteFuite(b: Boss, pv: number): string {
  return `${b.fuite ? `${b.fuite} ` : ''}Le temps est écoulé : ${minuscule(b.sujet)} s’est ${accord(b, 'enfui')} avec ${pv} PV. Pas de récompense cette fois.`;
}

export function texteVictoireSansCoup(b: Boss): string {
  return `${b.sujet} est ${accord(b, 'tombé')} sans toi : pas de coup porté, pas de paquet cette fois.`;
}

/** Notification de fin de raid (fil de l'accueil) ; null pour un autre évènement. */
export function texteFinRaid(data: unknown): string | null {
  const d = data as { type?: string; reussi?: boolean; annule?: boolean } | null;
  if (d?.type !== 'raid') return null;
  return d.annule ? 'Raid annulé par le Game Master' : d.reussi ? 'Raid : le boss est vaincu !' : 'Raid : le boss s’est enfui';
}
