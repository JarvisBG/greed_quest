// RG-5.4 (amendements 2026-10-10) : état du pouvoir de Nen à afficher sur l'accueil, d'après `/moi`.
// Chaque type a son délai : `pouvoir` (Renforcement, Émission, Manipulation), `transformation` (Texture Surprise),
// `reserve` (tirage bonus de Matérialisation, donné tout seul), `specialisation` (+ Zetsu actif, Fortune armée).
import { RANKS, type NenType, type PouvoirSpe, type Rank } from '@gq/shared';
import { NENS, POUVOIRS_SPE } from './format';
import type { LivreRecu } from './livre';
import { enPhrase, type ReponseSort } from './sorts';
import type { Moi } from './useJeu';

export interface EtatPouvoir {
  nom: string;
  effet: string;
  /** `pret` : utilisable ; `recharge` : attendre `resteMs` ; `actif` : en cours (Zetsu, Fortune) ; `auto` : arrive tout seul. */
  etat: 'pret' | 'recharge' | 'actif' | 'auto';
  resteMs: number;
  /** Phrase d'état, sans le temps (affiché à part). */
  libelle: string;
}

type MoiPouvoir = Pick<Moi, 'nen' | 'pouvoirSpe' | 'delais' | 'specialisation'>;

/** `ecoule` : temps écoulé depuis la réception de `/moi` (les délais sont donnés à cet instant). */
export function etatPouvoir(moi: MoiPouvoir, ecoule: number): EtatPouvoir | null {
  if (!moi.nen) return null;
  const reste = (ms: number | null) => Math.max(0, (ms ?? 0) - ecoule);
  const n = NENS[moi.nen];
  const recharge = (ms: number | null, pret: string): Pick<EtatPouvoir, 'etat' | 'resteMs' | 'libelle'> =>
    reste(ms) > 0 ? { etat: 'recharge', resteMs: reste(ms), libelle: 'Se recharge' } : { etat: 'pret', resteMs: 0, libelle: pret };

  switch (moi.nen) {
    case 'renforcement':
      return { nom: n.nom, effet: n.passif, ...recharge(moi.delais.pouvoir, 'Prêt : il annulera le prochain sort offensif reçu') };
    case 'emission':
    case 'manipulation':
      return { nom: n.nom, effet: n.passif, ...recharge(moi.delais.pouvoir, 'Prêt, dans l’écran des sorts') };
    case 'transformation':
      return { nom: n.nom, effet: n.passif, ...recharge(moi.delais.transformation, 'Texture Surprise prête, dans l’écran des sorts') };
    case 'materialisation':
      return { nom: n.nom, effet: n.passif, etat: 'auto', resteMs: reste(moi.delais.reserve), libelle: 'Prochain tirage bonus' };
    case 'specialisation': {
      if (!moi.pouvoirSpe) return { nom: n.nom, effet: n.passif, etat: 'pret', resteMs: 0, libelle: 'Réponds à la question de Wing' };
      const spe = POUVOIRS_SPE[moi.pouvoirSpe];
      if (moi.pouvoirSpe === 'zetsu' && reste(moi.specialisation.zetsu) > 0)
        return { nom: spe.nom, effet: spe.effet, etat: 'actif', resteMs: reste(moi.specialisation.zetsu), libelle: 'Zetsu : tu es invisible' };
      if (moi.pouvoirSpe === 'fortune' && moi.specialisation.fortuneArmee)
        return { nom: spe.nom, effet: spe.effet, etat: 'actif', resteMs: 0, libelle: 'Armée : ton prochain scan donne un gain de plus' };
      return { nom: spe.nom, effet: spe.effet, ...recharge(moi.delais.specialisation, 'Prêt, dans l’écran des sorts') };
    }
  }
}

// ---------- Page ⑩ : la case du Nen, les choix des pouvoirs et leurs phrases ----------
// Prototype validé par Sivraj le 2026-10-12 : docs/prototype/pouvoirs-nen.html.

/** Le pouvoir que la case montre : celui du type, ou le pouvoir secret du Spécialiste. */
export type ClePouvoir = Exclude<NenType, 'specialisation'> | PouvoirSpe;

