// Sorts (RG-10) côté app : ce que le joueur peut lancer, et les phrases affichées pour les résultats
// et les alertes reçues (RG-10.5). Le serveur décide de tout (P1) ; ici on ne fait que présenter.
import type { NenType, PositionInput, SpellType } from '@gq/shared';
import { SORTS } from './format';
import { contenu, type EmplacementCarte, type LivreRecu } from './livre';

/** Ordre d'affichage : offensifs, puis information, puis Livre. */
const ORDRE: SpellType[] = ['vol', 'pickpocket', 'echange_force', 'gel', 'accompagnement', 'radar', 'regard', 'clairvoyance', 'revelation', 'retour', 'duplication', 'analyse', 'barriere'];

export interface SortDisponible {
  sort: SpellType;
  /** Cartes de sort du Livre (on lance la première). */
  itemIds: string[];
}

export function sortsDisponibles(l: LivreRecu): SortDisponible[] {
  const parSort = new Map<SpellType, string[]>();
  for (const e of contenu(l)) if (e.kind === 'sort') parSort.set(e.sort, [...(parSort.get(e.sort) ?? []), e.itemId]);
  return ORDRE.filter((s) => parSort.has(s)).map((sort) => ({ sort, itemIds: parSort.get(sort)! }));
}

/** Cartes qu'on peut donner (Échange forcé) ou copier (Duplication) : pas celles engagées dans un échange. */
export function cartesUtilisables(l: LivreRecu): EmplacementCarte[] {
  return contenu(l).filter((e): e is EmplacementCarte => e.kind === 'carte' && !e.engagee && e.apparence === 'normale');
}

/** RG-5.4 Transformation : doublons = cartes rangées dans les emplacements libres. */
export function doublons(l: LivreRecu): EmplacementCarte[] {
  return cartesUtilisables(l).filter((e) => !e.designe);
}

export type NenPouvoir = 'emission' | 'manipulation' | 'renforcement';

/**
 * RG-5.4 amendé (2026-10-10) : pouvoir de Nen disponible maintenant. `delai` = recharge restante reçue de l'API
 * (0 = disponible, null = aucun pouvoir), `ecoule` = temps passé depuis la réception.
 */
export function pouvoirDispo(nen: NenType | null, delai: number | null, ecoule: number, p: NenPouvoir): boolean {
  return nen === p && delai !== null && delai - ecoule <= 0;
}

/** Les sorts qui visent un joueur, et ceux qui ne visent que des joueurs à portée. */
export const VISE_JOUEUR: readonly SpellType[] = ['vol', 'pickpocket', 'echange_force', 'gel', 'radar', 'regard', 'clairvoyance', 'accompagnement'];
export const OFFENSIF: readonly SpellType[] = ['vol', 'pickpocket', 'echange_force', 'gel', 'accompagnement'];
/** Amendements 2026-10-09 / 2026-10-10 : cibles parmi les joueurs déjà croisés (`croises` de GET /a-portee). */
export const CIBLE_CROISEE: readonly SpellType[] = ['regard', 'clairvoyance', 'accompagnement'];

/** Réponse de `POST /sort` (champs privés selon le sort). */
export interface ReponseSort {
  sort: SpellType;
  resultat: 'reussi' | 'bloque' | 'sans_effet';
  protection?: 'barriere' | 'renforcement' | null;
  recu?: { itemId: string; carteId?: string; nom?: string } | null;
  zone?: string | null;
  copie?: { itemId: string; carteId: string; contrefacon: boolean };
  contrefacons?: string[];
  /** Retour : ville ouverte à distance. */
  ville?: 'masadora' | 'antokiba';
  /** Accompagnement : position de la cible (au seul lanceur). */
  accompagnement?: { cibleId: string; pseudo: string; position: { lat: number; lng: number; precisionM: number } | null };
  /** Voyance, Clairvoyance : cartes du joueur regardé, telles qu'elles paraissent. */
  cartes?: { carteId: string; numero: number; nom: string; rang: string; n: number; contrefacon: boolean }[];
}

const PROTECTION = { barriere: 'son Mur défensif', renforcement: 'son Renforcement' } as const;

