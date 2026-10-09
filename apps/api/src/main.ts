// Point d'entrée : `pnpm --filter @gq/api dev`.
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { openDb } from './db/client.js';
import { Scheduler } from './core/taches.js';
import { seedPresets } from './db/seed.js';

const config = loadConfig();
const { db, close } = await openDb({ url: config.databaseUrl, dataDir: config.pgliteDir });
await seedPresets(db);
const app = await buildApp({ db, secret: config.secret, adminCode: config.adminCode, corsOrigin: config.corsOrigin, logger: true });
// Tâches planifiées (J, rotation, recharge, événements, enchères, écran…).
const scheduler = new Scheduler(db, app.gq.runner, (e) => app.log.error(e));
scheduler.start();
app.addHook('onClose', async () => {
  scheduler.stop();
  await close();
});
await app.listen({ port: config.port, host: config.host });
