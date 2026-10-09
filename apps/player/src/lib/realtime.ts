// Temps réel (lecture seule) : le serveur pousse les évènements du joueur et de tous les
// joueurs (rooms `P:joueur:<id>` et `P:joueurs`, apps/api/src/realtime.ts).
import { io, type Socket } from 'socket.io-client';

/** Évènements poussés aux joueurs par l'API. */
export const EVENEMENTS_JOUEUR = [
  'tirage', 'perte', 'sort_recu', 'malediction', 'carte_maudite', 'echange', 'boutique',
  'enchere', 'enchere_close', 'enchere_gagnee', 'evenement', 'evenement_fin', 'mission',
  'mission_reussie', 'recompense_raid', 'checkpoint', 'expertise', 'correction', 'sanction',
  'degel', 'partie', 'clear', 'clear_confirme', 'clear_refuse', 'classement_final',
] as const;
export type EvenementJoueur = (typeof EVENEMENTS_JOUEUR)[number];

export type EtatConnexion = 'connexion' | 'en_ligne' | 'hors_ligne';

export interface Temps {
  socket: Socket;
  close(): void;
}

export function connectRealtime(
  baseUrl: string,
  token: string,
  handlers: { etat: (e: EtatConnexion) => void; evenement: (nom: EvenementJoueur, data: unknown) => void },
): Temps {
  const socket = io(baseUrl || undefined, { auth: { token }, transports: ['websocket', 'polling'] });
  handlers.etat('connexion');
  socket.on('connect', () => handlers.etat('en_ligne'));
  socket.on('disconnect', () => handlers.etat('hors_ligne'));
  socket.on('connect_error', () => handlers.etat('hors_ligne'));
  for (const nom of EVENEMENTS_JOUEUR) socket.on(nom, (data: unknown) => handlers.evenement(nom, data));
  return { socket, close: () => socket.close() };
}