/** Phrase de résultat pour le lanceur. `cible` : pseudo visé ; `noms` : nom des cartes par itemId (Analyse). */
export function resumeSort(r: ReponseSort, cible: string | null, noms: (itemId: string) => string): string {
  const qui = cible ?? 'La cible';
  if (r.resultat === 'bloque') return `${qui} était protégé : sort bloqué par ${r.protection ? PROTECTION[r.protection] : 'une protection'}.`;
  switch (r.sort) {
    case 'vol':
      return r.resultat === 'reussi' ? `Tu as volé ${r.recu?.nom ?? 'une carte'} à ${qui}.` : `${qui} n’avait rien à voler.`;
    case 'echange_force':
      return r.resultat === 'reussi' ? `Échange forcé avec ${qui} : tu reçois ${r.recu?.nom ?? 'une carte'}.` : `${qui} n’avait rien à échanger.`;
    case 'gel':
      return `${qui} est gelé : plus de scan pendant 3 min.`;
    case 'radar':
      return r.zone ? `Dernière position connue de ${qui} : zone ${r.zone}.` : `Position de ${qui} inconnue.`;
    case 'revelation':
      return r.zone ? `Une balise rare est active en zone ${r.zone}.` : 'Aucune balise rare active pour le moment.';
    case 'duplication':
      return r.copie?.contrefacon
        ? 'Copie créée, mais la limite d’exemplaires est atteinte : c’est une contrefaçon.'
        : 'Copie réussie : un vrai exemplaire de plus.';
    case 'analyse': {
      const l = r.contrefacons ?? [];
      return l.length === 0 ? 'Aucune contrefaçon sur cette page.' : `Contrefaçon${l.length > 1 ? 's' : ''} : ${l.map(noms).join(', ')}.`;
    }
    case 'barriere':
      return SORTS.barriere.effet;
    case 'pickpocket':
      return r.resultat === 'reussi' ? `Tu as pris ${r.recu?.nom ?? 'une carte'} à ${qui}.` : `${qui} n’avait rien dans ses emplacements libres.`;
    case 'accompagnement':
      return `${qui} est gelé 3 min : suis sa position.`;
    case 'retour':
      return `Tu es à ${r.ville === 'antokiba' ? 'Antokiba' : 'Masadora'} à distance pendant 10 min.`;
    case 'regard':
    case 'clairvoyance': {
      const l = r.cartes ?? [];
      if (l.length === 0) return `${qui} n’a aucune carte.`;
      return `Cartes de ${qui} : ${l.map((x) => `${x.nom}${x.n > 1 ? ` ×${x.n}` : ''}${x.contrefacon ? ' (contrefaçon)' : ''}`).join(', ')}.`;
    }
  }
}

/** RG-10.5 : alerte reçue par la cible (`sort_recu` : lanceur, sort, résultat). */
export function texteSortRecu(d: { lanceur: string | null; sort: SpellType; resultat: ReponseSort['resultat'] }): string {
  const nom = SORTS[d.sort]?.nom ?? d.sort;
  // Regard est anonyme : la cible sait seulement qu'on a consulté son Livre.
  if (d.sort === 'regard' || d.sort === 'clairvoyance' || d.lanceur === null) return 'Quelqu’un a consulté ton Book.';
  if (d.resultat === 'bloque') return `${d.lanceur} t’a lancé ${nom}, mais ta protection l’a bloqué.`;
  if (d.resultat === 'sans_effet') return `${d.lanceur} t’a lancé ${nom}, sans effet.`;
  switch (d.sort) {
    case 'vol':
      return `${d.lanceur} t’a volé une carte !`;
    case 'echange_force':
      return `${d.lanceur} t’a imposé un échange forcé !`;
    case 'gel':
      return `${d.lanceur} t’a gelé : plus de scan pendant 3 min.`;
    case 'radar':
      return `${d.lanceur} a utilisé Trace sur toi : il connaît ta zone.`;
    case 'pickpocket':
      return `${d.lanceur} t’a pris une carte dans tes emplacements libres !`;
    case 'accompagnement':
      return `${d.lanceur} utilise Accompagnement sur toi : tu es gelé 3 min et il voit où tu es.`;
    default:
      return `${d.lanceur} t’a lancé ${nom}.`;
  }
}

/** Choix faits par le joueur dans l'écran des sorts. */
export interface ChoixSort {
  sort: SpellType;
  /** Carte de sort du Livre, ou `null` pour le pouvoir de Manipulation (échange forcé gratuit). */
  itemId: string | null;
  cibleId?: string;
  emission?: boolean;
  carteItemId?: string;
  page?: number;
  /** Retour : ville déjà visitée. */
  ville?: 'masadora' | 'antokiba';
}

/** Corps de `POST /sort` (schéma SortIntent de @gq/shared) : uniquement l'intention (P1). */
export function corpsSort(c: ChoixSort, position: PositionInput): Record<string, unknown> {
  const source = c.itemId === null ? { type: 'pouvoir' } : { type: 'carte', itemId: c.itemId };
  switch (c.sort) {
    case 'vol':
    case 'gel':
      return { sort: c.sort, source, cibleId: c.cibleId, ...(c.emission ? { emission: true } : {}), position };
    case 'echange_force':
      return { sort: c.sort, source, cibleId: c.cibleId, carteDonneeId: c.carteItemId, ...(c.emission ? { emission: true } : {}), position };
    case 'radar':
    case 'regard':
    case 'clairvoyance':
    case 'accompagnement':
      return { sort: c.sort, itemId: c.itemId, cibleId: c.cibleId, position };
    case 'pickpocket':
      return { sort: c.sort, itemId: c.itemId, cibleId: c.cibleId, ...(c.emission ? { emission: true } : {}), position };
    case 'retour':
      return { sort: c.sort, itemId: c.itemId, ville: c.ville, position };
    case 'duplication':
      return { sort: c.sort, itemId: c.itemId, carteItemId: c.carteItemId, position };
    case 'analyse':
      return { sort: c.sort, itemId: c.itemId, page: c.page, position };
    default:
      return { sort: c.sort, itemId: c.itemId, position };
  }
}

/** Étapes du lancement : carte à choisir, page, cible, puis confirmation. */
export function etapes(sort: SpellType): ('carte' | 'page' | 'cible' | 'ville')[] {
  if (sort === 'retour') return ['ville'];
  if (sort === 'echange_force') return ['carte', 'cible'];
  if (sort === 'duplication') return ['carte'];
  if (sort === 'analyse') return ['page'];
  if (VISE_JOUEUR.includes(sort)) return ['cible'];
  return [];
}
