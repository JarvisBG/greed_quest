// Suites des événements (RG-12) à leur fin, qu'elle vienne de l'échéance ou d'une annulation du GM (RG-12.2).
import { DEFAULT_DRAW_CONFIG, announce, endApparition, raidRewards, triggerCurse, type GameEvent } from '@gq/engine';
import { and, eq } from 'drizzle-orm';
import { exemplaires, zones } from '../db/schema.js';
import { newId } from '../ids.js';
import type { ActionCtx } from './runner.js';
import { isLivreGele, loadBeacons, loadBook, loadBooks, loadCatalogue, saveBeacons, saveBooks, saveEvent } from './state.js';
import { emitBeaconChanges } from '../routes/scan.js';

/** Nom des zones, pour les annonces. */
export async function zoneNames(c: ActionCtx): Promise<(id: string) => string> {
  const zs = await c.tx.select().from(zones).where(eq(zones.partieId, c.partie.id));
  const m = new Map(zs.map((z) => [z.id, z.nom]));
  return (id) => m.get(id) ?? '?';
}

/**
 * Applique les suites d'un événement terminé ou annulé, l'enregistre et le diffuse.
 * `annule` : RG-12.2, les effets cessent sans pénalité (carte maudite retirée sans perte).
 */
export async function finishEvent(c: ActionCtx, e: GameEvent, annule: boolean): Promise<void> {
  const d = e.data;
  if (d.type === 'apparition') {
    // La balise fantôme non épuisée redevient dormante.
    const before = await loadBeacons(c.tx, c.partie.id);
    const up = endApparition(e, before);
    await saveBeacons(c.tx, before, up.beacons);
    await emitBeaconChanges(c, up.changes);
  }
  if (d.type === 'carte_maudite') {
    // La carte a pu circuler : on cherche son porteur actuel.
    const [ex] = await c.tx.select().from(exemplaires).where(and(eq(exemplaires.id, d.itemId), eq(exemplaires.partieId, c.partie.id)));
    if (ex) {
      const cat = await loadCatalogue(c.tx, c.partie.id);
      const book = await loadBook(c.tx, ex.joueurId);
      const appliquer = !annule && !(await isLivreGele(c.tx, ex.joueurId)); // Livre gelé épargné
      const r = triggerCurse(book, d.itemId, c.now, cat.rangDe, c.rng, appliquer);
      await saveBooks(c.tx, c.partie.id, c.now, [{ joueurId: ex.joueurId, before: book, after: r.book }]);
      const perdues = r.perdues.map((i) => (i.kind === 'carte' ? cat.nomDe(i.cardId) : i.spell));
      await c.log({ action: 'malediction', resultat: appliquer ? 'appliquee' : 'levee', details: { porteur: ex.joueurId, perdues } });
      c.emit({ type: 'joueur', id: ex.joueurId }, 'malediction', { perdues });
    }
  }
  if (d.type === 'raid' && e.reussi && !annule) {
    // Victoire : 3 sorts par participant (débordement du Livre toléré).
    const recompenses = raidRewards(e, DEFAULT_DRAW_CONFIG.sorts, c.now, newId, c.rng);
    const books = await loadBooks(c.tx, [...recompenses.keys()]);
    const changes = [...recompenses].map(([joueurId, items]) => {
      const before = books.get(joueurId)!;
      return { joueurId, before, after: { ...before, items: [...before.items, ...items] } };
    });
    await saveBooks(c.tx, c.partie.id, c.now, changes);
    for (const [joueurId, items] of recompenses) c.emit({ type: 'joueur', id: joueurId }, 'recompense_raid', { sorts: items.map((i) => i.spell) });
  }
  await saveEvent(c.tx, c.partie.id, e);
  await c.log({ action: 'evenement_fin', resultat: annule ? 'annule' : e.reussi ? 'reussi' : 'termine', details: { evenementId: e.id, type: d.type } });
  const fin = { id: e.id, type: d.type, annule, reussi: e.reussi ?? false };
  const annonce = announce(e, await zoneNames(c));
  if (annonce?.ecran) c.emit({ type: 'tracker' }, 'evenement_fin', fin);
  if (annonce?.push) c.emit({ type: 'joueurs' }, 'evenement_fin', fin);
  c.emit({ type: 'staff' }, 'evenement_fin', fin);
}
