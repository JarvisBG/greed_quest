// RG-7.5 : scans faits sans réseau, mis en file avec leur heure, rejoués au retour.
// Le serveur les traite contre son état à la réception et refuse ceux de plus de 10 min ;
// l'app écarte elle-même ceux qui sont déjà trop vieux (refus garanti, inutile de l'envoyer).
import type { PositionInput } from '@gq/shared';

export const AGE_MAX_MS = 10 * 60_000;
const CLE = 'gq.fileScans';

export interface ScanEnAttente {
  partieId: string;
  baliseId: string;
  position: PositionInput;
  /** Heure réelle du téléphone au moment du scan (ms). */
  scanneA: number;
}

export function createFile(storage: Pick<Storage, 'getItem' | 'setItem'>) {
  const lire = (): ScanEnAttente[] => {
    try {
      const l = JSON.parse(storage.getItem(CLE) ?? '[]') as unknown;
      return Array.isArray(l) ? (l as ScanEnAttente[]) : [];
    } catch {
      return [];
    }
  };
  const ecrire = (l: ScanEnAttente[]) => storage.setItem(CLE, JSON.stringify(l));
  return {
    lire,
    /** Une même balise n'est gardée qu'une fois (le premier scan, le plus ancien). */
    ajouter(s: ScanEnAttente): boolean {
      const l = lire();
      if (l.some((x) => x.partieId === s.partieId && x.baliseId === s.baliseId)) return false;
      ecrire([...l, s]);
      return true;
    },
    retirer(s: ScanEnAttente): void {
      ecrire(lire().filter((x) => !(x.partieId === s.partieId && x.baliseId === s.baliseId && x.scanneA === s.scanneA)));
    },
    /** Scans de la partie à rejouer, du plus ancien au plus récent, et ceux devenus trop vieux. */
    aRejouer(partieId: string, now: number): { valides: ScanEnAttente[]; perimes: ScanEnAttente[] } {
      const l = lire()
        .filter((x) => x.partieId === partieId)
        .sort((a, b) => a.scanneA - b.scanneA);
      return { valides: l.filter((x) => now - x.scanneA < AGE_MAX_MS), perimes: l.filter((x) => now - x.scanneA >= AGE_MAX_MS) };
    },
  };
}

export type FileScans = ReturnType<typeof createFile>;
