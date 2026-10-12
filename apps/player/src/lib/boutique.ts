// Page ⑬ (prototype validé le 2026-10-12 : docs/prototype/masadora.html) : vitrine de Masadora et revente.
// Le serveur fait foi (P1) : ces fonctions ne font qu'afficher ce que GET /boutique et GET /livre disent.
import type { ObjetType, Rank } from '@gq/shared';
import type { EmplacementCarte } from './livre';

/** « 13:21 » (même affichage que les décomptes des sorts). */
export const minSec = (ms: number) => {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** GET /parties/:id/boutique. Les décomptes sont lus à `recuA` (heure du téléphone). */
export interface EtatBoutique {
  prixPaquet: number;
  /** Prix hors Krach (barré pendant un Krach). */
  prixBase: number;
  krachResteMs: number | null;
  paquetsRestants: number;
  vagueResteMs: number;
  mesAchats: number;
  maxParVague: number;
  revente: Record<Rank, number | null>;
  reventeContrefacon: number;
  reventeObjets: Record<ObjetType, number | null>;
}

/**
 * Contrefaçon que le joueur connaît : démasquée (grisée, RG-8.9) ou créée par lui (Mimétisme, badge « contrefaçon »).
 * Masadora la reprend au prix d'une contrefaçon.
 */
export const estDemasquee = (c: EmplacementCarte) => c.apparence === 'grisee' || c.badge === 'contrefacon';

/** RG-9.4 : prix de rachat affiché sous une carte ; null = invendable (SS). Une contrefaçon ignorée s'affiche au prix de sa carte apparente. */
export function prixRachat(c: EmplacementCarte, e: Pick<EtatBoutique, 'revente' | 'reventeContrefacon'>): number | null {
  if (estDemasquee(c)) return e.reventeContrefacon;
  return c.rang ? e.revente[c.rang] : null;
}

export interface Bouton {
  texte: string;
  actif: boolean;
  /** Le QR n'est pas encore scanné : le bouton ouvre l'appareil photo. */
  qr: boolean;
}

/** Le bouton unique de la vitrine porte la raison quand il est désactivé (stock, limite, jenny). */
export function boutonAchat(o: { present: boolean; envoi: boolean; e: EtatBoutique; jenny: number; vagueMs: number }): Bouton {
  const { e } = o;
  if (o.envoi) return { texte: 'Envoi…', actif: false, qr: false };
  if (!o.present) return { texte: 'Scanner le QR de la boutique', actif: true, qr: true };
  if (e.paquetsRestants <= 0) return { texte: `Plus de paquets : vague suivante dans ${minSec(o.vagueMs)}`, actif: false, qr: false };
  if (e.mesAchats >= e.maxParVague) return { texte: `Tes ${e.maxParVague} paquets de la vague : suivante dans ${minSec(o.vagueMs)}`, actif: false, qr: false };
  if (o.jenny < e.prixPaquet) return { texte: `Il te manque ${e.prixPaquet - o.jenny} J`, actif: false, qr: false };
  return { texte: `Acheter un paquet · ${e.prixPaquet} J`, actif: true, qr: false };
}

/** « Vol, Gel et Trace » */
export const enListe = (noms: string[]) => (noms.length > 1 ? `${noms.slice(0, -1).join(', ')} et ${noms.at(-1)}` : (noms[0] ?? ''));

/** « Tu as obtenu Vol ×2 et Gel. » */
export function texteObtenu(noms: string[]): string {
  const n = new Map<string, number>();
  for (const x of noms) n.set(x, (n.get(x) ?? 0) + 1);
  return `Tu as obtenu ${enListe([...n].map(([nom, k]) => (k > 1 ? `${nom} ×${k}` : nom)))}.`;
}

/** Où est la pièce dans le Book, et ce que Masadora en donne (fiche de revente). */
export function texteFiche(o: { objet: boolean; designe?: boolean; numero?: string; prix: number }): string {
  if (o.objet) return `Section Objets. Masadora le reprend ${o.prix} J.`;
  if (o.designe) return `Emplacement ${o.numero} de ton Book : il redeviendra vide. Masadora la reprend ${o.prix} J.`;
  return `Page libre. Masadora la reprend ${o.prix} J.`;
}

/** Nombre de pièces qui tombent dans la barre (1 à 8, selon le montant). */
export const nbPieces = (prix: number) => Math.min(8, 1 + Math.round(Math.log2(1 + prix / 5) * 2));
