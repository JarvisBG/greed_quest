// Licence QR tournante (RG-5.2) : renouvelée toutes les 30 s, signée avec le secret du joueur.
// Format : `GQL1.<joueurId>.<fenêtre>.<signature>`, fenêtre = floor(heure réelle / 30 s),
// signature = HMAC-SHA256(secret du joueur, `<joueurId>.<fenêtre>`) en base64url, 22 caractères.
// L'app peut la calculer hors ligne (WebCrypto) avec le secret reçu à la connexion.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { DbOrTx } from '../db/client.js';
import { joueurs } from '../db/schema.js';

export const LICENCE_PERIOD_MS = 30_000; // RG-5.2
/** Fenêtres acceptées de part et d'autre de la fenêtre courante (horloge du téléphone, délai de scan). */
export const LICENCE_TOLERANCE = 1;

const signature = (secret: string, joueurId: string, fenetre: number) =>
  createHmac('sha256', secret).update(`${joueurId}.${fenetre}`).digest('base64url').slice(0, 22);

export function licenceCode(joueurId: string, secret: string, realNow: number): { qr: string; expireA: number } {
  const fenetre = Math.floor(realNow / LICENCE_PERIOD_MS);
  return { qr: `GQL1.${joueurId}.${fenetre}.${signature(secret, joueurId, fenetre)}`, expireA: (fenetre + 1) * LICENCE_PERIOD_MS };
}

export type LicenceCheck =
  | { ok: true; joueur: typeof joueurs.$inferSelect }
  | { ok: false; code: 'licence_invalide' | 'licence_expiree'; message: string };

/** Vérifie une licence scannée par un PNJ ou le GM. */
export async function verifyLicence(db: DbOrTx, partieId: string, qr: string, realNow: number): Promise<LicenceCheck> {
  const invalide = { ok: false as const, code: 'licence_invalide' as const, message: 'Licence invalide' };
  const [prefixe, joueurId, f, sig] = qr.trim().split('.');
  const fenetre = Number(f);
  if (prefixe !== 'GQL1' || !joueurId || !sig || !Number.isInteger(fenetre)) return invalide;
  const [joueur] = await db.select().from(joueurs).where(and(eq(joueurs.id, joueurId), eq(joueurs.partieId, partieId)));
  if (!joueur) return invalide;
  const attendu = Buffer.from(signature(joueur.licenceSecret, joueurId, fenetre));
  const recu = Buffer.from(sig);
  if (attendu.length !== recu.length || !timingSafeEqual(attendu, recu)) return invalide;
  if (Math.abs(Math.floor(realNow / LICENCE_PERIOD_MS) - fenetre) > LICENCE_TOLERANCE) {
    return { ok: false, code: 'licence_expiree', message: 'Licence expirée : demande au joueur de la rafraîchir' };
  }
  return { ok: true, joueur };
}
