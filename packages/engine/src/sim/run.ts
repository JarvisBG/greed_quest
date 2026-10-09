// Lance les simulations de calibrage et affiche un tableau Markdown.
// Usage : pnpm --filter @gq/engine sim [graines] [option=valeur …]
// ex. : pnpm --filter @gq/engine sim 20 multLimites=2 balisesParJoueur=1.5 sorts=false
import { DEFAULT_SIM, simulate, type SimConfig, type SimResult } from './simulate.js';

const args = process.argv.slice(2);
const graines = Number(args.find((a) => !a.includes('=')) ?? 20);
const overrides = Object.fromEntries(
  args.filter((a) => a.includes('=')).map((a) => {
    const [k, v] = a.split('=');
    return [k, v === 'null' ? null : v === 'true' ? true : v === 'false' ? false : Number(v)];
  }),
) as Partial<SimConfig>;

const median = (xs: number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const fmt = (x: number | null, d = 0) => (x === null ? '—' : x.toFixed(d));

console.log(`Graines : ${graines} · Réglages : ${JSON.stringify({ ...DEFAULT_SIM, ...overrides })}\n`);
console.log('| Joueurs | Clear | Clear médian (min) | Meilleur (médiane /30) | Moyenne /30 | Tirages / joueur | Repli jenny | Échanges / achats / vols | Manques du meilleur | Scans refusés |');
console.log('|---|---|---|---|---|---|---|---|---|---|');

for (const joueurs of [10, 30, 80]) {
  const runs: SimResult[] = [];
  for (let seed = 1; seed <= graines; seed++) runs.push(simulate({ ...DEFAULT_SIM, ...overrides, joueurs, seed }));
  const clears = runs.flatMap((r) => (r.clearMin === null ? [] : [r.clearMin]));
  const manques: Record<string, number> = {};
  for (const r of runs) for (const [rang, n] of Object.entries(r.manquesDuMeilleur)) manques[rang] = (manques[rang] ?? 0) + n;
  const manquesTxt = Object.entries(manques)
    .map(([rang, n]) => `${rang} ${(n / runs.length).toFixed(1)}`)
    .join(', ');
  const moy = (f: (r: SimResult) => number) => runs.reduce((a, r) => a + f(r), 0) / runs.length;
  const refus: Record<string, number> = {};
  for (const r of runs) for (const [code, n] of Object.entries(r.refus)) refus[code] = (refus[code] ?? 0) + n;
  const totalScans = runs.reduce((a, r) => a + r.tiragesParJoueur * r.joueurs, 0) + Object.values(refus).reduce((a, b) => a + b, 0);
  const refusTxt = Object.entries(refus)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([code, n]) => `${code} ${Math.round((n / totalScans) * 100)} %`)
    .join(', ');
  console.log(
    `| ${joueurs} | ${clears.length}/${runs.length} | ${fmt(median(clears))} | ${fmt(median(runs.map((r) => r.meilleur)))} | ${fmt(moy((r) => r.moyenne), 1)} | ${fmt(moy((r) => r.tiragesParJoueur), 1)} | ${fmt(moy((r) => r.partRepliJenny) * 100)} % | ${fmt(moy((r) => r.echanges))} / ${fmt(moy((r) => r.achatsCartes))} / ${fmt(moy((r) => r.volsReussis))} | ${manquesTxt || '—'} | ${refusTxt} |`,
  );
}
