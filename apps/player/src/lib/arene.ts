// Page ⑮ (prototype validé le 2026-10-12 : docs/prototype/arene.html) : l'arène de Soufrabi côté joueur.
// Amendement 2026-10-09 : le PNJ scanne la licence, prélève la mise (30 J), arbitre ; victoire = une carte
// A / S / SS (50 / 40 / 10 %), défaite = mise perdue ; une tentative toutes les 15 min, comptées depuis l'entrée.
// L'app ne fait que lire (GET /arene/moi) et recevoir l'évènement `arene` : le serveur fait foi (P1).
import type { ObjetType, Rank } from '@gq/shared';
import { OBJETS } from './format';
import { enPhrase } from './sorts';

/** GET /arene/moi */
export interface EtatArene {
  mise: number;
  delaiMin: number;
  chances: Partial<Record<Rank, number>>;
  enCours: { id: string; mise: number; depuisMs: number } | null;
  prochaineDansMs: number;
  dernier: { etat: 'gagnee' | 'perdue'; ilYaMs: number; rang: Rank | null; nom: string | null } | null;
}

/** Carte gagnée, décrite comme dans le Book. */
export interface CarteGagnee {
  kind: 'carte';
  numero: number | null;
  nom: string;
  rang: Rank;
  texte: string | null;
  limite: number | null;
}
/** Tout épuisé : repli en jenny (RG-8.3), parfois avec un objet (amendement 2026-10-10). */
export interface JennyGagnes {
  kind: 'jenny';
  montant: number;
  objet?: ObjetType;
}

/** Évènement `arene` reçu par le joueur. */
export type EvArene =
  | { id: string; etat: 'en_cours'; mise: number }
  | { id: string; etat: 'gagnee'; gain: CarteGagnee | JennyGagnes; prochaineDansMs?: number }
  | { id: string; etat: 'perdue'; mise: number; prochaineDansMs?: number }
  | { id: string; etat: 'annulee'; mise: number; motif: string };

/** Issue à jouer en cinématique (victoire) ou en court moment (défaite). */
export type IssueArene = Extract<EvArene, { etat: 'gagnee' | 'perdue' }> & { recuA: number };

/** Où en est le joueur devant l'affiche. */
export type Statut = 'combat' | 'attente' | 'pauvre' | 'pret';

export function statutArene(e: EtatArene, jenny: number, ecouleMs: number): Statut {
  if (e.enCours) return 'combat';
  if (e.prochaineDansMs - ecouleMs > 0) return 'attente';
  if (jenny < e.mise) return 'pauvre';
  return 'pret';
}

/** « 4:05 » (minutes:secondes), jamais négatif. */
export const minSecArene = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const texteEntree = (mise: number) => `Le PNJ a pris ta mise de ${mise} J. Que le combat commence !`;
export const texteAnnulee = (mise: number, motif: string) => `Le PNJ a annulé ton entrée (${motif}). Ta mise de ${mise} J t’est rendue.`;

export function texteVictoire(g: CarteGagnee | JennyGagnes): string {
  if (g.kind === 'carte') return `Victoire ! L’arène te remet ${enPhrase(g.nom)}, une carte ${g.rang}.`;
  const objet = g.objet ? ` et ${OBJETS[g.objet].nom}` : '';
  return `Victoire ! L’arène n’a plus de carte A, S ou SS : elle te remet ${g.montant} J${objet}.`;
}

export function texteDernier(d: EtatArene['dernier']): string | null {
  if (!d) return null;
  if (d.etat === 'perdue') return 'défaite';
  return d.rang ? `victoire, une carte ${d.rang}` : 'victoire';
}

/** Les trois sceaux de la cinématique, et celui sur lequel la lumière s'arrête. */
export const RANGS_ARENE: Rank[] = ['A', 'S', 'SS'];
/** Nombre de pas de la lumière : deux tours et demi, puis le rang gagné. */
export const pasDeLumiere = (rang: Rank) => 9 + Math.max(0, RANGS_ARENE.indexOf(rang));
