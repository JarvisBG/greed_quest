// RG-11.4 : enchères d'Antokiba côté app.

/** Offre minimale acceptable : la mise de départ, ou la meilleure offre + 1 J. */
export const offreMin = (e: { prixDepart: number; meilleureOffre: { montant: number } | null }) =>
  e.meilleureOffre ? e.meilleureOffre.montant + 1 : e.prixDepart;
