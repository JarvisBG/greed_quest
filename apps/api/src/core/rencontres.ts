// Rencontres entre joueurs (amendement 2026-10-09, sort Regard) : deux joueurs se sont « croisés » quand ils ont
// été à portée l'un de l'autre (même rayon que les sorts et les échanges), ou quand l'un a visé l'autre par un sort.
import { estInvisible, isInRange, isValidPosition, type Position, type RangeSettings } from '@gq/engine';
import { and, eq, or } from 'drizzle-orm';
import { rencontres } from '../db/schema.js';
import type { DbOrTx } from '../db/client.js';
import type { ActionCtx } from './runner.js';
import { loadJoueurs } from './state.js';

const paire = (x: string, y: string) => (x < y ? { a: x, b: y } : { a: y, b: x });

export async function noterRencontre(c: ActionCtx, x: string, y: string): Promise<void> {
  if (x === y) return;
  await c.tx.insert(rencontres).values({ partieId: c.partie.id, ...paire(x, y), premiereA: c.now }).onConflictDoNothing();
}

/** Après une nouvelle position : rencontre avec chaque joueur à portée dont la position est récente (RG-7.6). */
export async function noterRencontresProches(c: ActionCtx, joueurId: string, pos: Position, portee: RangeSettings): Promise<void> {
  const autres = await loadJoueurs(c.tx, c.partie.id, [joueurId]);
  for (const o of autres) {
    if (o.statut === 'disqualifie' || o.statut === 'abandon' || estInvisible(o, c.now)) continue; // Zetsu : personne ne le croise
    if (isValidPosition(o.position, c.now) && isInRange(pos, o.position, portee)) await noterRencontre(c, joueurId, o.id);
  }
}

export async function seSontRencontres(db: DbOrTx, x: string, y: string): Promise<boolean> {
  const { a, b } = paire(x, y);
  const rows = await db.select({ a: rencontres.a }).from(rencontres).where(and(eq(rencontres.a, a), eq(rencontres.b, b))).limit(1);
  return rows.length > 0;
}

/** Joueurs déjà croisés (pour la liste des cibles de Regard). */
export async function rencontresDe(db: DbOrTx, joueurId: string): Promise<string[]> {
  const rows = await db.select().from(rencontres).where(or(eq(rencontres.a, joueurId), eq(rencontres.b, joueurId)));
  return rows.map((r) => (r.a === joueurId ? r.b : r.a));
}
