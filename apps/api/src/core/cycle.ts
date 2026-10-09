// Transitions du cycle de vie (RG-4) : enregistrement, journal, diffusion, classement figé à la fin (RG-4.6).
import type { GameLifecycle, Transition } from '@gq/engine';
import { eq } from 'drizzle-orm';
import { parties } from '../db/schema.js';
import { computeRanking, publicRanking } from './classement.js';
import { lifecyclePatch } from './partie.js';
import type { ActionCtx } from './runner.js';

export async function applyLifecycle(c: ActionCtx, game: GameLifecycle, transitions: readonly Transition[], motif?: string): Promise<void> {
  const patch: Partial<typeof parties.$inferInsert> = lifecyclePatch(game);
  const fin = transitions.some((t) => t.vers === 'terminee');
  if (fin) {
    // RG-4.6 / RG-13.7 : classement final, vraies cartes seulement, figé.
    patch.classementFinal = await computeRanking(c.tx, { ...c.partie, ...patch } as typeof c.partie, 'final');
  }
  await c.tx.update(parties).set(patch).where(eq(parties.id, c.partie.id));
  Object.assign(c.partie, patch);
  for (const t of transitions) {
    await c.log({ action: 'cycle_de_vie', resultat: t.vers, motif, details: { ...t } });
    const info = { etat: t.vers, de: t.de, cause: t.cause, heureJeu: t.a, inscriptionsOuvertes: game.inscriptionsOuvertes };
    c.emit({ type: 'joueurs' }, 'partie', info);
    c.emit({ type: 'staff' }, 'partie', info);
    c.emit({ type: 'tracker' }, 'partie', info);
  }
  if (fin && c.partie.classementFinal) {
    const classement = publicRanking(c.partie.classementFinal);
    c.emit({ type: 'tracker' }, 'classement_final', classement);
    c.emit({ type: 'joueurs' }, 'classement_final', classement);
    c.emit({ type: 'staff' }, 'classement_final', c.partie.classementFinal);
  }
}
