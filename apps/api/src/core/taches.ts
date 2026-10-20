// Tâches planifiées (P3, RG-14.1, RG-6.3, RG-6.4, RG-9.3, RG-12, RG-8.12, RG-4.5, RG-10.12).
// Un « tick » par partie toutes les quelques secondes : chaque tâche regarde l'horloge de jeu et
// ne fait que ce qui est dû. L'horloge étant arrêtée en pause, rien n'avance pendant la pause (RG-4.4).
import {
  EVENT_TYPES,
  RETOUR_GM_INACTIVITE_MS,
  SS_RETURN_INACTIVITY_MS,
  cartesGmDe,
  doitRendreCartesGm,
  rendreCartesGm,
  J_RECALC_INTERVAL_MS,
  ROTATION_INTERVAL_MS,
  ZONE_EVENTS,
  BONUS_MATERIALISATION,
  addItem,
  currentWave,
  draw,
  reserveMaterialisationDans,
  expireEvents,
  fillToTarget,
  pick,
  reclaimSS,
  rechargeBeacons,
  rotate,
  smoothJ,
  tick,
} from '@gq/engine';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { cartes, cartesGm, exemplaires, joueurs, journal, parties, zones, type Taches } from '../db/schema.js';
import { closeDueAuctions } from '../routes/encheres.js';
import { emitBeaconChanges, visitesParZone } from '../routes/scan.js';
import { computeRanking, publicRanking } from './classement.js';
import { HEATMAP_DELAY_MS, halosBalises, heatmapPoints, scansParZone } from './ecran.js';
import { alerte } from './alertes.js';
import { applyLifecycle } from './cycle.js';
import { expireSessions } from './echanges.js';
import { finishEvent } from './evenements.js';
import { SYSTEME } from './journal.js';
import { paramsOf } from './params.js';
import { lifecycleOf } from './partie.js';
import type { ActionCtx, Runner } from './runner.js';
import { catalogForDraw, limitesOf, loadActiveEvents, loadBeacons, loadBooks, loadCatalogue, loadJoueurs, saveBeacons, saveBooks, updateJoueur, loadJoueursTache, type JoueurTache } from './state.js';
import { newId } from '../ids.js';

export const INACTIVITY_MS = 15 * 60_000; // RG-5.7
export const SCREEN_REFRESH_MS = 30_000;

/** Un passage de toutes les tâches dues pour une partie. */
export async function tickPartie(c: ActionCtx): Promise<void> {
  // RG-4.5 / RG-13.4 : phase finale 30 min avant la fin, puis fin du temps.
  const p0 = await paramsOf(c.tx, c.partie);
  const lc = tick(lifecycleOf(c.partie), c.realNow, p0.dureePartieMin * 60_000);
  if (lc.transitions.length > 0) await applyLifecycle(c, lc.game, lc.transitions);
  if (c.partie.etat !== 'en_cours' && c.partie.etat !== 'phase_finale') return;

  const taches: Taches = { ...c.partie.taches };
  // Charge (offre gratuite) : les joueurs sont lus une fois par passage, pas une fois par tâche.
  const tous = await loadJoueursTache(c.tx, c.partie.id);
  await markInactive(c, tous);
  await alertNoPosition(c, tous, taches, p0.ciblableMin * 60_000);
  if (taches.jA === undefined || c.now - taches.jA >= J_RECALC_INTERVAL_MS) {
    await recalcJ(c, tous);
    taches.jA = c.now;
  }
  await beacons(c, taches);
  await events(c);
  await returnSS(c, tous);
  await closeDueAuctions(c);
  await expireTrades(c);
  await shopWave(c);
  if (taches.ecranA === undefined || c.now - taches.ecranA >= SCREEN_REFRESH_MS) {
    await screen(c, taches.ecranA ?? c.now);
    taches.ecranA = c.now;
  }
  await agenda(c, taches);
  await reserveMaterialisation(c, p0.reserveMaterialisationMin * 60_000);
  await c.tx.update(parties).set({ taches }).where(eq(parties.id, c.partie.id));
  c.partie.taches = taches;
}

/**
 * Amendement 2026-10-10 : réserve de Matérialisation, un tirage bonus (rang C au plus) toutes les 40 min,
 * même sans checkpoint. Comme le bonus de checkpoint, il peut déborder d'un Livre plein.
 */
