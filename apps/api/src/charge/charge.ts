// Banc de charge : une partie entière jouée par des joueurs simulés, contre la vraie API (PGlite en mémoire).
// Mesure, par type d'action : requêtes envoyées à la base, octets relus (≈ trafic sortant de Supabase),
// temps de calcul du serveur hors base (≈ CPU de Render), messages temps réel, mémoire.
// `pnpm --filter @gq/api charge [joueurs=30] [minutes=120] [--avant] [--sans-ecran]` ; --avant simule les fronts d'avant
// l'optimisation ; --sans-ecran, une partie sans écran géant ouvert.
import { PGlite } from '@electric-sql/pglite';
import { pick, seededRng } from '@gq/engine';
import { and, eq, sql } from 'drizzle-orm';
import { performance } from 'node:perf_hooks';
import { buildApp } from '../app.js';
import { SYSTEME } from '../core/journal.js';
import { tickPartie } from '../core/taches.js';
import { openDb } from '../db/client.js';
import { balises, joueurs, parties, sorts, zones } from '../db/schema.js';
import { seedDemoGame, seedPresets } from '../db/seed.js';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const NB = Number(args[0] ?? 30);
const MINUTES = Number(args[1] ?? 120);
const AVANT = process.argv.includes('--avant');
/** Partie sans écran géant ouvert (classement et carte de chaleur non calculés). */
const SANS_ECRAN = process.argv.includes('--sans-ecran');
const TICK_MS = 5_000;

// --- Compteurs, par étiquette (l'action en cours) ---
interface Stat {
  n: number;
  requetes: number;
  octets: number;
  baseMs: number;
  totalMs: number;
}
const stats = new Map<string, Stat>();
let etiquette = 'preparation';
const stat = (k: string) => stats.get(k) ?? (stats.set(k, { n: 0, requetes: 0, octets: 0, baseMs: 0, totalMs: 0 }), stats.get(k)!);

// Chaque requête à la base : nombre, octets des lignes rendues (JSON ≈ protocole Postgres), durée.
type Q = (this: unknown, ...a: unknown[]) => Promise<{ rows?: unknown[] }>;
// Temps passé dans la base : réunion des intervalles où au moins une requête est en cours (elles se chevauchent).
/** Par requête (texte SQL abrégé) : les plus lourdes sont listées à la fin. */
const detail = new Map<string, { n: number; octets: number }>();
let enCours = 0;
let depuis = 0;
const compter = (q: Q): Q =>
  async function (this: unknown, ...a) {
    if (enCours++ === 0) depuis = performance.now();
    const s = stat(etiquette);
    try {
      const r = await q.apply(this, a);
      s.requetes++;
      const o = r?.rows?.length ? JSON.stringify(r.rows).length : 0;
      s.octets += o;
      const cle = `${etiquette} | ${String(a[0]).replace(/\s+/g, ' ').slice(0, 110)}`;
      const d = detail.get(cle) ?? { n: 0, octets: 0 };
      detail.set(cle, { n: d.n + 1, octets: d.octets + o });
      return r;
    } finally {
      if (--enCours === 0) s.baseMs += performance.now() - depuis;
    }
  };
const proto = PGlite.prototype as unknown as { query: Q; transaction: (cb: (tx: { query: Q }) => Promise<unknown>) => Promise<unknown> };
proto.query = compter(proto.query);
const txOrig = proto.transaction;
proto.transaction = function (this: unknown, cb) {
  return txOrig.call(this, (tx) => {
    tx.query = compter(tx.query.bind(tx));
    return cb(tx);
  });
};

async function mesurer<T>(k: string, fn: () => Promise<T>): Promise<T> {
  const avant = etiquette;
  etiquette = k;
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    const s = stat(k);
    s.n++;
    s.totalMs += performance.now() - t0;
    etiquette = avant;
  }
}

// --- Partie ---
const CENTRE = { lat: 4.0511, lng: 9.7679 };
const { db, close } = await openDb();
await seedPresets(db);
const ids = await seedDemoGame(db, { centre: CENTRE, nbBalises: Math.max(10, Math.round(NB * 0.75)) });
const partieId = ids.partieId;
const clock = { t: 1_000_000 };
const app = await buildApp({ db, now: () => clock.t, rng: seededRng(7), adminCode: 'orga', realtime: false });
const rng = seededRng(99);
if (SANS_ECRAN) app.gq.bus.ecoute = (_p, a) => a.type !== 'tracker';

