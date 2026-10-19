import { seededRng } from '@gq/engine';
import type { GameState } from '@gq/shared';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.js';
import { openDb, type DbHandle } from '../db/client.js';
import { joueurs, parties } from '../db/schema.js';
import { seedDemoGame, seedPresets, type DemoOptions } from '../db/seed.js';

/** Base PGlite en mémoire, migrée, avec préréglages et une partie de démonstration. */
export async function testDb(o: DemoOptions = {}) {
  const handle: DbHandle = await openDb();
  await seedPresets(handle.db);
  const ids = await seedDemoGame(handle.db, o);
  return { ...handle, ...ids };
}

export const CENTRE = { lat: 48.8566, lng: 2.3522 };
/** Fiche Hunter des joueurs de test (RG-5.3). */
export const PROFIL_TEST = { age: '18-24', genre: 'garcon', occupation: 'etudiant', ville: 'douala', quartier: 'Akwa', reseaux: ['whatsapp'], source: 'ami' };

/** API complète sur une base de test, horloge réelle pilotable (`clock.t`), aléa seedé. */
export async function testApp(o: DemoOptions & { seed?: number } = {}) {
  const t = await testDb({ centre: CENTRE, ...o });
  const clock = { t: 1_000_000 };
  const app = await buildApp({ db: t.db, now: () => clock.t, rng: seededRng(o.seed ?? 42), adminCode: 'orga' });
  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
  let n = 0;
  return {
    ...t,
    app,
    clock,
    bearer,
    /** Force l'état de la partie (les transitions GM sont testées à part). */
    async setEtat(etat: GameState, patch: Partial<typeof parties.$inferInsert> = {}) {
      await t.db.update(parties).set({ etat, ...patch }).where(eq(parties.id, t.partieId));
    },
    /** Inscrit un joueur ; sa Fiche Hunter (RG-5.3) est remplie d'office, sauf `{ fiche: false }`. */
    async inscrire(pseudo: string, position = { ...CENTRE, precisionM: 5 }, { fiche = true } = {}) {
      const appareilId = `appareil-${pseudo}-${++n}-xxxxxxxx`;
      const res = await app.inject({
        method: 'POST',
        url: `/parties/${t.partieId}/inscription`,
        payload: { pseudo, appareilId, position },
      });
      const id = res.json().joueurId as string | undefined;
      if (fiche && id) await t.db.update(joueurs).set({ profil: PROFIL_TEST }).where(eq(joueurs.id, id));
      return { res, body: res.json(), appareilId, token: res.json().token as string, id: id as string };
    },
  };
}