async function reserveMaterialisation(c: ActionCtx, intervalleMs: number) {
  // Seuls les joueurs de Matérialisation sont lus (la réserve ne concerne qu'eux).
  const dus = (await c.tx.select().from(joueurs).where(and(eq(joueurs.partieId, c.partie.id), eq(joueurs.nen, 'materialisation')))).filter(
    (j) => j.statut !== 'disqualifie' && j.statut !== 'abandon' && reserveMaterialisationDans(j, c.now, intervalleMs) === 0,
  );
  if (dus.length === 0) return;
  const [cat, p, books] = await Promise.all([loadCatalogue(c.tx, c.partie.id), paramsOf(c.tx, c.partie), loadBooks(c.tx, dus.map((j) => j.id))]);
  for (const j of dus) {
    const g = draw({ beaconType: 'standard', tiragesPrecedents: 0, catalogue: await catalogForDraw(c.tx, cat, c.partie.id), limites: limitesOf(p) }, c.rng, BONUS_MATERIALISATION);
    const before = books.get(j.id)!;
    let after = before;
    let jenny = j.jenny;
    let bonus: { kind: 'carte'; nom: string; rang: string } | { kind: 'sort'; sort: string } | { kind: 'jenny'; montant: number };
    if (g.kind === 'carte') {
      after = addItem(before, { kind: 'carte', id: newId(), cardId: g.cardId, origine: { type: 'materialisation' }, obtenuA: c.now });
      bonus = { kind: 'carte', nom: cat.nomDe(g.cardId), rang: g.rank };
    } else if (g.kind === 'sort') {
      after = addItem(before, { kind: 'sort', id: newId(), spell: g.spell, obtenuA: c.now });
      bonus = { kind: 'sort', sort: g.spell };
    } else {
      jenny += g.amount;
      bonus = { kind: 'jenny', montant: g.amount };
    }
    await saveBooks(c.tx, c.partie.id, c.now, [{ joueurId: j.id, before, after }]);
    await updateJoueur(c.tx, j.id, { jenny, derniereReserveA: c.now });
    await c.log({ action: 'reserve_materialisation', resultat: 'ok', details: { joueurId: j.id, bonus } });
    c.emit({ type: 'joueur', id: j.id }, 'reserve', { bonus });
  }
}

/** RG-5.7 : sans action depuis 15 min, un joueur devient inactif (exclu de J). Fin des gels de sanction. */
async function markInactive(c: ActionCtx, tous: JoueurTache[]) {
  for (const j of tous) {
    // Fin du gel infligé par un PNJ (5 min).
    if (j.statut === 'gele' && (j.geleJusqua ?? 0) <= c.now) {
      await updateJoueur(c.tx, j.id, { statut: 'actif', derniereActionA: c.now });
      Object.assign(j, { statut: 'actif', derniereActionA: c.now });
      await c.log({ action: 'statut', resultat: 'degele', details: { joueurId: j.id } });
      c.emit({ type: 'joueur', id: j.id }, 'degel', {});
      continue;
    }
    if (j.statut !== 'actif' || (j.derniereActionA ?? 0) > c.now - INACTIVITY_MS) continue;
    await updateJoueur(c.tx, j.id, { statut: 'inactif' });
    j.statut = 'inactif';
    await c.log({ action: 'statut', resultat: 'inactif', details: { joueurId: j.id } });
  }
}

/**
 * Amendement RG-10.10 : un joueur actif sans nouvelle position depuis `ciblableMin` n'est plus ciblable.
 * L'équipe est prévenue une fois par disparition (GPS coupé, téléphone en veille, triche possible).
 */
async function alertNoPosition(c: ActionCtx, tous: readonly JoueurTache[], taches: Taches, delaiMs: number) {
  const vus = { ...taches.sansPosition };
  for (const j of tous) {
    if ((j.statut !== 'actif' && j.statut !== 'gele') || !j.position || c.now - j.position.a <= delaiMs) continue;
    if (vus[j.id] === j.position.a) continue;
    vus[j.id] = j.position.a;
    await alerte(c, 'sans_position', { joueurId: j.id, pseudo: j.pseudo, depuisMin: Math.floor((c.now - j.position.a) / 60_000) });
  }
  taches.sansPosition = vus;
}

/** RG-14.1 : J = joueurs actifs, recalculé toutes les 2 min ; hausse immédiate, baisse lissée. */
async function recalcJ(c: ActionCtx, joueurs: readonly JoueurTache[]) {
  const mesure = joueurs.filter((j) => (j.statut === 'actif' || j.statut === 'gele') && (j.derniereActionA ?? -Infinity) > c.now - INACTIVITY_MS).length;
  const j = smoothJ(c.partie.j, mesure, c.now);
  if (j.value === c.partie.j.value && j.lastDecreaseAt === c.partie.j.lastDecreaseAt) return;
  await c.tx.update(parties).set({ j }).where(eq(parties.id, c.partie.id));
  await c.log({ action: 'recalcul_j', resultat: 'ok', details: { mesure, avant: c.partie.j.value, apres: j.value } });
  c.emit({ type: 'staff' }, 'j', { mesure, applique: j.value });
  c.partie.j = j;
}

