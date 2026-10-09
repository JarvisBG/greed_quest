// Lecture d'un QR de balise (RG-6.1 : identifiant non devinable imprimé dans le QR).
// Deux formes acceptées : l'identifiant brut, ou un lien vers l'app `…?balise=<id>` (scanné
// avec l'appareil photo du téléphone, il ouvre l'app et lance le scan). Le serveur reste juge (P1).

const ID = /^[A-Za-z0-9_-]{6,100}$/;

export function lireQrBalise(texte: string): string | null {
  const t = texte.trim();
  if (ID.test(t)) return t;
  try {
    const id = new URL(t).searchParams.get('balise')?.trim();
    return id && ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Balise passée dans l'URL d'ouverture de l'app (`?balise=<id>`). */
export function baliseDepuisUrl(search: string): string | null {
  const id = new URLSearchParams(search).get('balise')?.trim();
  return id && ID.test(id) ? id : null;
}
