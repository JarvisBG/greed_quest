// Échanges « à la Pokémon » (RG-11.1 amendé) côté app : vue d'une session telle que l'API la donne,
// et ce que le joueur peut mettre dans sa part. Le serveur fait foi (P1, double validation).
// Page ⑫ (prototype validé le 2026-10-12 : docs/prototype/echanges.html) : vente d'une carte, résumé des rangs.
import type { ObjetType, Rank } from '@gq/shared';
import type { CarteProps } from '@gq/ui';
import { OBJETS } from './format';
import { contenu, type EmplacementCarte, type LivreRecu } from './livre';
import { enPhrase } from './sorts';

export type EtatEchange = 'invitation' | 'composition' | 'conclu' | 'refuse' | 'annule' | 'expire';

/** Une carte (ou un objet, amendement 2026-10-10) posée sur la table, décrite comme dans le Book. */
export interface Piece {
  itemId: string;
  kind?: 'carte' | 'objet';
  objet?: ObjetType | null;
  carteId: string | null;
  numero?: number | null;
  nom: string | null;
  rang: Rank | null;
  texte?: string | null;
  limite?: number | null;
}

export interface Part {
  cartes: Piece[];
  jenny: number;
}

/** Vue d'un participant (GET /echanges/courant, évènement `echange`). */
export interface VueEchange {
  id: string;
  etat: EtatEchange;
  avec: { id: string; pseudo: string };
  /** Vrai si l'autre joueur a proposé. */
  invite: boolean;
  maPart: Part;
  sonPart: Part;
  jeValide: boolean;
  ilValide: boolean;
  /** « Vendre une carte » : prix demandé et qui vend ; null pour un échange. */
  vente?: { prix: number; jeVends: boolean } | null;
  /** Heure locale de réception : les décomptes (60 s, 3 min sans action) partent de là. */
  recuA?: number;
}

/** L'expiration n'envoie que `{ id, etat: 'expire' }`. */
export type EvenementEchange = VueEchange | { id: string; etat: 'expire' };

export const termine = (etat: EtatEchange) => etat === 'conclu' || etat === 'refuse' || etat === 'annule' || etat === 'expire';

/** Délais de RG-11.1 amendé : 60 s pour répondre, 3 min sans action pendant la composition. */
export const REPONSE_S = 60;
export const SANS_ACTION_S = 180;

/**
 * Phrase de fin dite par le jeu. `parMoi` : c'est moi qui ai refusé ou annulé ; `avant` : état de la session
 * juste avant (une invitation qui expire n'est pas une table abandonnée).
 */
export function messageFin(etat: EtatEchange, avec: string | null, o: { parMoi?: boolean; avant?: EtatEchange | null; invite?: boolean } = {}): string {
  const qui = avec ?? 'L’autre joueur';
  switch (etat) {
    case 'conclu':
      return `Échange conclu avec ${qui} !`;
    case 'refuse':
      return o.parMoi ? 'Tu as refusé la proposition.' : `${qui} a refusé ton échange.`;
    case 'annule':
      return o.parMoi ? 'Tu as annulé l’échange. Rien n’a bougé.' : `${qui} a annulé l’échange. Rien n’a bougé.`;
    case 'expire':
      if (o.avant === 'invitation') return o.invite ? `Tu n’as pas répondu à ${qui} : la proposition a expiré.` : `${qui} n’a pas répondu à temps.`;
      return 'L’échange a expiré : 3 minutes sans action. Rien n’a bougé.';
    default:
      return '';
  }
}

/** Ce qu'il faut pour dessiner une pièce avec `Carte` de @gq/ui. */
export type VuePiece = Omit<CarteProps, 'className' | 'illustration' | 'grisee'>;

export function vueDePiece(p: Piece): VuePiece {
  if (p.kind === 'objet' && p.objet) {
    const o = OBJETS[p.objet];
    return { genre: 'objet', numero: o.numero ?? '—', nom: o.nom, texte: o.effet };
  }
  return { genre: 'designee', numero: p.numero ?? null, nom: p.nom ?? '?', rang: p.rang, limite: p.limite ?? null, texte: p.texte ?? null };
}

/** Une carte ou un objet de mon Book que je peux poser, avec où il se trouve (« emplacement 019 », « libre », « objet »). */
export interface MaPiece {
  itemId: string;
  vue: VuePiece;
  ou: string;
  objet: boolean;
  /** Pour le résumé des rangs et la cinématique. */
  piece: Piece;
}

/**
 * Ce qu'on peut mettre dans sa part : ses cartes (pas les sorts, RG-11) et ses objets (amendement 2026-10-10),
 * sauf les contrefaçons démasquées et ce qui est engagé ailleurs ; ce qui est déjà dans cette part reste proposé.
 */
