// Journal (RG-3.1, P5) : chaque action d'état écrit une ligne dans la même transaction que l'action.
import type { DbOrTx } from '../db/client.js';
import { journal, type ActeurType } from '../db/schema.js';

export interface Acteur {
  type: ActeurType;
  id: string | null;
}

export const SYSTEME: Acteur = { type: 'systeme', id: null };

/**
 * RG-3.1 : motif obligatoire pour les corrections et sanctions d'un PNJ ou du GM.
 * (Les autres actions de l'équipe sont journalisées avec leur auteur, motif facultatif.)
 */
export const ACTIONS_AVEC_MOTIF: ReadonlySet<string> = new Set([
  'correction_livre',
  'correction_jenny',
  'avertissement',
  'gel_sanction',
  'annulation_gains',
  'disqualification',
]);

export interface LogEntry {
  action: string;
  /** « ok », « refus », ou un résultat plus précis (« bloque », « sans_effet »…). */
  resultat: string;
  motif?: string | undefined;
  details?: Record<string, unknown> | undefined;
}

export class MotifManquant extends Error {
  constructor(action: string) {
    super(`Motif obligatoire pour l’action « ${action} »`);
  }
}

export type JournalRow = typeof journal.$inferSelect;

export async function writeLog(db: DbOrTx, partieId: string, heureJeu: number, acteur: Acteur, e: LogEntry): Promise<JournalRow> {
  // RG-3.1
  if ((acteur.type === 'pnj' || acteur.type === 'gm') && ACTIONS_AVEC_MOTIF.has(e.action) && !e.motif?.trim()) {
    throw new MotifManquant(e.action);
  }
  const [row] = await db.insert(journal).values({
    partieId,
    heureJeu,
    acteurType: acteur.type,
    acteurId: acteur.id,
    action: e.action,
    resultat: e.resultat,
    motif: e.motif?.trim() || null,
    details: e.details ?? null,
  }).returning();
  return row!;
}
