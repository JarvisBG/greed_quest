// Temps réel (lecture seule) : le serveur pousse les évènements du joueur et de tous les
// joueurs (rooms `P:joueur:<id>` et `P:joueurs`, apps/api/src/realtime.ts).
import type { PositionInput } from '@gq/shared';
import { io, type Socket } from 'socket.io-client';
import { ApiError } from './api';

/** Évènements poussés aux joueurs par l'API. */
export const EVENEMENTS_JOUEUR = [
  'tirage', 'perte', 'sort_recu', 'malediction', 'carte_maudite', 'echange', 'boutique',
  'enchere', 'enchere_close', 'enchere_gagnee', 'evenement', 'evenement_fin', 'mission',
  'mission_reussie', 'recompense_raid', 'checkpoint', 'reserve', 'expertise', 'correction', 'sanction',
  'degel', 'partie', 'clear', 'clear_confirme', 'clear_refuse', 'classement_final', 'raid', 'arene', 'accompagnement',
  // RG-8.15 à 8.21 : cartes de Maître du jeu.
  'carte_gm_jouee', 'carte_gm_recue', 'carte_gm_obtenue', 'carte_gm_rendue',
  // RG-5.1 amendé : partie reprise sur un autre téléphone.
  'session_remplacee',
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
  // WebSocket d'abord ; si le réseau mobile le bloque, repli sur le mode « polling » (sans tryAllTransports,
  // Socket.IO réessaie le WebSocket sans fin et le téléphone reste hors ligne).
  const socket = io(baseUrl || undefined, { auth: { token }, transports: ['websocket', 'polling'], tryAllTransports: true });
  handlers.etat('connexion');
  socket.on('connect', () => handlers.etat('en_ligne'));
  socket.on('disconnect', () => handlers.etat('hors_ligne'));
  socket.on('connect_error', () => handlers.etat('hors_ligne'));
  for (const nom of EVENEMENTS_JOUEUR) socket.on(nom, (data: unknown) => handlers.evenement(nom, data));
  return { socket, close: () => socket.close() };
}

/**
 * RG-10.9 : position envoyée par la connexion temps réel déjà ouverte (pas de requête HTTP, ce qui ménage la limite
 * du relais Cloudflare) ; sans connexion, ou sans réponse en 8 s, repli sur la requête HTTP.
 */
export async function envoyerPosition(socket: Socket | null, p: PositionInput, parHttp: () => Promise<unknown>): Promise<unknown> {
  if (!socket?.connected) return parHttp();
  let r: { ok?: boolean; code?: string; message?: string };
  try {
    r = await socket.timeout(8_000).emitWithAck('position', p);
  } catch {
    return parHttp();
  }
  if (r?.ok === false) throw new ApiError(r.code ?? 'erreur', r.message ?? 'Erreur du serveur', 409);
  return r;
}
