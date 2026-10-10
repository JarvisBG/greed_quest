// Lance les simulations de calibrage et affiche un tableau Markdown.
// Usage : pnpm --filter @gq/engine sim [graines] [option=valeur …]
// ex. : pnpm --filter @gq/engine sim 20 multLimites=2 balisesParJoueur=1.5 sorts=false
//       pnpm --filter @gq/engine sim 20 multLimites=2 balisesParJoueur=0.75 probaCheckpoint=0.05 probaArene=0.05 encheresSSToutesLesMin=30
import type { Rank } from '@gq/shared';
import type { NenPower } from '../spells.js';
import { DEFAULT_SIM, simulate, type SimConfig, type SimResult } from './simulate.js';

const args = process.argv.slice(2);
const graines = Number(args.find((a) => !a.includes('=')) ?? 20);
// `cat=SS2,S3,A5,B6,C7,D7` : catalogue (N = somme) ; `prixCessionSS=100`, `prixCessionS=60` : rangs cessibles.
const overrides: Partial<SimConfig> = {};
const prixCession: Partial<Record<Rank, number>> = {};
for (const a of args.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string];
  if (k === 'cat') {
    overrides.catalogue = Object.fromEntries(v.split(',').map((x) => [x.replace(/\d+$/, ''), Number(x.match(/\d+$/)?.[0] ?? 0)])) as Record<Rank, number>;
  } else if (k === 'poidsHC') {
    // `poidsHC=pepite:3,ticket:3,boussole:2,souffle:2,voile:1,coffre:1` (absente = 0).
    const poids = Object.fromEntries(v.split(',').map((x) => [x.split(':')[0], Number(x.split(':')[1])]));
    overrides.poidsHC = Object.fromEntries(Object.keys(DEFAULT_SIM.poidsHC).map((h) => [h, poids[h] ?? 0])) as SimConfig['poidsHC'];
  } else if (/^recharge(Renforcement|Emission|Manipulation)$/.test(k)) {
    // `rechargeRenforcement=30`, `rechargeEmission=40`, `rechargeManipulation=40` (min).
    const pw = k.slice('recharge'.length).toLowerCase() as NenPower;
    overrides.rechargeNen = { ...overrides.rechargeNen, [pw]: Number(v) };
  } else if (k === 'cacheRangs') {
    // `cacheRangs=SS,S` : rangs des cartes désignées que les joueurs cachent dans leurs emplacements libres.
    overrides.cacheRangs = v === '' ? [] : (v.split(',') as Rank[]);
  } else if (k === 'retardMin') {
    // `retardMin=10-60` : minute d'arrivée des retardataires.
    overrides.retardMin = v.split('-').map(Number) as [number, number];
  } else if (k.startsWith('prixCession')) {
    prixCession[k.slice('prixCession'.length) as Rank] = Number(v);
  } else {
    (overrides as Record<string, unknown>)[k] = v === 'null' ? null : v === 'true' ? true : v === 'false' ? false : Number.isNaN(Number(v)) ? v : Number(v);
  }
}
if (Object.keys(prixCession).length > 0) overrides.prixCession = prixCession;