export function mesPieces(l: LivreRecu, maPart: Part | null): MaPiece[] {
  const dansPart = new Set(maPart?.cartes.map((c) => c.itemId) ?? []);
  const cartes = cartesEchangeables(l, maPart ?? { cartes: [], jenny: 0 }).map((c): MaPiece => {
    const piece: Piece = { itemId: c.itemId, kind: 'carte', carteId: c.carteId, numero: c.numero, nom: c.nom, rang: c.rang, texte: c.texte ?? null, limite: c.limite ?? null };
    return { itemId: c.itemId, vue: vueDePiece(piece), ou: c.designe && !c.cachee ? `emplacement ${String(c.numero ?? 0).padStart(3, '0')}` : 'libre', objet: false, piece };
  });
  const objets = l.objets
    .filter((o) => !o.engage || dansPart.has(o.itemId))
    .map((o): MaPiece => {
      const piece: Piece = { itemId: o.itemId, kind: 'objet', objet: o.objet, carteId: null, nom: OBJETS[o.objet].nom, rang: null };
      return { itemId: o.itemId, vue: vueDePiece(piece), ou: 'objet', objet: true, piece };
    });
  return [...cartes, ...objets];
}

/** Cartes de collection proposables (voir `mesPieces`). */
export function cartesEchangeables(l: LivreRecu, maPart: Part): EmplacementCarte[] {
  const dansPart = new Set(maPart.cartes.map((c) => c.itemId));
  return contenu(l).filter((e): e is EmplacementCarte => e.kind === 'carte' && e.apparence === 'normale' && (!e.engagee || dansPart.has(e.itemId)));
}

/** RG-11.2 : chaque côté donne au moins 1 carte ou 1 jenny. */
export const partVide = (p: Part) => p.cartes.length === 0 && p.jenny === 0;

const ORDRE: (Rank | 'objet')[] = ['SS', 'S', 'A', 'B', 'C', 'D', 'objet'];

/** Résumé factuel d'une part, sans verdict ni balance (choix de Sivraj, 2026-10-12) : « 3 cartes · 1 S, 2 C · 20 J ». */
export function resumePart(p: Part): string {
  if (partVide(p)) return 'rien pour l’instant';
  const bouts: string[] = [];
  if (p.cartes.length) {
    bouts.push(`${p.cartes.length} carte${p.cartes.length > 1 ? 's' : ''}`);
    const n = new Map<Rank | 'objet', number>();
    for (const c of p.cartes) {
      const k = c.kind === 'objet' ? 'objet' : c.rang;
      if (k) n.set(k, (n.get(k) ?? 0) + 1);
    }
    const rangs = ORDRE.filter((k) => n.get(k)).map((k) => (k === 'objet' ? `${n.get(k)} objet${n.get(k)! > 1 ? 's' : ''}` : `${n.get(k)} ${k}`));
    if (rangs.length) bouts.push(rangs.join(', '));
  }
  if (p.jenny) bouts.push(`${p.jenny} J`);
  return bouts.join(' · ');
}

/** Nom d'une pièce dans une phrase (« la pierre flottante », « Pépite d’or »). */
export const nomEnPhrase = (p: Piece) => enPhrase(vueDePiece(p).nom);

/** « la pierre flottante, le dé du risque et 20 J ». */
export function listePart(p: Part): string {
  const b = p.cartes.map(nomEnPhrase);
  if (p.jenny) b.push(`${p.jenny} J`);
  return b.length > 1 ? `${b.slice(0, -1).join(', ')} et ${b.at(-1)}` : (b[0] ?? 'rien');
}

/** Phrase de l'appel pour une vente : « Leolio te vend la pierre flottante pour 80 J. » */
export function phraseVente(avec: string, p: Piece | undefined, prix: number): string {
  return `${avec} te vend ${p ? nomEnPhrase(p) : 'une carte'} pour ${prix} J.`;
}

/** Note sous la pile de jenny en vente : prix demandé, ou contre-proposition de l'acheteur. */
export function notePrix(e: Pick<VueEchange, 'vente' | 'maPart'>): string | null {
  if (!e.vente) return null;
  if (e.vente.jeVends) return `Ton prix : ${e.vente.prix} J`;
  return e.maPart.jenny === e.vente.prix ? `Prix demandé : ${e.vente.prix} J` : `Ta contre-proposition : ${e.maPart.jenny} J (prix demandé ${e.vente.prix} J)`;
}

/** Angle et décalage d'une carte jetée sur le tapis, tirés de son id : elle garde sa place d'un rendu à l'autre. */
export function jete(id: string): { r: number; y: number } {
  let h = 7;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return { r: (h % 13) - 6, y: ((h >> 3) % 7) - 3 };
}

/** Nombre de pièces d'or dessinées sur la pile (1 à 6, croît lentement avec le montant). */
export const nbPieces = (jenny: number) => (jenny ? Math.min(6, 1 + Math.floor(Math.log2(1 + jenny / 10))) : 0);

/** État affiché sur la couture pour chaque joueur. */
export const etatPart = (p: Part, valide: boolean) => (valide ? 'validé' : partVide(p) ? 'compose' : 'réfléchit');
