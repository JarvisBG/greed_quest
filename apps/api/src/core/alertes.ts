// Alertes anti-triche (RG-15) : le serveur alerte l'équipe, il ne sanctionne jamais seul.
import type { ActionCtx } from './runner.js';

export type AlerteType =
  | 'double_inscription'
  | 'vitesse'
  | 'photo_partagee'
  | 'echanges_desequilibres'
  | 'rythme_scan';

export async function alerte(c: ActionCtx, type: AlerteType, details: Record<string, unknown>): Promise<void> {
  await c.log({ action: 'alerte', resultat: type, details });
  c.emit({ type: 'staff' }, 'alerte', { type, heureJeu: c.now, ...details });
}
