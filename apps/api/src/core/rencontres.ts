// Rencontres entre joueurs (amendement 2026-10-09, sort Regard) : deux joueurs se sont « croisés » quand ils ont
// été à portée l'un de l'autre (même rayon que les sorts et les échanges), ou quand l'un a visé l'autre par un sort.
import { estInvisible, isInRange, isValidPosition, type Position, type RangeSettings } from '@gq/engine';
import { and, eq, ne, or, sql } from 'drizzle-orm';
import { joueurs, rencontres } from '../db/schema.js';
import type { DbOrTx } from '../db/client.js';
import type { ActionCtx } from './runner.js';

const paire = (x: string, y: string) => (x < y ? { a: x, b: y } : { a: y, b: x });

export async function noterRencontre(c: ActionCtx, x: string, y: string): Promise<void> {
  if (x === y) return;
  await c.tx.insert(rencontres).values({ partieId: c.partie.id, ...paire(x, y), premiereA: c.now }).onConflictDoNothing();
}

/** Après une nouvelle position : rencontre avec chaque joueur à portée dont la position est récente (RG-7.6). */
export async function noterRencontresProches(c: ActionCtx, joueurId: string, pos: Position, portee: RangeSettings): Promise<void> {
  // Appelé à chaque position (toutes les 15 s par joueur) : la base ne rend que les joueurs dans un carré autour
  // de la position (portée + marge, avec du jeu), colonnes utiles seulement ; le calcul exact se fait ensuite.
  const m = portee.porteeM + portee.margeMaxM + 20;
  const dLat = m / 110_540;
  const dLng = m / (111_320 * Math.max(0.1, Math.cos((pos.lat * Math.PI) / 180)));
  const autres = await c.tx
    .select({ id: joueurs.id, statut: joueurs.statut, position: joueurs.position, zetsuJusqua: joueurs.zetsuJusqua })
    .from(joueurs)
    .where(
      and(
        eq(joueurs.partieId, c.partie.id),
        ne(joueurs.id, joueurId),
        sql`abs((${joueurs.position}->>'lat')::float8 - ${pos.lat}) <= ${dLat}`,
        sql`abs((${joueurs.position}->>'lng')::float8 - ${pos.lng}) <= ${dLng}`,
      ),
    );
  const proches = autres.filter(
    (o) => o.statut !== 'disqualifie' && o.statut !== 'abandon' && !estInvisible(o, c.now) && isValidPosition(o.position, c.now) && isInRange(pos, o.position, portee),
  ); // Zetsu : personne ne le croise
  if (proches.length === 0) return;
  await c.tx
    .insert(rencontres)
    .values(proches.map((o) => ({ partieId: c.partie.id, ...paire(joueurId, o.id), premiereA: c.now })))
    .onConflictDoNothing();
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