/** Textes de la case du Nen. Sans `agir`, le pouvoir agit seul (Renforcement, Matérialisation). */
export const CASES: Record<ClePouvoir, { nom: string; effet: string; agir?: string; tampon?: 'PASSIF' | 'AUTO' }> = {
  renforcement: { nom: 'Renforcement', effet: 'Annule le prochain sort offensif lancé sur toi.', tampon: 'PASSIF' },
  emission: { nom: 'Émission', effet: 'Lance un sort offensif sur un joueur hors de portée.', agir: 'Choisir le sort offensif' },
  transformation: { nom: 'Texture Surprise', effet: 'Déguise un doublon en une autre carte de même rang. Pour les autres, c’est une vraie carte.', agir: 'Déguiser un doublon' },
  materialisation: { nom: 'Matérialisation', effet: 'Un tirage bonus, rang C au plus, à chaque checkpoint réussi, et un autre quand la jauge est pleine.', tampon: 'AUTO' },
  manipulation: { nom: 'Échange forcé', effet: 'Donne une carte choisie à un joueur proche et lui en prend une au hasard, sans carte de sort.', agir: 'Forcer un échange' },
  alchimie: { nom: 'Alchimie', effet: 'Change un doublon en la carte de ton choix, du même rang ou du rang au-dessus, jamais la SS.', agir: 'Transmuter un doublon' },
  bandit: { nom: 'L’épée du vol', effet: 'Un Vol sans carte de sort : tu nommes la carte visée, sans voir son Book. Jamais la SS.', agir: 'Tirer l’épée' },
  zetsu: { nom: 'Zetsu', effet: 'Invisible : personne ne peut te viser, te voir dans les listes ni te proposer un échange.', agir: 'Disparaître' },
  fortune: { nom: 'Fortune', effet: 'Ton prochain scan réussi donne un gain de plus.', agir: 'Armer mon prochain scan' },
};

/** Pouvoirs soumis au délai entre deux sorts offensifs (RG-10.3) : ils lancent un Vol ou un Échange. */
export const POUVOIRS_OFFENSIFS: readonly ClePouvoir[] = ['emission', 'manipulation', 'bandit'];
/** Pouvoirs qui passent par la fiche en deux temps. */
export const AVEC_FICHE: readonly ClePouvoir[] = ['transformation', 'alchimie', 'bandit', 'manipulation'];

export interface CasePouvoir extends EtatPouvoir {
  cle: ClePouvoir;
  /** Durée complète de ce qui se décompte (recharge, réserve ou Zetsu), pour la jauge ; null = inconnue. */
  totalMs: number | null;
  secret: boolean;
}

export function clePouvoir(moi: Pick<Moi, 'nen' | 'pouvoirSpe'>): ClePouvoir | null {
  if (!moi.nen) return null;
  if (moi.nen === 'specialisation') return moi.pouvoirSpe;
  return moi.nen;
}

/** RG-5.4 amendé : état de la case du Nen (page Sorts), avec la durée complète pour la jauge (RG-14, reçue de /moi). */
export function casePouvoir(moi: MoiPouvoir & Pick<Moi, 'recharges'>, ecoule: number): CasePouvoir | null {
  const cle = clePouvoir(moi);
  const e = etatPouvoir(moi, ecoule);
  if (!cle || !e) return null;
  const r = moi.recharges;
  const totalMs =
    e.etat === 'actif' ? r.zetsu : cle === 'transformation' ? r.transformation : cle === 'materialisation' ? r.reserve : moi.nen === 'specialisation' ? r.specialisation : r.pouvoir;
  return { ...e, nom: CASES[cle].nom, effet: CASES[cle].effet, cle, totalMs, secret: moi.nen === 'specialisation' };
}

/** Remplissage de la jauge, de 0 à 1 : la recharge monte, le Zetsu restant descend. */
export function remplissage(c: Pick<CasePouvoir, 'etat' | 'resteMs' | 'totalMs'>): number {
  if (c.etat === 'pret') return 1;
  if (!c.totalMs) return 0;
  const part = Math.min(1, Math.max(0, c.resteMs / c.totalMs));
  return c.etat === 'actif' ? part : 1 - part;
}

/** Une carte du catalogue de la partie (GET /cartes), avec sa limite lue dans le Book (RG-8.2, « A-3 »). */
export interface CarteCatalogue {
  id: string;
  numero: number;
  nom: string;
  rang: Rank;
  texte?: string | null;
  limite?: number | null;
}

/** Limites du catalogue : lues sur les emplacements fixes du Book, par numéro de carte. */
export function avecLimites(cartes: CarteCatalogue[], l: LivreRecu): CarteCatalogue[] {
  const lim = new Map<number, number>();
  for (const e of l.pages.flat()) {
    const c = e.etat === 'vide' ? (e.designe ? e.carte : null) : e.etat === 'perdu' ? e.carte : e.kind === 'carte' ? e : null;
    if (c?.numero != null && c.limite) lim.set(c.numero, c.limite);
  }
  return cartes.map((c) => ({ ...c, limite: c.limite ?? lim.get(c.numero) ?? null }));
}