/** RG-6.3 recharge, cible de balises actives (démarrage, hausse de J), RG-6.4 rotation toutes les 20 min. */
async function beacons(c: ActionCtx, taches: Taches) {
  const p = await paramsOf(c.tx, c.partie);
  const before = await loadBeacons(c.tx, c.partie.id);
  const opts = { stockBalise: p.stockBalise, partRaresPct: p.partRaresPct, visitesParZone: await visitesParZone(c) };
  const recharge = rechargeBeacons(before, c.now);
  let up = fillToTarget(recharge.beacons, p.balisesActives, opts, c.rng);
  const changes = [...recharge.changes, ...up.changes];
  let tourne = false;
  if (taches.rotationA === undefined) {
    taches.rotationA = c.now;
    tourne = true;
  } else if (c.now - taches.rotationA >= ROTATION_INTERVAL_MS) {
    up = rotate(up.beacons, p.balisesActives, opts, c.rng);
    changes.push(...up.changes);
    taches.rotationA = c.now;
    tourne = true;
  }
  await saveBeacons(c.tx, c.partie.id, before, up.beacons);
  await emitBeaconChanges(c, changes);
  if (tourne) {
    // Amendement RG-6.5 : nouveaux halos de l'écran géant à chaque rotation.
    taches.halosGraine = Math.floor(c.rng.next() * 2 ** 31);
    c.partie.taches = { ...(c.partie.taches as Taches), halosGraine: taches.halosGraine };
    c.emit({ type: 'tracker' }, 'halos', await halosBalises(c));
  }
}

/** RG-12 : fin des événements échus (fantôme, carte maudite, raid…). */
async function events(c: ActionCtx) {
  const { termines } = expireEvents(await loadActiveEvents(c.tx, c.partie.id), c.now);
  for (const e of termines) await finishEvent(c, e, false);
}

/**
 * Les 20 min d'inactivité comptent depuis la dernière action, ou depuis l'arrivée de la carte si elle est plus récente :
 * une carte donnée par le GM à un joueur déjà inactif ne lui est pas reprise la minute suivante.
 */
const inactifDepuis = (derniereActionA: number | null, items: { obtenuA: number }[]) => Math.max(derniereActionA ?? 0, ...items.map((i) => i.obtenuA));

/** RG-8.12 : SS d'un joueur inactif depuis 20 min, qui abandonne ou est disqualifié → retour en jeu. */
async function returnSS(c: ActionCtx, tous: readonly JoueurTache[]) {
  // Seuls les joueurs partis ou sans action depuis 20 min peuvent rendre quelque chose : les Livres des autres ne sont pas lus.
  const seuil = c.now - Math.min(SS_RETURN_INACTIVITY_MS, RETOUR_GM_INACTIVITE_MS);
  const partis = tous.filter((j) => j.statut === 'abandon' || j.statut === 'disqualifie' || (j.derniereActionA ?? 0) <= seuil).map((j) => j.id);
  if (partis.length === 0) return;
  // … et seulement ceux qui détiennent une SS ou une carte de Maître du jeu.
  const [avecSS, avecGm] = await Promise.all([
    c.tx.selectDistinct({ id: exemplaires.joueurId }).from(exemplaires).innerJoin(cartes, eq(cartes.id, exemplaires.carteId)).where(and(inArray(exemplaires.joueurId, partis), eq(cartes.rang, 'SS'))),
    c.tx.selectDistinct({ id: cartesGm.joueurId }).from(cartesGm).where(inArray(cartesGm.joueurId, partis)),
  ]);
  const detenteurs = new Set([...avecSS, ...avecGm].map((r) => r.id));
  const joueurs = tous.filter((j) => detenteurs.has(j.id));
  if (joueurs.length === 0) return;
  const books = await loadBooks(c.tx, joueurs.map((j) => j.id));
  const cat = await loadCatalogue(c.tx, c.partie.id);
  for (const j of joueurs) {
    const before = books.get(j.id)!;
    const ss = before.items.filter((i) => i.kind === 'carte' && cat.rangDe(i.cardId) === 'SS');
    const r = reclaimSS({ status: j.statut, derniereActionA: inactifDepuis(j.derniereActionA, ss), book: before }, c.now, cat.rangDe);
    if (r.rendues.length === 0) continue;
    await saveBooks(c.tx, c.partie.id, c.now, [{ joueurId: j.id, before, after: r.book }]);
    const cartes = r.rendues.map((i) => (i.kind === 'carte' ? cat.nomDe(i.cardId) : ''));
    await c.log({ action: 'retour_ss', resultat: 'ok', details: { joueurId: j.id, cartes } });
    c.emit({ type: 'joueur', id: j.id }, 'perte', { cause: 'retour_en_jeu', cartes });
  }
  // RG-8.17 : ses cartes de Maître du jeu reviennent au Maître du jeu, dans les mêmes cas.
  const apres = await loadBooks(c.tx, joueurs.map((j) => j.id));
  for (const j of joueurs) {
    const before = apres.get(j.id)!;
    if (cartesGmDe(before).length === 0 || !doitRendreCartesGm({ status: j.statut, derniereActionA: inactifDepuis(j.derniereActionA, cartesGmDe(before)) }, c.now)) continue;
    const r = rendreCartesGm(before);
    await saveBooks(c.tx, c.partie.id, c.now, [{ joueurId: j.id, before, after: r.book }]);
    await c.log({ action: 'retour_carte_gm', resultat: 'ok', details: { joueurId: j.id, cartes: r.rendues.map((i) => i.gm) } });
    c.emit({ type: 'joueur', id: j.id }, 'carte_gm_rendue', { gm: r.rendues.map((i) => i.gm) });
  }
}

