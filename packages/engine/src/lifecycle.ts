// Cycle de vie d'une partie (RG-4) et horloge de jeu.
// L'horloge de jeu part de 0 au démarrage et s'arrête pendant la pause : tous les délais
// du moteur (gels, immunités, recharges, vagues, événements) l'utilisent, donc la pause
// les suspend sans traitement particulier (RG-4.4).
import type { GameState } from '@gq/shared';

export const FINAL_PHASE_BEFORE_END_MS = 30 * 60_000; // RG-4.5

export interface GameLifecycle {
  etat: GameState;
  /** État à retrouver en sortie de pause. */
  etatAvantPause: 'en_cours' | 'phase_finale' | null;
  /** RG-4.3 : inscriptions ouvertes pendant la partie, jusqu'à ce que le GM les ferme. */
  inscriptionsOuvertes: boolean;
  /** Heure réelle du démarrage (ms), null avant. */
  demarreeA: number | null;
  /** Heure réelle du début de la pause en cours, null hors pause. */
  pauseDepuis: number | null;
  /** Durée réelle totale des pauses terminées. */
  pauseCumulee: number;
  /** Heure de jeu de la fin, null tant que la partie n'est pas terminée. */
  termineeA: number | null;
}

export const newGame = (): GameLifecycle => ({
  etat: 'brouillon',
  etatAvantPause: null,
  inscriptionsOuvertes: false,
  demarreeA: null,
  pauseDepuis: null,
  pauseCumulee: 0,
  termineeA: null,
});

/** Heure de jeu (ms depuis le démarrage, pauses exclues). 0 avant le démarrage. */
export function gameClock(g: GameLifecycle, realNow: number): number {
  if (g.demarreeA === null) return 0;
  const fin = g.pauseDepuis ?? realNow;
  return Math.max(0, fin - g.demarreeA - g.pauseCumulee);
}

/** RG-4.2 / 4.3 / 4.5 : peut-on s'inscrire maintenant ? */
export function canRegister(g: GameLifecycle): boolean {
  if (g.etat === 'inscriptions') return true;
  return (g.etat === 'en_cours' || g.etat === 'pause') && g.inscriptionsOuvertes;
}

export type GmAction =
  | 'ouvrir_inscriptions'
  | 'demarrer'
  | 'pause'
  | 'reprendre'
  | 'phase_finale'
  | 'terminer'
  | 'fermer_inscriptions';

export interface Transition {
  de: GameState;
  vers: GameState;
  cause: GmAction | 'auto_phase_finale' | 'auto_fin_du_temps' | 'clear';
  /** Heure de jeu de la transition. */
  a: number;
}

export type LifecycleResult =
  | { ok: true; game: GameLifecycle; transition: Transition | null }
  | { ok: false; message: string };

const refuse = (message: string): LifecycleResult => ({ ok: false, message });

function move(g: GameLifecycle, realNow: number, vers: GameState, cause: Transition['cause'], patch: Partial<GameLifecycle> = {}): LifecycleResult {
  const transition: Transition = { de: g.etat, vers, cause, a: gameClock(g, realNow) };
  let next: GameLifecycle = { ...g, ...patch, etat: vers };
  // RG-4.5 : la phase finale ferme les inscriptions ; une partie terminée aussi.
  if (vers === 'phase_finale' || vers === 'terminee') next = { ...next, inscriptionsOuvertes: false };
  if (vers === 'terminee') next = { ...next, termineeA: transition.a };
  return { ok: true, game: next, transition };
}

/** Sort de pause : l'horloge de jeu reprend là où elle s'était arrêtée. */
function unpause(g: GameLifecycle, realNow: number): Partial<GameLifecycle> {
  return { pauseCumulee: g.pauseCumulee + (realNow - (g.pauseDepuis ?? realNow)), pauseDepuis: null, etatAvantPause: null };
}

/** Actions du GM (RG-4). Toute action est journalisée par l'appelant avec son auteur (RG-3.1). */
export function applyGmAction(g: GameLifecycle, action: GmAction, realNow: number): LifecycleResult {
  switch (action) {
    case 'ouvrir_inscriptions':
      if (g.etat !== 'brouillon') return refuse('Les inscriptions ne s’ouvrent que depuis le brouillon');
      return move(g, realNow, 'inscriptions', action, { inscriptionsOuvertes: true });

    case 'demarrer':
      if (g.etat !== 'inscriptions') return refuse('La partie démarre depuis les inscriptions');
      return move(g, realNow, 'en_cours', action, { demarreeA: realNow });

    case 'fermer_inscriptions':
      if (!g.inscriptionsOuvertes || g.etat === 'inscriptions') return refuse('Aucune inscription en cours à fermer');
      return { ok: true, game: { ...g, inscriptionsOuvertes: false }, transition: null };

    case 'pause':
      if (g.etat !== 'en_cours' && g.etat !== 'phase_finale') return refuse('Rien à mettre en pause');
      return move(g, realNow, 'pause', action, { pauseDepuis: realNow, etatAvantPause: g.etat });

    case 'reprendre':
      if (g.etat !== 'pause' || g.etatAvantPause === null) return refuse('La partie n’est pas en pause');
      return move(g, realNow, g.etatAvantPause, action, unpause(g, realNow));

    case 'phase_finale':
      if (g.etat !== 'en_cours') return refuse('La phase finale démarre depuis une partie en cours');
      return move(g, realNow, 'phase_finale', action);

    case 'terminer':
      if (g.etat !== 'en_cours' && g.etat !== 'phase_finale' && g.etat !== 'pause') return refuse('Aucune partie en cours à terminer');
      return move(g, realNow, 'terminee', action, g.etat === 'pause' ? unpause(g, realNow) : {});
  }
}

/** RG-4 / RG-13.2 : un Clear confirmé termine la partie depuis En cours ou Phase finale. */
export function endByClear(g: GameLifecycle, realNow: number): LifecycleResult {
  if (g.etat !== 'en_cours' && g.etat !== 'phase_finale') return refuse('Le Clear ne peut être confirmé que pendant la partie');
  return move(g, realNow, 'terminee', 'clear');
}

/**
 * Transitions automatiques, à appeler régulièrement : phase finale 30 min avant la fin (RG-4.5),
 * fin du temps (RG-13.4). Rien ne bouge pendant la pause, l'horloge étant arrêtée.
 * `dureeMs` : paramètre dureePartieMin, relu à chaque appel (le GM peut le changer).
 */
export function tick(g: GameLifecycle, realNow: number, dureeMs: number): { game: GameLifecycle; transitions: Transition[] } {
  const transitions: Transition[] = [];
  let cur = g;
  const t = gameClock(cur, realNow);
  if (cur.etat === 'en_cours' && t >= dureeMs - FINAL_PHASE_BEFORE_END_MS) {
    const r = move(cur, realNow, 'phase_finale', 'auto_phase_finale');
    if (r.ok && r.transition) {
      cur = r.game;
      transitions.push(r.transition);
    }
  }
  if (cur.etat === 'phase_finale' && t >= dureeMs) {
    const r = move(cur, realNow, 'terminee', 'auto_fin_du_temps');
    if (r.ok && r.transition) {
      cur = r.game;
      transitions.push(r.transition);
    }
  }
  return { game: cur, transitions };
}

/** Temps de jeu restant, pour le compte à rebours de l'écran géant. */
export function remainingMs(g: GameLifecycle, realNow: number, dureeMs: number): number {
  return Math.max(0, dureeMs - gameClock(g, realNow));
}
