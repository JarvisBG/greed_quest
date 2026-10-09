// Échanges « à la Pokémon » (RG-11.1 amendé) côté app : vue d'une session telle que l'API la donne,
// et ce que le joueur peut mettre dans sa part. Le serveur fait foi (P1, double validation).
import type { Rank } from '@gq/shared';
import { contenu, type EmplacementCarte, type LivreRecu } from './livre';

export type EtatEchange = 'invitation' | 'composition' | 'conclu' | 'refuse' | 'annule' | 'expire';

export interface Part {
  cartes: { itemId: string; carteId: string | null; nom: string | null; rang: Rank | null }[];
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
}

/** L'expiration n'envoie que `{ id, etat: 'expire' }`. */
export type EvenementEchange = VueEchange | { id: string; etat: 'expire' };

export const termine = (etat: EtatEchange) => etat === 'conclu' || etat === 'refuse' || etat === 'annule' || etat === 'expire';

export function messageFin(etat: EtatEchange, avec: string | null): string {
  const qui = avec ?? 'l’autre joueur';
  switch (etat) {
    case 'conclu':
      return `Échange conclu avec ${qui} !`;
    case 'refuse':
      return `Échange refusé.`;
    case 'annule':
      return `Échange annulé.`;
    case 'expire':
      return `Échange expiré : pas de réponse à temps.`;
    default:
      return '';
  }
}

/**
 * Cartes qu'on peut mettre dans sa part : ses cartes (pas les sorts, RG-11), sauf les contrefaçons
 * démasquées et celles engagées ailleurs ; celles déjà dans cette part restent proposées.
 */
export function cartesEchangeables(l: LivreRecu, maPart: Part): EmplacementCarte[] {
  const dansPart = new Set(maPart.cartes.map((c) => c.itemId));
  return contenu(l).filter((e): e is EmplacementCarte => e.kind === 'carte' && e.apparence === 'normale' && (!e.engagee || dansPart.has(e.itemId)));
}

/** RG-11.2 : chaque côté donne au moins 1 carte ou 1 jenny. */
export const partVide = (p: Part) => p.cartes.length === 0 && p.jenny === 0;

export function resumePart(p: Part): string {
  const morceaux = p.cartes.map((c) => `${c.nom ?? '?'}${c.rang ? ` (${c.rang})` : ''}`);
  if (p.jenny > 0) morceaux.push(`${p.jenny} J`);
  return morceaux.length ? morceaux.join(', ') : 'rien pour l’instant';
}
