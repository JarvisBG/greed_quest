// RG-5.2 : licence QR tournante, calculée sur le téléphone (aussi hors ligne) avec le secret reçu
// par `/moi`. Même format que l'API (apps/api/src/core/licence.ts) :
// `GQL1.<joueurId>.<fenêtre>.<signature>`, fenêtre = floor(heure / 30 s),
// signature = HMAC-SHA256(secret, `<joueurId>.<fenêtre>`) en base64url, 22 caractères.

export const PERIODE_MS = 30_000;

function base64url(bytes: ArrayBuffer): string {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function calculerLicence(joueurId: string, secret: string, maintenant: number): Promise<{ qr: string; expireA: number }> {
  const fenetre = Math.floor(maintenant / PERIODE_MS);
  const enc = new TextEncoder();
  const cle = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = base64url(await crypto.subtle.sign('HMAC', cle, enc.encode(`${joueurId}.${fenetre}`))).slice(0, 22);
  return { qr: `GQL1.${joueurId}.${fenetre}.${sig}`, expireA: (fenetre + 1) * PERIODE_MS };
}

/**
 * Décalage entre l'horloge du serveur et celle du téléphone, estimé avec `GET /licence`
 * (son `expireA` est la fin de la fenêtre serveur courante) : précis à ±30 s près, ce qui
 * suffit puisque l'équipe tolère une fenêtre d'écart. Utile si l'heure du téléphone est fausse.
 */
export function decalage(expireAServeur: number, maintenant: number): number {
  const fenetreLocale = Math.floor(maintenant / PERIODE_MS);
  const fenetreServeur = expireAServeur / PERIODE_MS - 1;
  return (fenetreServeur - fenetreLocale) * PERIODE_MS;
}
