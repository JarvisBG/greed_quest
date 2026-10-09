// Positions des joueurs (RG-10.9 à 10.12) : enregistrées à chaque envoi et à chaque scan / achat / sort.
// Jamais renvoyées aux joueurs ni à l'écran géant (RG-10.12) : seul le GM les reçoit.
import { isImpossibleMove, speedKmh, type Position } from '@gq/engine';
import type { PositionInput } from '@gq/shared';
import { alerte } from './alertes.js';
import type { ActionCtx } from './runner.js';
import { updateJoueur, type JoueurRow } from './state.js';

/**
 * Enregistre la position (heure de jeu `a`) ; RG-15 : alerte si le déplacement depuis la position
 * précédente est impossible à pied. Retourne la position reçue (celle de l'action).
 */
export async function recordPosition(c: ActionCtx, j: JoueurRow, input: PositionInput, a = c.now): Promise<Position> {
  const pos: Position = { lat: input.lat, lng: input.lng, precisionM: input.precisionM, a };
  const prev = j.position;
  // Un scan hors ligne (RG-7.5) peut arriver avec une position plus ancienne que la dernière connue.
  if (prev && a < prev.a) return pos;
  if (prev && isImpossibleMove(prev, pos)) {
    await alerte(c, 'vitesse', { joueurId: j.id, pseudo: j.pseudo, vitesseKmh: Math.round(speedKmh(prev, pos) ?? 0) });
  }
  await updateJoueur(c.tx, j.id, { position: pos });
  j.position = pos;
  c.emit({ type: 'gm' }, 'position', { joueurId: j.id, ...pos });
  return pos;
}
