// Page ⑨ : Pénétration (RG-10 Analyse, prototype validé par Sivraj le 2026-10-12 : docs/prototype/sorts-information.html).
// La page examinée telle que le Book la montrait avant le sort, et ce que chaque contrefaçon démasquée était (RG-8.9) :
// un doublon déguisé redevient sa vraie carte, une copie de Duplication devient « Contrefaçon de… », grisée.
// Le serveur décide (P1) : `demasquees` vient de la réponse de POST /sort.
import type { Rank } from '@gq/shared';
import { numeroCarte } from '@gq/ui';
import type { Carte, Emplacement, LivreRecu } from './livre';
import { enPhrase, type ReponseSort } from './sorts';

export type PochePenetration =
  | { type: 'vide' }
  | { type: 'absente'; numero: number | null; rang: Rank | null }
  | {
      type: 'carte';
      itemId: string;
      carte: Carte;
      /** Démasquée par ce sort : sa nature, sa vraie carte (doublon déguisé) et d'où elle venait (RG-8.8). */
      demasquee: { nature: 'copie' | 'deguise'; vraie: Carte | null; provenance: string } | null;
      /** Emplacement fixe : démasquée, la carte le quitte pour les emplacements libres (RG-8.9). */
      designe: boolean;
    };

export function pochesPenetration(l: LivreRecu, page: number, r: ReponseSort): PochePenetration[] {
  const demasquees = new Map((r.demasquees ?? []).map((d) => [d.itemId, d]));
  return (l.pages[page - 1] ?? []).map((e: Emplacement): PochePenetration => {
    if (e.etat === 'vide') return e.designe ? { type: 'absente', numero: e.carte.numero, rang: e.carte.rang } : { type: 'vide' };
    if (e.etat === 'perdu') return { type: 'absente', numero: e.carte.numero, rang: e.carte.rang };
    if (e.kind === 'sort') return { type: 'vide' };
    const d = demasquees.get(e.itemId);
    return {
      type: 'carte',
      itemId: e.itemId,
      carte: { numero: e.numero, nom: e.nom, rang: e.rang, limite: e.limite ?? null, texte: e.texte ?? null },
      demasquee: d ? { nature: d.nature, vraie: d.vraie, provenance: e.provenance } : null,
      designe: e.designe,
    };
  });
}

/** « du souffle du grand ange », « de la balance d'or », « de l'oreiller… », « des ciseaux… ». */
export function duNom(nom: string): string {
  if (/^Le\s/.test(nom)) return `du ${nom.slice(3)}`;
  if (/^Les\s/.test(nom)) return `des ${nom.slice(4)}`;
  if (/^La\s/.test(nom)) return `de la ${nom.slice(3)}`;
  if (/^L['’]/.test(nom)) return `de l’${nom.slice(2)}`;
  return `de ${nom}`;
}

/** Une ligne de la légende : ce que la carte démasquée était, et d'où elle venait. */
export function ligneDemasquee(p: Extract<PochePenetration, { type: 'carte' }>): string {
  const d = p.demasquee!;
  const qui = p.carte.numero !== null ? numeroCarte(p.carte.numero) : p.carte.nom;
  const de = d.provenance ? ` (${d.provenance})` : '';
  return d.nature === 'deguise' && d.vraie
    ? `${qui} était ${enPhrase(d.vraie.nom)} déguisée${de}.`
    : `${qui} : contrefaçon ${duNom(p.carte.nom)}${de}.`;
}

/** Titre de la légende, une fois la lumière passée. */
export function bilanPenetration(poches: readonly PochePenetration[]): { titre: string; lignes: string[] } {
  const l = poches.filter((p): p is Extract<PochePenetration, { type: 'carte' }> => p.type === 'carte' && p.demasquee !== null);
  if (l.length === 0) return { titre: 'Aucune contrefaçon sur cette page : tes cartes sont vraies.', lignes: [] };
  const partent = l.some((p) => p.designe);
  const titre = `${l.length > 1 ? `${l.length} cartes démasquées` : 'Une carte démasquée'}${partent ? `, rangée${l.length > 1 ? 's' : ''} dans tes emplacements libres` : ''} :`;
  return { titre, lignes: l.map(ligneDemasquee) };
}
