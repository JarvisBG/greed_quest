// Sessions d'échange en base (RG-11.1 amendé) : une session active par joueur, cartes engagées verrouillées.
import { expireTradeSession, type TradeSession } from '@gq/engine';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import type { DbOrTx } from '../db/client.js';
import { echanges } from '../db/schema.js';

type EchangeRow = typeof echanges.$inferSelect;

export const sessionOf = (r: EchangeRow): TradeSession => ({
  id: r.id,
  a: r.a,
  b: r.b,
  etat: r.etat,
  derniereActionA: r.derniereActionA,
  donneA: r.donneA,
  donneB: r.donneB,
  valideA: r.valideA,
  valideB: r.valideB,
});

export async function saveSession(db: DbOrTx, partieId: string, s: TradeSession, concluA: number | null = null): Promise<void> {
  const row = { ...s, partieId, concluA };
  await db.insert(echanges).values(row).onConflictDoUpdate({ target: echanges.id, set: row });
}

/** Session encore ouverte (invitation ou composition, non expirée) d'un joueur ; les expirées sont marquées au passage. */
export async function activeSession(db: DbOrTx, partieId: string, joueurId: string, now: number): Promise<TradeSession | null> {
  const rows = await db
    .select()
    .from(echanges)
    .where(
      and(eq(echanges.partieId, partieId), inArray(echanges.etat, ['invitation', 'composition']), or(eq(echanges.a, joueurId), eq(echanges.b, joueurId))),
    );
  let active: TradeSession | null = null;
  for (const r of rows) {
    const s = expireTradeSession(sessionOf(r), now);
    if (s.etat === 'expire') await saveSession(db, partieId, s);
    else active = s;
  }
  return active;
}

/** Cartes qu'un joueur a engagées dans sa session en cours : il ne peut pas s'en servir ailleurs. */
export async function engagedItems(db: DbOrTx, partieId: string, joueurId: string, now: number): Promise<Set<string>> {
  const s = await activeSession(db, partieId, joueurId, now);
  if (!s) return new Set();
  return new Set(joueurId === s.a ? s.donneA.itemIds : s.donneB.itemIds);
}

/** RG-11.3 : heure du dernier échange conclu entre deux joueurs. */
export async function lastPairTrade(db: DbOrTx, partieId: string, x: string, y: string): Promise<number | null> {
  const [r] = await db
    .select({ a: echanges.concluA })
    .from(echanges)
    .where(
      and(
        eq(echanges.partieId, partieId),
        eq(echanges.etat, 'conclu'),
        or(and(eq(echanges.a, x), eq(echanges.b, y)), and(eq(echanges.a, y), eq(echanges.b, x))),
      ),
    )
    .orderBy(desc(echanges.concluA))
    .limit(1);
  return r?.a ?? null;
}

export const ENGAGEE = { ok: false as const, code: 'carte_engagee', message: 'Cette carte est engagée dans ton échange en cours' };
