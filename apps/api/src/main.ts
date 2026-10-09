// Point d'entrée : `pnpm --filter @gq/api dev`.
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { openDb } from './db/client.js';
import { seedPresets } from './db/seed.js';

const config = loadConfig();
const { db, close } = await openDb({ url: config.databaseUrl, dataDir: config.pgliteDir });
await seedPresets(db);
const app = await buildApp({ db, secret: config.secret, adminCode: config.adminCode, logger: true });
app.addHook('onClose', close);
await app.listen({ port: config.port, host: config.host });