/** Sessions d'échange expirées : les deux joueurs sont prévenus. */
/** RG-11.1 amendé : invitation sans réponse (60 s) ou session inactive (3 min) → expirée, les deux joueurs sont prévenus. */
async function expireTrades(c: ActionCtx) {
  for (const s of await expireSessions(c.tx, c.partie.id, c.now)) {
    await c.log({ action: 'echange', resultat: 'expire', details: { sessionId: s.id } });
    for (const id of [s.a, s.b]) c.emit({ type: 'joueur', id }, 'echange', { id: s.id, etat: 'expire' });
  }
}

/** RG-9.3 : nouvelle vague de boutique, stock calculé à son ouverture (RG-14.3). */
async function shopWave(c: ActionCtx) {
  const p = await paramsOf(c.tx, c.partie);
  const w = currentWave(c.partie.vagueBoutique, c.now, 0, p.paquetsParVague);
  if (w === c.partie.vagueBoutique) return;
  await c.tx.update(parties).set({ vagueBoutique: w }).where(eq(parties.id, c.partie.id));
  c.partie.vagueBoutique = w;
  await c.log({ action: 'vague_boutique', resultat: 'ok', details: { index: w.index, stock: w.stock } });
  c.emit({ type: 'joueurs' }, 'boutique', { vague: w.index, paquets: w.stock });
}

/** Écran géant : classement live (RG-13.7) et heatmap anonyme décalée de 2 min (RG-10.12). */
async function screen(c: ActionCtx, depuis: number) {
  c.emit({ type: 'tracker' }, 'classement', publicRanking(await computeRanking(c.tx, c.partie, 'live')));
  c.emit({ type: 'tracker' }, 'heatmap', await heatmapPoints(c));
  // Amendement RG-6.5 : zones scannées depuis le dernier passage, avec 2 min de retard (RG-10.12).
  const zones = await scansParZone(c, depuis - HEATMAP_DELAY_MS, c.now - HEATMAP_DELAY_MS);
  if (zones.length > 0) c.emit({ type: 'tracker' }, 'scans_zones', zones);
}

/** RG-12.3 : agenda automatique (désactivé par défaut) : propose un événement, le GM confirme. */
async function agenda(c: ActionCtx, taches: Taches) {
  const p = await paramsOf(c.tx, c.partie);
  if (p.agendaIntervalleMin <= 0) return;
  if (taches.agendaA === undefined) {
    taches.agendaA = c.now;
    return;
  }
  if (c.now - taches.agendaA < p.agendaIntervalleMin * 60_000) return;
  taches.agendaA = c.now;
  const type = pick(c.rng, EVENT_TYPES.filter((t) => t !== 'mission_secrete'));
  let zone: { id: string; nom: string } | null = null;
  if (ZONE_EVENTS.includes(type)) {
    const zs = await c.tx.select().from(zones).where(eq(zones.partieId, c.partie.id));
    zone = zs.length > 0 ? pick(c.rng, zs) : null;
  }
  const proposition = { type, zoneId: zone?.id ?? null, zone: zone?.nom ?? null };
  await c.log({ action: 'agenda', resultat: 'proposition', details: proposition });
  c.emit({ type: 'gm' }, 'proposition_evenement', proposition);
}

/** Lance le tick de toutes les parties en cours, toutes les `intervalMs`. */
export class Scheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private db: Db,
    private runner: Runner,
    private onError: (e: unknown) => void = () => {},
  ) {}

  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const rows = await this.db
        .select({ id: parties.id })
        .from(parties)
        .where(inArray(parties.etat, ['en_cours', 'phase_finale']));
      for (const { id } of rows) {
        await this.runner.run(id, SYSTEME, tickPartie).catch(this.onError);
      }
    } finally {
      this.running = false;
    }
  }

  start(intervalMs = 5_000): void {
    this.timer ??= setInterval(() => void this.runOnce().catch(this.onError), intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
