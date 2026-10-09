// Écran géant (tracker, lecture seule, public) : état complet à l'ouverture, puis le temps réel prend le relais.
// RG-10.12 : jamais de position exacte ; la heatmap est anonyme, arrondie et décalée de 2 min.
import { announce, isActive, remainingMs } from '@gq/engine';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { fil, journal, zones } from '../db/schema.js';
import { publicEvent } from '../routes/evenements.js';
import { computeRanking, publicRanking } from './classement.js';
import { zoneNames } from './evenements.js';
import { paramsOf } from './params.js';
import { lifecycleOf } from './partie.js';
import type { ActionCtx } from './runner.js';
import { loadActiveEvents, loadBeacons, loadJoueur } from './state.js';

export const HEATMAP_DELAY_MS = 2 * 60_000;
/** Entrées du fil rejouées à l'ouverture de l'écran. */
export const FIL_A_L_OUVERTURE = 30;

/** Points anonymes (dernière position de chaque joueur il y a 2 à 4 min), arrondis à ~10 m. */
export async function heatmapPoints(c: ActionCtx): Promise<{ lat: number; lng: number }[]> {
  const rows = await c.tx
    .select({ acteurId: journal.acteurId, details: journal.details })
    .from(journal)
    .where(
      and(
        eq(journal.partieId, c.partie.id),
        eq(journal.action, 'position'),
        gte(journal.heureJeu, c.now - 2 * HEATMAP_DELAY_MS),
        lte(journal.heureJeu, c.now - HEATMAP_DELAY_MS),
      ),
    )
    .orderBy(journal.id);
  const derniere = new Map<string, { lat: number; lng: number }>();
  for (const r of rows) {
    const d = r.details as { lat: number; lng: number } | null;
    if (r.acteurId && d) derniere.set(r.acteurId, d);
  }
  return [...derniere.values()].map((d) => ({ lat: Number(d.lat.toFixed(4)), lng: Number(d.lng.toFixed(4)) }));
}

/** RG-6.5 : nombre de balises actives par zone (jamais lesquelles). */
export async function balisesParZone(c: ActionCtx): Promise<Record<string, number>> {
  const parZone: Record<string, number> = {};
  for (const b of await loadBeacons(c.tx, c.partie.id)) if (b.state === 'active') parZone[b.zoneId] = (parZone[b.zoneId] ?? 0) + 1;
  return parZone;
}

/** État complet de l'écran (GET /ecran) : mêmes données que les évènements temps réel de la room tracker. */
export async function ecranSnapshot(c: ActionCtx) {
  const p = c.partie;
  const params = await paramsOf(c.tx, p);
  const termine = p.etat === 'terminee';
  const noms = await zoneNames(c);
  const zs = await c.tx.select({ id: zones.id, nom: zones.nom, type: zones.type }).from(zones).where(eq(zones.partieId, p.id));
  const evenements = [];
  for (const e of (await loadActiveEvents(c.tx, p.id)).filter((x) => isActive(x, c.now))) {
    if (announce(e, noms)?.ecran) evenements.push(await publicEvent(c, e));
  }
  const lignes = await c.tx.select().from(fil).where(eq(fil.partieId, p.id)).orderBy(desc(fil.id)).limit(FIL_A_L_OUVERTURE);
  const gagnant = p.gagnantId ? ((await loadJoueur(c.tx, p.gagnantId))?.pseudo ?? null) : null;
  return {
    partie: {
      id: p.id,
      nom: p.nom,
      etat: p.etat,
      restantMs: p.demarreeA === null ? params.dureePartieMin * 60_000 : remainingMs(lifecycleOf(p), c.realNow, params.dureePartieMin * 60_000),
      zones: zs,
    },
    // RG-13.7 : live (contrefaçons comptées) en cours, final figé à la fin.
    classement: termine && p.classementFinal ? publicRanking(p.classementFinal) : publicRanking(await computeRanking(c.tx, p, 'live')),
    classementFinal: termine,
    heatmap: termine ? [] : await heatmapPoints(c),
    balisesParZone: await balisesParZone(c),
    evenements,
    fil: lignes.map((l) => l.data),
    clear: gagnant ? { pseudo: gagnant } : null,
  };
}
