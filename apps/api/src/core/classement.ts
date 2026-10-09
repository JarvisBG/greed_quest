// Classement (RG-13.5, 13.7) : live pour l'écran géant, final (vraies cartes seulement) à la fin.
import { rank, type RankingEntry } from '@gq/engine';
import type { DbOrTx } from '../db/client.js';
import type { PartieRow } from './partie.js';
import { loadBooks, loadCatalogue, loadJoueurs } from './state.js';

export interface LigneClassement extends RankingEntry {
  pseudo: string;
}

export async function computeRanking(db: DbOrTx, partie: PartieRow, mode: 'live' | 'final'): Promise<LigneClassement[]> {
  const joueurs = await loadJoueurs(db, partie.id);
  const books = await loadBooks(db, joueurs.map((j) => j.id));
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
