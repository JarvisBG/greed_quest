// Temps réel (lecture seule) : rooms `P:staff` (PNJ et GM) et `P:gm` (GM seulement),
// apps/api/src/realtime.ts. Les actions passent par HTTP.
import { io, type Socket } from 'socket.io-client';

/** Évènements poussés à l'équipe par l'API. */
export const EVENEMENTS_EQUIPE = [
  'journal', 'alerte', 'balises', 'classement_final', 'demande_clear', 'enchere', 'enchere_close',
  'evenement', 'evenement_fin', 'j', 'joueur_inscrit', 'parametre', 'partie', 'raid', 'recompenses',
  // GM seulement
  'position', 'proposition_evenement',
] as const;
export type EvenementEquipe = (typeof EVENEMENTS_EQUIPE)[number];

export type EtatConnexion = 'connexion' | 'en_ligne' | 'hors_ligne';

export interface Temps {
  socket: Socket;
  close(): void;
}

export function connectRealtime(
  baseUrl: string,
  token: string,
  handlers: { etat: (e: EtatConnexion) => void; evenement: (nom: EvenementEquipe, data: unknown) => void },
): Temps {
  const socket = io(baseUrl || undefined, { auth: { token }, transports: ['websocket', 'polling'] });
  handlers.etat('connexion');
  socket.on('connect', () => handlers.etat('en_ligne'));
  socket.on('disconnect', () => handlers.etat('hors_ligne'));
  socket.on('connect_error', () => handlers.etat('hors_ligne'));
  for (const nom of EVENEMENTS_EQUIPE) socket.on(nom, (data: unknown) => handlers.evenement(nom, data));
  return { socket, close: () => socket.close() };
}