// Temps réel : messages et octets envoyés aux téléphones, consoles et écran (≈ trafic sortant de Render).
const PROFIL = { age: '18-24', genre: 'garcon', occupation: 'etudiant', ville: 'douala', quartier: 'Akwa', reseaux: ['whatsapp'], source: 'ami' };
const temps = { messages: 0, octets: 0 };
const aRecharger = new Set<string>();
let journalStaff = 0;
let positionsGm = 0;
app.gq.bus.on((e) => {
  const taille = JSON.stringify(e.data ?? null).length + e.evenement.length + 20;
  const dest = e.a.type === 'joueurs' ? js.length : e.a.type === 'staff' ? 2 : 1;
  temps.messages += dest;
  temps.octets += dest * taille;
  // Ce que font les fronts à la réception (useJeu : rechargement du Livre et des événements).
  if (e.a.type === 'joueur') aRecharger.add(e.a.id);
  if (e.a.type === 'joueurs' && (AVANT || RECHARGE_TOUS.has(e.evenement))) for (const j of js) aRecharger.add(j.id);
  if (e.a.type === 'staff' && e.evenement === 'journal') journalStaff++;
  if (e.a.type === 'gm' && e.evenement === 'position') positionsGm++;
});
/** Diffusions à tous les joueurs qui changent ce qu'ils voient (les autres sont lues sans rien recharger). */
const RECHARGE_TOUS = new Set(['partie', 'evenement', 'evenement_fin', 'boutique', 'carte_gm_jouee', 'clear', 'classement_final']);

const gm = app.gq.tokens.issue({ role: 'gm', sub: 'gm1', partieId });
const pnj = app.gq.tokens.issue({ role: 'pnj', sub: 'pnj1', partieId });
async function appel(method: 'GET' | 'POST', url: string, token: string, payload?: Record<string, unknown>) {
  const res = await app.inject({ method, url: `/parties/${partieId}${url}`, headers: { authorization: `Bearer ${token}` }, ...(payload ? { payload } : {}) });
  if (res.statusCode >= 500) throw new Error(`${url} : ${res.body}`);
  return res.json();
}

const js: { id: string; token: string; lat: number; lng: number }[] = [];
await mesurer('preparation', async () => {
  await appel('POST', '/cycle', gm, { action: 'ouvrir_inscriptions' });
  for (let i = 0; i < NB; i++) {
    const position = { ...CENTRE, precisionM: 5 };
    const r = await appel('POST', '/inscription', '', { pseudo: `Joueur${i}`, appareilId: `appareil-charge-${i}-xxxxxxxx`, position });
    await db.update(joueurs).set({ profil: PROFIL }).where(eq(joueurs.id, r.joueurId));
    js.push({ id: r.joueurId, token: r.token, ...CENTRE });
  }
  await appel('POST', '/cycle', gm, { action: 'demarrer' });
});
const qrMasadora = (await db.select().from(zones).where(and(eq(zones.partieId, partieId), eq(zones.type, 'masadora'))))[0]!.qr!;

// Rythmes par joueur (hypothèses) : position toutes les 15 s en marchant (RG-10.9), un scan toutes les 3 min,
// un sort toutes les 12 min, un passage à Masadora toutes les 20 min.
const proba = (periodeMs: number) => TICK_MS / periodeMs;
const bouger = (j: (typeof js)[number]) => {
  j.lat = CENTRE.lat + (rng.next() - 0.5) * 0.004;
  j.lng = CENTRE.lng + (rng.next() - 0.5) * 0.004;
  return { lat: j.lat, lng: j.lng, precisionM: 8 };
};

