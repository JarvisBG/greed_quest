// Amendement 2026-10-10 : Accompagnement. Le lanceur reçoit la position exacte de sa cible pendant 3 min
// (évènement `accompagnement`, GET /accompagnement) ; l'app en tire distance et direction depuis sa propre position.
import { direction, distanceM, type Direction } from '@gq/engine';

export interface SuiviCible {
  cibleId: string;
  pseudo: string;
  /** Position exacte de la cible (null si elle n'en a encore envoyé aucune). */
  position: { lat: number; lng: number; precisionM: number } | null;
  /** Temps restant à la réception, en ms. */
  resteMs: number;
  recuA: number;
}

const DIRECTIONS: Record<Direction, string> = {
  N: 'au nord',
  NE: 'au nord-est',
  E: 'à l’est',
  SE: 'au sud-est',
  S: 'au sud',
  SO: 'au sud-ouest',
  O: 'à l’ouest',
  NO: 'au nord-ouest',
};

/** Temps restant du suivi, décompté localement. */
export const resteSuivi = (s: SuiviCible, maintenant: number) => Math.max(0, s.resteMs - (maintenant - s.recuA));

/** « Kirua : 120 m au nord-est », arrondi à 10 m ; « tout près » sous la précision du GPS. */
export function reperage(moi: { lat: number; lng: number } | null, s: SuiviCible): string {
  if (!s.position) return `${s.pseudo} : position pas encore connue`;
  if (!moi) return `${s.pseudo} : active ta localisation pour le suivre`;
  const d = distanceM(moi, s.position);
  if (d <= Math.max(10, s.position.precisionM)) return `${s.pseudo} est tout près`;
  return `${s.pseudo} : ${Math.round(d / 10) * 10} m ${DIRECTIONS[direction(moi, s.position)]}`;
}