const median = (xs: number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const fmt = (x: number | null, d = 0) => (x === null ? '—' : x.toFixed(d));

console.log(`Graines : ${graines} · Réglages : ${JSON.stringify({ ...DEFAULT_SIM, ...overrides })}\n`);
console.log('| Joueurs | Clear | Clear médian (min) | Meilleur (médiane /N) | Moyenne /30 | Tirages / joueur | Repli jenny | Échanges / achats / vols | Manques du meilleur | SS du meilleur / en jeu | Arène tent. / vict. / SS | Enchères SS vendues / ouvertes (prix) | Cessions | Hors coll. / joueur (Boussoles, Souffles, J) | Scans refusés | Pouvoirs / joueur du type (vols SS) | Écart au score moyen par type | Clears (par type) | Retardataires : score / à l’heure (meilleur rang médian) | Accompagnement : utilisés / utiles | Cachées / joueur |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');

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
  const ces: Record<string, number> = {};
  for (const r of runs) for (const [rang, n] of Object.entries(r.cessions)) ces[rang] = (ces[rang] ?? 0) + n;
  const cessionsTxt = Object.entries(ces).map(([rang, n]) => `${rang} ${(n / runs.length).toFixed(1)}`).join(', ');
  const prix = runs.flatMap((r) => (r.prixMoyenSS === null ? [] : [r.prixMoyenSS]));
  const arene = `${fmt(moy((r) => r.areneTentatives))} / ${fmt(moy((r) => r.areneVictoires))} / ${fmt(moy((r) => r.areneSS), 1)}`;
  const encheres = `${fmt(moy((r) => r.encheresSSVendues), 1)} / ${fmt(moy((r) => r.encheresSS), 1)} (${fmt(prix.length ? prix.reduce((a, b) => a + b, 0) / prix.length : null)} J)`;
  const pouvoirsTxt = ['renforcement', 'emission', 'manipulation', 'materialisation']
    .map((t) => `${t.slice(0, 5)} ${fmt(moy((r) => r.pouvoirs[t as keyof SimResult['pouvoirs']] ?? 0), 1)}`)
    .join(', ');
  // Équité des types de Nen : score moyen de chaque type moins le score moyen de tous les joueurs.
  const tot: Record<string, { somme: number; n: number }> = {};
  for (const r of runs) for (const [k, v] of Object.entries(r.scoresParType)) tot[k] = { somme: (tot[k]?.somme ?? 0) + v.somme, n: (tot[k]?.n ?? 0) + v.n };
  const all = Object.values(tot).reduce((a, v) => ({ somme: a.somme + v.somme, n: a.n + v.n }), { somme: 0, n: 0 });
  const typesTxt = Object.entries(tot)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k.slice(0, 5)} ${(v.somme / v.n - all.somme / all.n >= 0 ? '+' : '')}${(v.somme / v.n - all.somme / all.n).toFixed(1)} (${v.n})`)
    .join(', ');
  const parType: Record<string, number> = {};
  for (const r of runs) if (r.clearPar) parType[r.clearPar] = (parType[r.clearPar] ?? 0) + 1;
  const clearsTxt = Object.entries(parType).map(([k, n]) => `${k.slice(0, 5)} ${n}`).join(', ');
  const ret = runs.reduce((a, r) => ({ s: a.s + r.retardataires.somme, n: a.n + r.retardataires.n }), { s: 0, n: 0 });
  const hre = runs.reduce((a, r) => ({ s: a.s + r.aLHeure.somme, n: a.n + r.aLHeure.n }), { s: 0, n: 0 });
  const rangs = runs.flatMap((r) => (r.retardataires.meilleurRang === null ? [] : [r.retardataires.meilleurRang]));
  const retardTxt = ret.n === 0 ? '—' : `${fmt(ret.s / ret.n, 1)} / ${fmt(hre.s / hre.n, 1)} (${fmt(median(rangs))})`;
  const nbHC = moy((r) => Object.values(r.hcObtenues).reduce((a, b) => a + b, 0)) / joueurs;
  const hc = `${fmt(nbHC, 1)} (${fmt(moy((r) => r.boussoles) / joueurs, 1)}, ${fmt(moy((r) => r.souffles) / joueurs, 1)}, ${fmt(moy((r) => r.jennyHC) / joueurs)} J)`;
  console.log(
    `| ${joueurs} | ${clears.length}/${runs.length} | ${fmt(median(clears))} | ${fmt(median(runs.map((r) => r.meilleur)))} | ${fmt(moy((r) => r.moyenne), 1)} | ${fmt(moy((r) => r.tiragesParJoueur), 1)} | ${fmt(moy((r) => r.partRepliJenny) * 100)} % | ${fmt(moy((r) => r.echanges))} / ${fmt(moy((r) => r.achatsCartes))} / ${fmt(moy((r) => r.volsReussis))} | ${manquesTxt || '—'} | ${fmt(moy((r) => r.ssDuMeilleur), 1)} / ${fmt(moy((r) => r.ssEnJeu), 1)} | ${arene} | ${encheres} | ${cessionsTxt || '—'} | ${hc} | ${refusTxt} | ${pouvoirsTxt} (${fmt(moy((r) => r.volsSS), 1)}) | ${typesTxt} | ${clearsTxt} | ${retardTxt} | ${fmt(moy((r) => r.accompagnements), 1)} / ${fmt(moy((r) => r.offensifsApresAccompagnement), 1)} | ${fmt(moy((r) => r.cachees), 1)} |`,
  );
}
