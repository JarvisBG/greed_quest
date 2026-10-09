// Arène de Soufrabi (amendement 2026-10-09, Sivraj) : source de hauts rangs tenue par un PNJ.
// Le PNJ scanne la licence du joueur (preuve de présence, RG-5.2) ; le joueur paie la mise en entrant.
// Le PNJ arbitre un défi physique ou d'adresse ; victoire = tirage A / S / SS, défaite = mise perdue.
// Une tentative par joueur toutes les `areneDelaiMin` minutes (comptées depuis l'entrée).
import type { PlayerStatus } from '@gq/shared';
import { DEFAULT_DRAW_CONFIG, draw, type CatalogCard, type DrawConfig, type DrawResult } from './draw.js';
import type { Rng } from './rng.js';

/** Tirage de l'arène : toujours une carte, A / S / SS en 50 / 40 / 10 (rang épuisé → rang inférieur, RG-8.3). */
export const ARENE_DRAW_CONFIG: DrawConfig = {
  ...DEFAULT_DRAW_CONFIG,
  nature: { ...DEFAULT_DRAW_CONFIG.nature, standard: { carte: 100, sort: 0, jenny: 0 } },
  rangs: { ...DEFAULT_DRAW_CONFIG.rangs, standard: { SS: 10, S: 40, A: 50 } },
};

export interface ArenaPlayer {
  statut: PlayerStatus;
  jenny: number;
  /** Heure de jeu de sa dernière entrée dans l'arène, null s'il n'y est jamais allé. */
  derniereEntreeA: number | null;
  /** Une tentative de ce joueur attend déjà son issue. */
  tentativeEnCours: boolean;
}

export type ArenaEntry =
  | { ok: true; mise: number }
  | { ok: false; code: 'joueur_bloque' | 'tentative_en_cours' | 'arene_delai' | 'jenny_insuffisants'; message: string };

const minutes = (ms: number) => Math.max(1, Math.ceil(ms / 60_000));

/** Le joueur peut-il entrer dans l'arène maintenant ? */
export function enterArena(p: ArenaPlayer, now: number, o: { mise: number; delaiMin: number }): ArenaEntry {
  if (p.statut === 'gele' || p.statut === 'disqualifie' || p.statut === 'abandon') {
    return { ok: false, code: 'joueur_bloque', message: 'Ce joueur ne peut pas entrer dans l’arène maintenant' };
  }
  if (p.tentativeEnCours) return { ok: false, code: 'tentative_en_cours', message: 'Ce joueur a déjà un défi en cours dans l’arène' };
  if (p.derniereEntreeA !== null) {
    const reste = p.derniereEntreeA + o.delaiMin * 60_000 - now;
    if (reste > 0) return { ok: false, code: 'arene_delai', message: `Prochaine tentative possible dans ${minutes(reste)} min` };
  }
  if (p.jenny < o.mise) return { ok: false, code: 'jenny_insuffisants', message: `Il faut ${o.mise} J pour entrer dans l’arène` };
  return { ok: true, mise: o.mise };
}

/** Victoire : tirage A / S / SS dans les limites d'exemplaires (RG-8.2). Tout épuisé → repli en jenny. */
export function arenaReward(catalogue: readonly CatalogCard[], limites: Parameters<typeof draw>[0]['limites'], rng: Rng): DrawResult {
  return draw({ beaconType: 'standard', tiragesPrecedents: 0, catalogue, limites }, rng, ARENE_DRAW_CONFIG);
}
