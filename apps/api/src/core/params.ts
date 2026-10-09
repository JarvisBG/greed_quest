// Service unique des paramètres dynamiques (RG-14) : résout Auto / Verrouillé / Multiplicateur.
// Aucun code métier ne lit une constante en dur à la place.
import {
  DEFAULT_SETTINGS,
  PARAM_KEYS,
  resolveParam,
  resolveParams,
  type ParamContext,
  type ParamKey,
  type ParamSettings,
  type ResolvedParam,
} from '@gq/engine';
import { and, count, eq } from 'drizzle-orm';
import type { DbOrTx } from '../db/client.js';
import { balises } from '../db/schema.js';
import type { PartieRow } from './partie.js';

/** Réglages de la partie ; une clé ajoutée après sa création reprend son réglage par défaut. */
export function settingsOf(p: PartieRow): ParamSettings {
  return { ...DEFAULT_SETTINGS, ...p.parametres };
}

export async function paramContext(db: DbOrTx, p: PartieRow): Promise<ParamContext> {
  const [posees] = await db.select({ n: count() }).from(balises).where(eq(balises.partieId, p.id));
  const [actives] = await db
    .select({ n: count() })
    .from(balises)
    .where(and(eq(balises.partieId, p.id), eq(balises.etat, 'active')));
  return { J: p.j.value, balisesPosees: posees?.n ?? 0, balisesActivesCourantes: actives?.n ?? 0 };
}

/** Valeurs appliquées de tous les paramètres. */
export async function paramsOf(db: DbOrTx, p: PartieRow): Promise<Record<ParamKey, number>> {
  return resolveParams(settingsOf(p), await paramContext(db, p));
}

/** RG-14.6 : vue console (J, valeur auto, mode, valeur appliquée). */
export async function paramsView(db: DbOrTx, p: PartieRow): Promise<ResolvedParam[]> {
  const ctx = await paramContext(db, p);
  const s = settingsOf(p);
  return PARAM_KEYS.map((k) => resolveParam(k, s[k], ctx));
}
