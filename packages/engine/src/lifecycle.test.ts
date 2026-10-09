import { describe, expect, it } from 'vitest';
import {
  applyGmAction,
  canRegister,
  endByClear,
  gameClock,
  newGame,
  remainingMs,
  tick,
  type GameLifecycle,
  type GmAction,
} from './lifecycle.js';

const MIN = 60_000;
const DUREE = 150 * MIN;

/** Enchaîne des actions GM (heure réelle, action) et échoue au premier refus. */
function run(steps: [number, GmAction][], g: GameLifecycle = newGame()): GameLifecycle {
  for (const [t, action] of steps) {
    const r = applyGmAction(g, action, t);
    if (!r.ok) throw new Error(`${action} : ${r.message}`);
    g = r.game;
  }
  return g;
}

const started = () => run([[0, 'ouvrir_inscriptions'], [1000, 'demarrer']]);

describe('RG-4 transitions du GM', () => {
  it('brouillon → inscriptions → en cours', () => {
    const g = started();
    expect(g).toMatchObject({ etat: 'en_cours', inscriptionsOuvertes: true, demarreeA: 1000 });
  });

  it('transitions interdites', () => {
    expect(applyGmAction(newGame(), 'demarrer', 0).ok).toBe(false);
    expect(applyGmAction(newGame(), 'pause', 0).ok).toBe(false);
    expect(applyGmAction(started(), 'ouvrir_inscriptions', 0).ok).toBe(false);
    expect(applyGmAction(started(), 'reprendre', 0).ok).toBe(false);
    const fini = run([[2000, 'terminer']], started());
    for (const a of ['demarrer', 'pause', 'reprendre', 'phase_finale', 'terminer'] as const) {
      expect(applyGmAction(fini, a, 3000).ok).toBe(false);
    }
  });

  it('chaque transition est décrite pour le journal', () => {
    const r = applyGmAction(started(), 'pause', 1000 + 5 * MIN);
    expect(r.ok && r.transition).toEqual({ de: 'en_cours', vers: 'pause', cause: 'pause', a: 5 * MIN });
  });
});

describe('RG-4.2 / 4.3 / 4.5 inscriptions', () => {
  it('ouvertes pendant la partie jusqu’à fermeture par le GM', () => {
    expect(canRegister(newGame())).toBe(false);
    expect(canRegister(run([[0, 'ouvrir_inscriptions']]))).toBe(true);
    const g = started();
    expect(canRegister(g)).toBe(true);
    expect(canRegister(run([[2000, 'fermer_inscriptions']], g))).toBe(false);
  });

  it('fermées d’office en phase finale', () => {
    const g = run([[2000, 'phase_finale']], started());
    expect(canRegister(g)).toBe(false);
  });
});

describe('RG-4.4 pause et horloge de jeu', () => {
  it('l’horloge s’arrête pendant la pause et reprend où elle était', () => {
    let g = started();
    expect(gameClock(g, 1000 + 10 * MIN)).toBe(10 * MIN);
    g = run([[1000 + 10 * MIN, 'pause']], g);
    expect(gameClock(g, 1000 + 40 * MIN)).toBe(10 * MIN);
    g = run([[1000 + 40 * MIN, 'reprendre']], g);
    expect(g.etat).toBe('en_cours');
    expect(gameClock(g, 1000 + 45 * MIN)).toBe(15 * MIN);
  });

  it('la pause en phase finale ramène en phase finale', () => {
    const g = run([[2000, 'phase_finale'], [3000, 'pause'], [4000, 'reprendre']], started());
    expect(g.etat).toBe('phase_finale');
  });

  it('terminer pendant une pause fige l’horloge à l’heure de la pause', () => {
    const g = run([[1000 + 10 * MIN, 'pause'], [1000 + 30 * MIN, 'terminer']], started());
    expect(g).toMatchObject({ etat: 'terminee', termineeA: 10 * MIN });
  });

  it('avant le démarrage, l’horloge vaut 0', () => {
    expect(gameClock(newGame(), 123_456)).toBe(0);
  });
});

describe('transitions automatiques', () => {
  it('RG-4.5 phase finale 30 min avant la fin, puis fin du temps (RG-13.4)', () => {
    let g = started();
    expect(tick(g, 1000 + 119 * MIN, DUREE).transitions).toEqual([]);

    let r = tick(g, 1000 + 120 * MIN, DUREE);
    expect(r.transitions.map((t) => t.vers)).toEqual(['phase_finale']);
    g = r.game;
    expect(g.inscriptionsOuvertes).toBe(false);

    r = tick(g, 1000 + 150 * MIN, DUREE);
    expect(r.transitions).toEqual([{ de: 'phase_finale', vers: 'terminee', cause: 'auto_fin_du_temps', a: 150 * MIN }]);
  });

  it('un tick tardif enchaîne phase finale et fin', () => {
    const r = tick(started(), 1000 + 200 * MIN, DUREE);
    expect(r.transitions.map((t) => t.vers)).toEqual(['phase_finale', 'terminee']);
  });

  it('rien ne bouge pendant la pause', () => {
    const g = run([[1000 + 100 * MIN, 'pause']], started());
    expect(tick(g, 1000 + 500 * MIN, DUREE).transitions).toEqual([]);
    expect(remainingMs(g, 1000 + 500 * MIN, DUREE)).toBe(50 * MIN);
  });
});

describe('RG-13.2 fin par Clear confirmé', () => {
  it('depuis en cours ou phase finale', () => {
    expect(endByClear(started(), 5000)).toMatchObject({ ok: true, game: { etat: 'terminee' }, transition: { cause: 'clear' } });
    expect(endByClear(run([[2000, 'phase_finale']], started()), 5000).ok).toBe(true);
  });

  it('pas depuis la pause ni avant le démarrage', () => {
    expect(endByClear(run([[2000, 'pause']], started()), 5000).ok).toBe(false);
    expect(endByClear(newGame(), 0).ok).toBe(false);
  });
});
