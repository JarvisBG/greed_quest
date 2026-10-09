// `pnpm --filter @gq/api seed` : crée une partie de démonstration dans la base de dev.
import { loadConfig } from './config.js';
import { openDb } from './db/client.js';
import { seedDemoGame, seedPresets } from './db/seed.js';

const config = loadConfig();
const { db, close } = await openDb({ url: config.databaseUrl, dataDir: config.pgliteDir });
await seedPresets(db);
const ids = await seedDemoGame(db);
console.log(`Partie créée : ${ids.partieId} (${ids.carteIds.length} cartes, ${ids.zoneIds.length} zones, ${ids.baliseIds.length} balises)`);
await close();
