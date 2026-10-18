// Construit et envoie les apps sur Cloudflare (voir docs/DEPLOIEMENT.md).
// Usage : node scripts/fronts-en-ligne.mjs <adresse de l'API> [player|staff|tracker …]
// Exemple : node scripts/fronts-en-ligne.mjs https://greed-island-api.onrender.com
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [api, ...choix] = process.argv.slice(2);
if (!api || !/^https:\/\//.test(api)) {
  console.error("Donne l'adresse de l'API en https, par exemple https://greed-island-api.onrender.com");
  process.exit(1);
}
const apps = choix.length ? choix : ['player', 'staff', 'tracker'];
const racine = fileURLToPath(new URL('..', import.meta.url));

function lancer(commande, dossier) {
  const r = spawnSync(commande, { cwd: dossier, shell: true, stdio: 'inherit', env: { ...process.env, VITE_API_URL: api.replace(/\/$/, '') } });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

for (const app of apps) {
  console.log(`\n=== ${app}`);
  lancer(`pnpm --filter @gq/${app} build`, racine);
  lancer('npx --yes wrangler@4.143.0 deploy', `${racine}apps/${app}`);
}
