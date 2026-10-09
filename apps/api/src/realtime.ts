// Temps réel (P5) : Socket.IO relaie les émissions du bus vers des rooms, selon la matrice
// « Diffusion temps réel » de REGLES.md. Lecture seule : les intentions passent par HTTP.
//
// Rooms d'une partie P :
//   P:joueur:<id>  un joueur (son détail : tirage, sort reçu, échange…)
//   P:joueurs      tous les joueurs (push d'événement, enchères)
//   P:staff        PNJ et GM (journal, alertes, carte des balises)
//   P:gm           GM seulement (positions exactes, RG-10.12)
//   P:tracker      écran géant, public (fil, classement, balises par zone)
import type { FastifyInstance } from 'fastify';
import { Server } from 'socket.io';
import type { Audience, Emission } from './core/bus.js';

export function roomOf(partieId: string, a: Audience): string {
  return a.type === 'joueur' ? `${partieId}:joueur:${a.id}` : `${partieId}:${a.type}`;
}

/** Rooms rejointes par une connexion, d'après son jeton (ou l'écran géant, sans jeton). */
export function roomsFor(session: { role: 'joueur' | 'pnj' | 'gm'; sub: string; partieId: string } | null, trackerPartieId?: string): string[] {
  if (session?.role === 'joueur') return [roomOf(session.partieId, { type: 'joueur', id: session.sub }), roomOf(session.partieId, { type: 'joueurs' })];
  if (session?.role === 'pnj') return [roomOf(session.partieId, { type: 'staff' })];
  if (session?.role === 'gm') return [roomOf(session.partieId, { type: 'staff' }), roomOf(session.partieId, { type: 'gm' })];
  if (trackerPartieId) return [roomOf(trackerPartieId, { type: 'tracker' })];
  return [];
}

export function attachRealtime(app: FastifyInstance, corsOrigin: string | boolean | string[]): Server {
  const io = new Server(app.server, { cors: { origin: corsOrigin } });

  io.use((socket, next) => {
    const auth = socket.handshake.auth as { token?: string; tracker?: string };
    const session = auth.token ? app.gq.tokens.verify(auth.token) : null;
    if (auth.token && !session) return next(new Error('Jeton invalide'));
    const rooms = roomsFor(session, auth.tracker);
    if (rooms.length === 0) return next(new Error('Connexion requise'));
    socket.data.rooms = rooms;
    next();
  });

  io.on('connection', (socket) => {
    for (const r of socket.data.rooms as string[]) void socket.join(r);
  });

  const off = app.gq.bus.on((e: Emission) => {
    io.to(roomOf(e.partieId, e.a)).emit(e.evenement, e.data);
  });
  app.addHook('onClose', async () => {
    off();
    await io.close();
  });
  return io;
}
