// Écran géant (tracker, lecture seule, public) : état complet à l'ouverture, puis le temps réel prend le relais.
// RG-10.12 : jamais de position exacte ; la heatmap est anonyme, arrondie et décalée de 2 min.
import { announce, isActive, remainingMs } from '@gq/engine';
import { and, desc, eq, gt, gte, isNotNull, lte } from 'drizzle-orm';
import { balises, fil, joueurs, journal, zones, type Taches } from '../db/schema.js';
import { publicEvent } from '../routes/evenements.js';
import { computeRanking, publicRanking } from './classement.js';
import { zoneNames } from './evenements.js';
import { paramsOf } from './params.js';
import { lifecycleOf } from './partie.js';
import type { ActionCtx } from './runner.js';
import { limitesOf, loadActiveEvents, loadBeacons, loadCatalogue, loadJoueur } from './state.js';

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
    const d = r.details as { lat: number; lng: number; zetsu?: boolean } | null;
    if (!r.acteurId || !d) continue;
    // Zetsu (Spécialisation) : le joueur disparaît de la carte de chaleur.
    if (d.zetsu) derniere.delete(r.acteurId);
    else derniere.set(r.acteurId, d);
  }
  return [...derniere.values()].map((d) => ({ lat: Number(d.lat.toFixed(4)), lng: Number(d.lng.toFixed(4)) }));
}

/**
 * Amendement RG-6.5 (2026-10-15) : un scan réussi allume sa zone sur l'écran géant, jamais la balise.
 * RG-10.12 : décalé de 2 min comme la heatmap, sinon le fil (« Gon a tiré … ») dirait où est le joueur.
 * Zones des scans réussis dont l'heure de jeu tombe dans ]de, a] (une entrée par scan, dans l'ordre).
 */
export async function scansParZone(c: ActionCtx, de: number, a: number): Promise<string[]> {
  if (a <= de) return [];
  const rows = await c.tx
    .select({ details: journal.details })
    .from(journal)
    .where(and(eq(journal.partieId, c.partie.id), eq(journal.action, 'scan'), eq(journal.resultat, 'ok'), gt(journal.heureJeu, de), lte(journal.heureJeu, a)))
    .orderBy(journal.id);
  return rows.map((r) => (r.details as { zoneId?: string } | null)?.zoneId).filter((z): z is string => !!z);
}

/** RG-6.5 : nombre de balises actives par zone (jamais lesquelles). */
export async function balisesParZone(c: ActionCtx): Promise<Record<string, number>> {
  const parZone: Record<string, number> = {};
  for (const b of await loadBeacons(c.tx, c.partie.id)) if (b.state === 'active') parZone[b.zoneId] = (parZone[b.zoneId] ?? 0) + 1;
  return parZone;
}

/** Amendement RG-6.5 (2026-10-15) : décalage des halos, entre 8 et 32 m (halo dessiné d'environ 40 m). */
export const HALO_DECALAGE_M = { min: 8, max: 32 };
const M_PAR_DEGRE = 111_320;

/** Deux nombres dans [0, 1) tirés d'une graine et d'un identifiant (FNV-1a puis mulberry32) : stables jusqu'à la rotation. */
function hasard2(graine: number, id: string): [number, number] {
  let h = 2166136261 ^ graine;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const suivant = () => {
    h = (h + 0x6d2b79f5) | 0;
    let x = Math.imul(h ^ (h >>> 15), 1 | h);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  return [suivant(), suivant()];
}

/**
 * Amendement RG-6.5 (2026-10-15) : chaque balise posée, quel que soit son état, en halo décalé au hasard de sa vraie
 * place ; le décalage change à chaque rotation (graine tirée par le serveur, jamais envoyée). Ni identifiant ni état.
 */
export async function halosBalises(c: ActionCtx): Promise<{ lat: number; lng: number }[]> {
  const graine = (c.partie.taches as Taches).halosGraine ?? 0;
  const rows = await c.tx.select({ id: balises.id, position: balises.position }).from(balises).where(and(eq(balises.partieId, c.partie.id), isNotNull(balises.position)));
  const halos = rows.map((b) => {
    const p = b.position!;
    const [u, v] = hasard2(graine, b.id);
    const angle = u * 2 * Math.PI;
    const d = HALO_DECALAGE_M.min + v * (HALO_DECALAGE_M.max - HALO_DECALAGE_M.min);
    return {
      lat: Number((p.lat + (d * Math.sin(angle)) / M_PAR_DEGRE).toFixed(5)),
      lng: Number((p.lng + (d * Math.cos(angle)) / (M_PAR_DEGRE * Math.cos((p.lat * Math.PI) / 180))).toFixed(5)),
    };
  });
  // Ordre sans rapport avec les balises.
  return halos.sort((a, b) => a.lat - b.lat || a.lng - b.lng);
}

/** Amendement RG-6.5 : partie terminée, vraies positions de toutes les balises posées (sans identifiant). */
async function balisesRevelees(c: ActionCtx): Promise<{ lat: number; lng: number }[]> {
  const rows = await c.tx.select({ position: balises.position }).from(balises).where(and(eq(balises.partieId, c.partie.id), isNotNull(balises.position)));
  return rows.map((b) => b.position!);
}

/** État complet de l'écran (GET /ecran) : mêmes données que les évènements temps réel de la room tracker. */
export async function ecranSnapshot(c: ActionCtx) {
  const p = c.partie;
  const params = await paramsOf(c.tx, p);
  const termine = p.etat === 'terminee';
  const noms = await zoneNames(c);
  // Polygones publics : l'écran dessine les zones (les balises restent comptées par zone, RG-6.5).
  const zs = await c.tx.select({ id: zones.id, nom: zones.nom, type: zones.type, polygone: zones.polygone }).from(zones).where(eq(zones.partieId, p.id));
  const evenements = [];
  for (const e of (await loadActiveEvents(c.tx, p.id)).filter((x) => isActive(x, c.now))) {
    if (announce(e, noms)?.ecran) evenements.push(await publicEvent(c, e));
  }
  const lignes = await c.tx.select().from(fil).where(eq(fil.partieId, p.id)).orderBy(desc(fil.id)).limit(FIL_A_L_OUVERTURE);
  const gagnant = p.gagnantId ? ((await loadJoueur(c.tx, p.gagnantId))?.pseudo ?? null) : null;
  // Accueil : les cartes rares à gagner (vitrine) et les derniers Hunters entrés.
  const cat = await loadCatalogue(c.tx, p.id);
  const limites = limitesOf(params);
  const vitrine = cat.cartes
    .filter((k) => k.designee && (k.rang === 'SS' || k.rang === 'S' || k.rang === 'A'))
    .map((k) => ({ numero: k.numero, nom: k.nom, rang: k.rang, limite: limites[k.rang], texte: k.texte }));
  const arrivants = (await c.tx.select({ pseudo: joueurs.pseudo }).from(joueurs).where(eq(joueurs.partieId, p.id)).orderBy(desc(joueurs.inscritA)).limit(6)).map((j) => j.pseudo);
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
    // Amendement RG-6.5 : halos pendant la partie, vraies positions une fois terminée.
    halos: termine ? [] : await halosBalises(c),
    balisesRevelees: termine ? await balisesRevelees(c) : [],
    nCartes: cat.designees.length,
    vitrine,
    arrivants,
    evenements,
    fil: lignes.map((l) => l.data),
    clear: gagnant ? { pseudo: gagnant } : null,
  };
}