const memMax = { heap: 0, rss: 0 };
const debut = clock.t;
const t0 = performance.now();
let derniereCarteGm = -Infinity;
for (let pas = 0; clock.t - debut < MINUTES * 60_000; pas++) {
  clock.t = debut + pas * TICK_MS;
  await mesurer('tache: tick (5 s)', () => app.gq.runner.run(partieId, SYSTEME, tickPartie));
  const actives = await db.select({ id: balises.id }).from(balises).where(and(eq(balises.partieId, partieId), eq(balises.etat, 'active')));
  for (const j of js) {
    if (rng.next() < proba(15_000)) await mesurer('joueur: position', () => appel('POST', '/position', j.token, bouger(j)));
    if (rng.next() < proba(3 * 60_000) && actives.length > 0)
      await mesurer('joueur: scan', () => appel('POST', '/scan', j.token, { baliseId: pick(rng, actives).id, position: { lat: j.lat, lng: j.lng, precisionM: 8 } }));
    if (rng.next() < proba(12 * 60_000)) {
      await mesurer('joueur: sort', async () => {
        const proches = (await appel('GET', '/a-portee', j.token)).joueurs as { id: string }[] | undefined;
        const [off] = await db.select().from(sorts).where(and(eq(sorts.joueurId, j.id), eq(sorts.utilise, false)));
        if (off && proches?.length) await appel('POST', '/sort', j.token, { sort: off.type, source: { type: 'carte', itemId: off.id }, cibleId: pick(rng, proches).id, position: { lat: j.lat, lng: j.lng, precisionM: 8 } });
      });
    }
    if (rng.next() < proba(20 * 60_000)) await mesurer('joueur: achat Masadora', () => appel('POST', '/boutique/achat', j.token, { qr: qrMasadora, position: { lat: j.lat, lng: j.lng, precisionM: 8 } }));
  }
  // Téléphones : rechargement après un évènement reçu (Livre + évènements, l'écran d'accueil ouvert).
  for (const id of aRecharger) {
    const j = js.find((x) => x.id === id);
    if (!j) continue;
    await mesurer('front joueur: rechargement', async () => {
      await appel('GET', '/livre', j.token);
      await appel('GET', '/evenements', j.token);
    });
  }
  aRecharger.clear();
  // Console : le GM sur la carte (rechargée au plus toutes les 3 s s'il y a des positions), un PNJ à l'Arène.
  if (positionsGm > 0 && clock.t - derniereCarteGm >= 3_000) {
    derniereCarteGm = clock.t;
    positionsGm = 0;
    await mesurer('console GM: carte', async () => {
      await appel('GET', '/balises', gm);
      await appel('GET', '/positions', gm);
    });
  }
  const arene = AVANT ? journalStaff : Math.min(journalStaff, 1);
  for (let k = 0; k < arene; k++) await mesurer('console PNJ: arène', () => appel('GET', '/arene', pnj));
  journalStaff = 0;
  const m = process.memoryUsage();
  memMax.heap = Math.max(memMax.heap, m.heapUsed);
  memMax.rss = Math.max(memMax.rss, m.rss);
}
const [fin] = await db.select({ etat: parties.etat }).from(parties).where(eq(parties.id, partieId));
const dureeS = (performance.now() - t0) / 1000;

// --- Rapport ---
const Mo = (o: number) => (o / 1024 / 1024).toFixed(1);
const lignes = [...stats.entries()].filter(([k]) => k !== 'preparation').sort((a, b) => b[1].octets - a[1].octets);
let tot = { n: 0, requetes: 0, octets: 0, calculMs: 0 };
console.log(`\nPartie simulée : ${NB} joueurs, ${MINUTES} min de jeu (${fin?.etat}), ${dureeS.toFixed(0)} s de calcul${AVANT ? ', fronts AVANT optimisation' : ''}${SANS_ECRAN ? ', sans écran géant' : ', écran géant ouvert'}\n`);
console.log('Action'.padEnd(30), 'Nombre'.padStart(8), 'Req. base'.padStart(10), 'Lu (Mo)'.padStart(9), 'Req/act'.padStart(8), 'Ko/act'.padStart(8), 'Calcul ms/act'.padStart(14));
for (const [k, s] of lignes) {
  const calcul = s.totalMs - s.baseMs;
  tot = { n: tot.n + s.n, requetes: tot.requetes + s.requetes, octets: tot.octets + s.octets, calculMs: tot.calculMs + calcul };
  console.log(k.padEnd(30), String(s.n).padStart(8), String(s.requetes).padStart(10), Mo(s.octets).padStart(9), (s.requetes / s.n).toFixed(1).padStart(8), (s.octets / s.n / 1024).toFixed(1).padStart(8), (calcul / s.n).toFixed(2).padStart(14));
}
const minutesJeu = MINUTES;
console.log(`\nTotal : ${tot.n} actions, ${tot.requetes} requêtes (${(tot.requetes / (minutesJeu * 60)).toFixed(1)}/s), ${Mo(tot.octets)} Mo lus dans la base`);
console.log(`Calcul du serveur hors base : ${(tot.calculMs / 1000).toFixed(0)} s pour ${minutesJeu} min de jeu (${((tot.calculMs / (minutesJeu * 60_000)) * 100).toFixed(1)} % d'un cœur, mesuré sur ce PC)`);
console.log(`Temps réel : ${temps.messages} messages, ${Mo(temps.octets)} Mo envoyés`);
console.log(`Mémoire max du processus : tas ${Mo(memMax.heap)} Mo, total ${Mo(memMax.rss)} Mo (PGlite compris)`);
const tailles = (await db.execute(sql`select relname as t, pg_total_relation_size(relid) as o from pg_catalog.pg_statio_user_tables order by 2 desc`)) as unknown as { rows: { t: string; o: number }[] };
const somme = tailles.rows.reduce((s, r) => s + Number(r.o), 0);
console.log(`Place prise dans la base par la partie : ${Mo(somme)} Mo (${tailles.rows.slice(0, 4).map((r) => `${r.t} ${Mo(Number(r.o))}`).join(', ')})`);
console.log('\nRequêtes les plus lourdes :');
for (const [k, d] of [...detail.entries()].sort((x, y) => y[1].octets - x[1].octets).slice(0, 12)) console.log(`${Mo(d.octets).padStart(7)} Mo ${String(d.n).padStart(7)} × ${k}`);
await app.close();
await close();
