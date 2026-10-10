// Pouvoirs de Nen (RG-5.4) amendés le 2026-10-10 (Sivraj) : recharge au lieu de « une fois par partie »,
// et réserve de Matérialisation (un tirage bonus toutes les 40 min, même sans checkpoint).
import type { NenType } from '@gq/shared';
import { DEFAULT_DRAW_CONFIG, type DrawConfig } from './draw.js';
import type { NenPower } from './spells.js';

/** RG-5.4 Matérialisation : tirage bonus plafonné au rang C (checkpoint réussi, ou réserve). */
export const BONUS_MATERIALISATION: DrawConfig = { ...DEFAULT_DRAW_CONFIG, rangs: { ...DEFAULT_DRAW_CONFIG.rangs, standard: { C: 25, D: 40 } } };

/** Recharges (ms) à passer dans le monde des sorts, depuis les paramètres RG-14. */
export function rechargesNenMs(p: { rechargeRenforcementMin: number; rechargeEmissionMin: number; rechargeManipulationMin: number }): Record<NenPower, number> {
  return {
    renforcement: p.rechargeRenforcementMin * 60_000,
    emission: p.rechargeEmissionMin * 60_000,
    manipulation: p.rechargeManipulationMin * 60_000,
  };
}

/**
 * Réserve de Matérialisation : due quand `intervalleMs` s'est écoulé depuis le dernier tirage de réserve
 * (ou depuis l'inscription). Temps restant en ms (0 = due), null si le joueur n'est pas Matérialisation.
 */
export function reserveMaterialisationDans(
  j: { nen: NenType | null; derniereReserveA: number | null; inscritA: number },
  now: number,
  intervalleMs: number,
): number | null {
  if (j.nen !== 'materialisation') return null;
  return Math.max(0, (j.derniereReserveA ?? j.inscritA) + intervalleMs - now);
}
