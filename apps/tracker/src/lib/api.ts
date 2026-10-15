// Écran géant : état complet à l'ouverture (public), puis la room tracker prend le relais.
import { io, type Socket } from 'socket.io-client';
import type { EtatEcran } from './types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export async function chargerEcran(partieId: string): Promise<EtatEcran> {
  const r = await fetch(`${BASE}/parties/${encodeURIComponent(partieId)}/ecran`);
  if (!r.ok) throw new Error(r.status === 404 ? 'Partie introuvable' : `Erreur ${r.status}`);
  return (await r.json()) as EtatEcran;
}

/** Évènements de la room tracker (apps/api/src/core/bus.ts, émissions `{ type: 'tracker' }`). */
export const EVENEMENTS_ECRAN = [
  'partie', 'classement', 'classement_final', 'progression', 'heatmap', 'halos', 'balises_par_zone', 'scans_zones',
  'evenement', 'evenement_fin', 'raid', 'fil', 'clear', 'joueur_inscrit',
] as const;
export type EvenementEcranNom = (typeof EVENEMENTS_ECRAN)[number];

export function connecterEcran(
  partieId: string,
  h: { enLigne: (on: boolean) => void; reconnecte: () => void; evenement: (nom: EvenementEcranNom, data: unknown) => void },
): () => void {
  const socket: Socket = io(BASE || undefined, { auth: { tracker: partieId }, transports: ['websocket', 'polling'] });
  let deja = false;
  socket.on('connect', () => {
    h.enLigne(true);
    // Après une coupure, on recharge l'état complet : rien de ce qui s'est passé entre-temps n'est perdu.
    if (deja) h.reconnecte();
    deja = true;
  });
  socket.on('disconnect', () => h.enLigne(false));
  socket.on('connect_error', () => h.enLigne(false));
  for (const nom of EVENEMENTS_ECRAN) socket.on(nom, (data: unknown) => h.evenement(nom, data));
  return () => socket.close();
}