const indexRang = (r: Rank) => RANKS.indexOf(r);

/**
 * RG-5.4 Texture Surprise : l'apparence d'une autre carte de même rang ; un doublon S peut aussi imiter la SS
 * (amendement 2026-10-09, pour le bluff).
 */
export function apparencesTexture(d: { carteId: string; rang: Rank | null }, cat: CarteCatalogue[]): CarteCatalogue[] {
  if (!d.rang) return [];
  return cat.filter((c) => c.id !== d.carteId && (c.rang === d.rang || (d.rang === 'S' && c.rang === 'SS')));
}

/** Amendement 2026-10-10, Alchimie : même rang ou rang juste au-dessus, jamais la SS. */
export function cartesAlchimie(d: { carteId: string; rang: Rank | null }, cat: CarteCatalogue[]): CarteCatalogue[] {
  if (!d.rang) return [];
  const i = indexRang(d.rang);
  return cat.filter((c) => c.id !== d.carteId && c.rang !== 'SS' && (indexRang(c.rang) === i || indexRang(c.rang) === i - 1));
}

/** Amendement 2026-10-10, Bandit : toute carte du catalogue sauf la SS ; le Book de la cible n'est pas montré. */
export function cartesBandit(cat: CarteCatalogue[]): CarteCatalogue[] {
  return cat.filter((c) => c.rang !== 'SS');
}

/** Cartes rangées par rang, du plus haut au plus bas, puis par numéro. */
export function parRang(cartes: CarteCatalogue[]): { rang: Rank; cartes: CarteCatalogue[] }[] {
  return RANKS.map((rang) => ({ rang, cartes: cartes.filter((c) => c.rang === rang).sort((a, b) => a.numero - b.numero) })).filter((g) => g.cartes.length > 0);
}

/** Phrase de Texture Surprise (décision 2026-10-12 : une contrefaçon ignorée fait échouer le déguisement). */
export function phraseTexture(doublon: string, apparence: string, resultat: 'reussi' | 'contrefacon' = 'reussi'): string {
  if (resultat === 'contrefacon') return 'Le déguisement échoue : ce doublon était une contrefaçon. Elle reste dans ton Book, démasquée, et ton pouvoir est utilisé.';
  return `Ton doublon ${enPhrase(doublon)} a maintenant l’apparence de ${enPhrase(apparence)}. Pour les autres, c’est une vraie carte, jusqu’à ce qu’une Pénétration la démasque.`;
}

/** Phrase de l'Alchimie (amendement 2026-10-10 : une contrefaçon fait échouer l'alchimie, le pouvoir est consommé). */
export function phraseAlchimie(resultat: 'reussi' | 'contrefacon', doublon: string, obtenue: string | null): string {
  if (resultat === 'contrefacon') return 'L’alchimie échoue : ce doublon était une contrefaçon. Il disparaît, et ton pouvoir est utilisé.';
  return `Ton doublon ${enPhrase(doublon)} est devenu ${enPhrase(obtenue ?? 'une carte')}. Elle part dans ton Book.`;
}

const PROTECTIONS = { barriere: 'un Mur défensif', renforcement: 'son Renforcement', voile: 'un Voile d’ombre' } as const;

/** Phrase de L'épée du vol : la carte visée, ou une carte au hasard si la cible ne l'avait pas. */
export function phraseBandit(r: Pick<ReponseSort, 'resultat' | 'protection' | 'recu'>, cible: string, visee: { id: string; nom: string } | null): string {
  if (r.resultat === 'bloque') return `${cible} avait ${r.protection ? PROTECTIONS[r.protection] : 'une protection'} : il a arrêté ton épée. Ton pouvoir est utilisé.`;
  if (r.resultat === 'sans_effet') return `Ton épée a fendu le vide : ${cible} n’a aucune carte à prendre. Ton pouvoir est utilisé.`;
  const prise = enPhrase(r.recu?.nom ?? 'une carte');
  if (visee && r.recu?.carteId !== visee.id) return `${cible} n’avait pas ${enPhrase(visee.nom)} à prendre : ton épée a pris une carte au hasard, ${prise}.`;
  return `Tu as pris ${prise} à ${cible}.`;
}
