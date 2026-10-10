// Livre du joueur tel que l'API le donne (GET /livre, RG-8.5). Chargement : useLivre.ts.
import type { ObjetType, Rank, SpellType } from '@gq/shared';

export interface Carte {
  numero: number | null;
  nom: string;
  rang: Rank | null;
}

export type Emplacement =
  | { etat: 'vide'; designe: false }
  | { etat: 'vide'; designe: true; carte: Carte }
  | { etat: 'perdu'; designe: true; carte: Carte; message: string }
  | { etat: 'plein'; designe: boolean; kind: 'sort'; itemId: string; sort: SpellType }
  | ({
      etat: 'plein';
      designe: boolean;
      kind: 'carte';
      itemId: string;
      carteId: string;
      apparence: 'normale' | 'grisee';
      badge: 'contrefacon' | 'maudite' | null;
      provenance: string;
      obtenue: string;
      engagee: boolean;
      /** RG-8.5 amendé : carte désignée cachée dans les emplacements libres. */
      cachee?: boolean;
    } & Carte);

export interface LivreRecu {
  gele: boolean;
  cartesDesignees: number;
  total: number;
  libresUtilises: number;
  pages: Emplacement[][];
  /** Amendement 2026-10-10 : section des objets, à part. */
  objets: { itemId: string; objet: ObjetType; obtenu: string; engage: boolean }[];
  placesObjets: number;
}

export type EmplacementCarte = Extract<Emplacement, { kind: 'carte' }>;
export type EmplacementSort = Extract<Emplacement, { kind: 'sort' }>;

/** Tous les emplacements occupés, toutes pages confondues. */
export function contenu(l: LivreRecu): (EmplacementCarte | EmplacementSort)[] {
  return l.pages.flat().filter((e): e is EmplacementCarte | EmplacementSort => e.etat === 'plein');
}

/** Numéro de l'emplacement fixe (numéro de l'anime, RG-8.1 amendé), null pour un emplacement libre. */
function numeroFixe(e: Emplacement): number | null {
  if (!e.designe) return null;
  if (e.etat === 'plein') return e.kind === 'carte' ? e.numero : null;
  return e.carte.numero;
}

/** Titre d'une page : « 000 – 082 » pour les emplacements fixes (numéros de l'anime), « Libres 1 » ensuite. */
export function titreDePage(l: LivreRecu, i: number): string {
  const num = (n: number) => String(n).padStart(3, '0');
  const nums = (l.pages[i] ?? []).map(numeroFixe).filter((n): n is number => n !== null);
  if (nums.length > 0) return nums.length === 1 ? num(nums[0]!) : `${num(nums[0]!)} – ${num(nums.at(-1)!)}`;
  const fixes = l.pages.filter((p) => p.some((e) => numeroFixe(e) !== null)).length;
  return `Libres ${i - fixes + 1}`;
}

/** RG-8.5 amendé : cartes désignées rangées à leur place (que l'on peut cacher) et cartes cachées (à remettre). */
export function cartesACacher(l: LivreRecu): EmplacementCarte[] {
  return contenu(l).filter((e): e is EmplacementCarte => e.kind === 'carte' && e.designe && !e.engagee && !l.gele);
}
