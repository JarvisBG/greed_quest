// Passage ligne `parties` ⇄ cycle de vie du moteur (RG-4).
import type { GameLifecycle } from '@gq/engine';
import type { parties } from '../db/schema.js';

export type PartieRow = typeof parties.$inferSelect;

export function lifecycleOf(p: PartieRow): GameLifecycle {
  return {
    etat: p.etat,
    etatAvantPause: p.etatAvantPause,
    inscriptionsOuvertes: p.inscriptionsOuvertes,
    demarreeA: p.demarreeA,
    pauseDepuis: p.pauseDepuis,
    pauseCumulee: p.pauseCumulee,
    termineeA: p.termineeA,
  };
}

/** Colonnes à écrire après une transition du moteur. */
export function lifecyclePatch(g: GameLifecycle): Partial<PartieRow> {
  return { ...g };
}
