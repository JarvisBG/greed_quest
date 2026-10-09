import { openDb, type DbHandle } from '../db/client.js';
import { seedDemoGame, seedPresets, type DemoOptions } from '../db/seed.js';

/** Base PGlite en mémoire, migrée, avec préréglages et une partie de démonstration. */
export async function testDb(o: DemoOptions = {}) {
  const handle: DbHandle = await openDb();
  await seedPresets(handle.db);
  const ids = await seedDemoGame(handle.db, o);
  return { ...handle, ...ids };
}
