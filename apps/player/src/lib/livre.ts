// Livre du joueur tel que l'API le donne (GET /livre, RG-8.5). Chargement : useLivre.ts.
import type { Rank, SpellType } from '@gq/shared';

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
    } & Carte);

export interface LivreRecu {
  gele: boolean;
  cartesDesignees: number;
  total: number;
  libresUtilises: number;
  pages: Emplacement[][];
}

export type EmplacementCarte = Extract<Emplacement, { kind: 'carte' }>;
export type EmplacementSort = Extract<Emplacement, { kind: 'sort' }>;

/** Tous les emplacements occupés, toutes pages confondues. */
export function contenu(l: LivreRecu): (EmplacementCarte | EmplacementSort)[] {
  return l.pages.flat().filter((e): e is EmplacementCarte | EmplacementSort => e.etat === 'plein');
}
