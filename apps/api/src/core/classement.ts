// Classement (RG-13.5, 13.7) : live pour l'écran géant, final (vraies cartes seulement) à la fin.
import { rank, type RankingEntry } from '@gq/engine';
import type { DbOrTx } from '../db/client.js';
import type { PartieRow } from './partie.js';
import { eq } from 'drizzle-orm';
import { joueurs as tJoueurs } from '../db/schema.js';
import { loadCartesClassement, loadCatalogue } from './state.js';

export interface LigneClassement extends RankingEntry {
  pseudo: string;
}

export async function computeRanking(db: DbOrTx, partie: PartieRow, mode: 'live' | 'final'): Promise<LigneClassement[]> {
  // Lu toutes les 30 s pour l'écran géant : seulement ce que le classement utilise (offre gratuite de la base).
  const joueurs = await db.select({ id: tJoueurs.id, pseudo: tJoueurs.pseudo, statut: tJoueurs.statut, jenny: tJoueurs.jenny }).from(tJoueurs).where(eq(tJoueurs.partieId, partie.id));
  const books = await loadCartesClassement(db, joueurs.map((j) => j.id));
  const cat = await loadCatalogue(db, partie.id);
  const pseudo = new Map(joueurs.map((j) => [j.id, j.pseudo]));
  const entries = rank(
    joueurs.map((j) => ({ id: j.id, status: j.statut, book: books.get(j.id)!, jenny: j.jenny })),
    cat.designees,
    mode,
    cat.rangDe,
  );
  return entries.map((e) => ({ ...e, pseudo: pseudo.get(e.playerId) ?? '?' }));
}

/** Ce que l'écran géant affiche : ni jenny ni heure (seulement ce qui se voit). */
export const publicRanking = (lignes: readonly LigneClassement[]) =>
  lignes.map((l) => ({ place: l.place, pseudo: l.pseudo, cartes: l.cartes, points: l.points }));
