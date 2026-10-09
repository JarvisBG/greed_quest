import type { z } from 'zod';
import { Refus } from './errors.js';

/** Valide une requête ; le premier problème est renvoyé en clair (400). */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data ?? {});
  if (r.success) return r.data;
  const issue = r.error.issues[0];
  const champ = issue?.path.join('.') ?? '';
  throw new Refus('requete_invalide', `${champ ? `${champ} : ` : ''}${issue?.message ?? 'requête invalide'}`, 400);
}
