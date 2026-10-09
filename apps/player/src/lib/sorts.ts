// Sorts (RG-10) côté app : ce que le joueur peut lancer, et les phrases affichées pour les résultats
// et les alertes reçues (RG-10.5). Le serveur décide de tout (P1) ; ici on ne fait que présenter.
import type { NenType, PositionInput, SpellType } from '@gq/shared';
import { SORTS } from './format';
import { contenu, type EmplacementCarte, type LivreRecu } from './livre';

/** Ordre d'affichage : offensifs, puis information, puis Livre. */
const ORDRE: SpellType[] = ['vol', 'echange_force', 'gel', 'radar', 'revelation', 'duplication', 'analyse', 'barriere'];

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

/** RG-5.4 : pouvoir de Nen encore disponible (une fois par partie). */
export function pouvoirDispo(nen: NenType | null, utilises: readonly NenPouvoir[], p: NenPouvoir): boolean {
  return nen === p && !utilises.includes(p);
}

/** Les sorts qui visent un joueur, et ceux qui ne visent que des joueurs à portée. */
export const VISE_JOUEUR: readonly SpellType[] = ['vol', 'echange_force', 'gel', 'radar'];
export const OFFENSIF: readonly SpellType[] = ['vol', 'echange_force', 'gel'];

/** Réponse de `POST /sort` (champs privés selon le sort). */
export interface ReponseSort {
  sort: SpellType;
  resultat: 'reussi' | 'bloque' | 'sans_effet';
  protection?: 'barriere' | 'renforcement' | null;
  recu?: { itemId: string; carteId?: string; nom?: string } | null;
  zone?: string | null;
  copie?: { itemId: string; carteId: string; contrefacon: boolean };
  contrefacons?: string[];
}

const PROTECTION = { barriere: 'sa Barrière', renforcement: 'son Renforcement' } as const;

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
  }
}

/** RG-10.5 : alerte reçue par la cible (`sort_recu` : lanceur, sort, résultat). */
export function texteSortRecu(d: { lanceur: string; sort: SpellType; resultat: ReponseSort['resultat'] }): string {
  const nom = SORTS[d.sort]?.nom ?? d.sort;
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
      return `${d.lanceur} a utilisé Radar sur toi : il connaît ta zone.`;
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
      return { sort: c.sort, itemId: c.itemId, cibleId: c.cibleId, position };
    case 'duplication':
      return { sort: c.sort, itemId: c.itemId, carteItemId: c.carteItemId, position };
    case 'analyse':
      return { sort: c.sort, itemId: c.itemId, page: c.page, position };
    default:
      return { sort: c.sort, itemId: c.itemId, position };
  }
}

/** Étapes du lancement : carte à choisir, page, cible, puis confirmation. */
export function etapes(sort: SpellType): ('carte' | 'page' | 'cible')[] {
  if (sort === 'echange_force') return ['carte', 'cible'];
  if (sort === 'duplication') return ['carte'];
  if (sort === 'analyse') return ['page'];
  if (VISE_JOUEUR.includes(sort)) return ['cible'];
  return [];
}
