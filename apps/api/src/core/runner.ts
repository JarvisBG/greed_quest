// Exécution d'une action d'état : verrou par partie, transaction, journal, diffusion après commit.
// Une seule instance d'API par partie : le verrou en mémoire suffit à sérialiser les actions
// (décision 2026-10-09, voir PROGRESS.md) ; la transaction garantit l'atomicité.
import { randomInt } from 'node:crypto';
import { gameClock, type Rng } from '@gq/engine';
import { eq } from 'drizzle-orm';
import type { Db, Tx } from '../db/client.js';
import { parties } from '../db/schema.js';
import type { Audience, Bus, Emission } from './bus.js';
import { Refus } from '../errors.js';
import { writeLog, type Acteur, type LogEntry } from './journal.js';
import { lifecycleOf, type PartieRow } from './partie.js';

/** Aléa du serveur (non prédictible). Les tests injectent un générateur seedé. */
export const cryptoRng: Rng = { next: () => randomInt(0, 2 ** 32) / 2 ** 32 };

export interface ActionCtx {
  tx: Tx;
  partie: PartieRow;
  /** Heure réelle (ms). */
  realNow: number;
  /** Heure de jeu (ms), arrêtée en pause (RG-4.4). */
  now: number;
  rng: Rng;
  acteur: Acteur;
  log(e: LogEntry): Promise<void>;
  /** Diffusé seulement si la transaction est validée. */
  emit(a: Audience, evenement: string, data: unknown): void;
}

export class PartieIntrouvable extends Refus {
  constructor() {
    super('introuvable', 'Partie introuvable', 404);
  }
}

/** Actions trop fréquentes pour le fil du journal de la console (elles restent en base). */
const HORS_FIL: ReadonlySet<string> = new Set(['position']);

export class Runner {
  private queues = new Map<string, Promise<unknown>>();

  constructor(
    private db: Db,
    private bus: Bus,
    private clock: () => number = Date.now,
    private rng: Rng = cryptoRng,
  ) {}

  realNow(): number {
    return this.clock();
  }

  /** Sérialise les actions d'une même partie (file d'attente par partie). */
  private lock<T>(partieId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.queues.get(partieId) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    const tail = run.catch(() => undefined);
    this.queues.set(partieId, tail);
    void tail.then(() => {
      if (this.queues.get(partieId) === tail) this.queues.delete(partieId);
    });
    return run;
  }

  run<T>(partieId: string, acteur: Acteur, fn: (ctx: ActionCtx) => Promise<T>): Promise<T> {
    return this.lock(partieId, async () => {
      const emissions: Emission[] = [];
      const result = await this.db.transaction(async (tx) => {
        const [partie] = await tx.select().from(parties).where(eq(parties.id, partieId));
        if (!partie) throw new PartieIntrouvable();
        const realNow = this.clock();
        const now = gameClock(lifecycleOf(partie), realNow);
        const ctx: ActionCtx = {
          tx,
          partie,
          realNow,
          now,
          rng: this.rng,
          acteur,
          log: async (e) => {
            const row = await writeLog(tx, partieId, now, acteur, e);
            // Diffusion « PNJ/GM : journal » de la matrice (REGLES.md).
            if (!HORS_FIL.has(e.action)) emissions.push({ partieId, a: { type: 'staff' }, evenement: 'journal', data: row });
          },
          emit: (a, evenement, data) => emissions.push({ partieId, a, evenement, data }),
        };
        return fn(ctx);
      });
      for (const e of emissions) this.bus.publish(e);
      return result;
    });
  }
}
