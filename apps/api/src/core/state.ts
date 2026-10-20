// Passage base ⇄ structures du moteur : Livres, joueurs, balises, catalogue, événements.
// Les actions chargent ce dont elles ont besoin, appellent le moteur (pur), puis enregistrent les différences.
import {
  type Beacon,
  type Book,
  type BookItem,
  type CardItem,
  type CatalogCard,
  type GameEvent,
  type GmItem,
  type ObjetItem,
  type Perte,
  type SpellItem,
} from '@gq/engine';
import type { CarteGm, Rank } from '@gq/shared';
import { and, count, eq, inArray, notInArray, sql } from 'drizzle-orm';
import type { DbOrTx } from '../db/client.js';
import { balises, cartes, cartesGm, evenements, exemplaires, joueurs, livres, objets, pertes, sorts } from '../db/schema.js';
import { newId } from '../ids.js';

export type JoueurRow = typeof joueurs.$inferSelect;
type ExemplaireRow = typeof exemplaires.$inferSelect;

// --- Livres ---

export function cardItemOf(r: ExemplaireRow): CardItem {
  return {
    kind: 'carte',
    id: r.id,
    cardId: r.carteId,
    origine: r.origine,
    obtenuA: r.obtenuA,
    ...(r.faux ? { faux: r.faux } : {}),
    ...(r.marque ? { marque: r.marque } : {}),
    ...(r.maudite ? { maudite: true as const } : {}),
    ...(r.coffreJusqua !== null ? { coffreJusqua: r.coffreJusqua } : {}),
    ...(r.cachee ? { cachee: true as const } : {}),
  };
}

/** Livres de plusieurs joueurs (sorts et objets non utilisés seulement), indexés par joueur. */
export async function loadBooks(db: DbOrTx, joueurIds: readonly string[]): Promise<Map<string, Book>> {
  const books = new Map<string, { items: BookItem[]; pertes: Perte[] }>(joueurIds.map((id) => [id, { items: [], pertes: [] }]));
  if (joueurIds.length === 0) return books;
  const ids = [...joueurIds];
  for (const r of await db.select().from(exemplaires).where(inArray(exemplaires.joueurId, ids))) {
    books.get(r.joueurId)!.items.push(cardItemOf(r));
  }
  const spells = await db
    .select()
    .from(sorts)
    .where(and(inArray(sorts.joueurId, ids), eq(sorts.utilise, false)));
  for (const r of spells) {
    const item: SpellItem = { kind: 'sort', id: r.id, spell: r.type, obtenuA: r.obtenuA };
    books.get(r.joueurId)!.items.push(item);
  }
  for (const r of await db.select().from(objets).where(and(inArray(objets.joueurId, ids), eq(objets.utilise, false)))) {
    const item: ObjetItem = { kind: 'objet', id: r.id, objet: r.type, obtenuA: r.obtenuA };
    books.get(r.joueurId)!.items.push(item);
  }
  // RG-8.15 : cartes de Maître du jeu détenues (page Objets, hors des 8 places).
  for (const r of await db.select().from(cartesGm).where(inArray(cartesGm.joueurId, ids))) {
    const item: GmItem = { kind: 'gm', id: r.id, gm: r.type, obtenuA: r.obtenuA ?? 0 };
    books.get(r.joueurId!)!.items.push(item);
  }
  for (const r of await db.select().from(pertes).where(inArray(pertes.joueurId, ids)).orderBy(pertes.id)) {
    books.get(r.joueurId)!.pertes.push({ cardId: r.carteId, cause: r.cause, a: r.a, ...(r.par ? { par: r.par } : {}) });
  }
  return books;
}

/**
 * Livres réduits à ce que lit le classement (RG-13.5) : les cartes seulement, avec carte, heure, contrefaçon, marque
 * et « cachée ». Sorts, objets et pertes n'y changent rien. Recalculé toutes les 30 s pour l'écran géant : offre gratuite.
 */
export async function loadCartesClassement(db: DbOrTx, joueurIds: readonly string[]): Promise<Map<string, Book>> {
  const books = new Map<string, { items: BookItem[]; pertes: Perte[] }>(joueurIds.map((id) => [id, { items: [], pertes: [] }]));
  if (joueurIds.length === 0) return books;
  const rows = await db
    .select({ id: exemplaires.id, joueurId: exemplaires.joueurId, carteId: exemplaires.carteId, obtenuA: exemplaires.obtenuA, faux: exemplaires.faux, marque: exemplaires.marque, cachee: exemplaires.cachee })
    .from(exemplaires)
    .where(inArray(exemplaires.joueurId, [...joueurIds]));
  for (const r of rows) {
    books.get(r.joueurId)?.items.push({
      kind: 'carte',
      id: r.id,
      cardId: r.carteId,
      origine: { type: 'balise', baliseId: '' }, // non lue par le classement
      obtenuA: r.obtenuA,
      ...(r.faux ? { faux: r.faux } : {}),
      ...(r.marque ? { marque: r.marque } : {}),
      ...(r.cachee ? { cachee: true as const } : {}),
    });
  }
  return books;
}

export async function loadBook(db: DbOrTx, joueurId: string): Promise<Book> {
  return (await loadBooks(db, [joueurId])).get(joueurId)!;
}

export interface BookChange {
  joueurId: string;
  before: Book;
  after: Book;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Enregistre les différences de plusieurs Livres en une fois. Un exemplaire qui passe d'un Livre
 * à l'autre (vol, échange) change de propriétaire ; un exemplaire qui ne figure plus dans aucun
 * Livre sort du jeu (revente, sanction, malédiction) ; un sort retiré est marqué utilisé.
 */
export async function saveBooks(db: DbOrTx, partieId: string, now: number, changes: readonly BookChange[]): Promise<void> {
  const avant = new Map<string, BookItem>();
  const apres = new Map<string, { joueurId: string; item: BookItem }>();
  for (const c of changes) {
    for (const i of c.before.items) avant.set(i.id, i);
    for (const i of c.after.items) apres.set(i.id, { joueurId: c.joueurId, item: i });
  }
  const proprietaireAvant = new Map<string, string>();
  for (const c of changes) for (const i of c.before.items) proprietaireAvant.set(i.id, c.joueurId);

  for (const [id, { joueurId, item }] of apres) {
    const old = avant.get(id);
    if (old && same(old, item) && proprietaireAvant.get(id) === joueurId) continue;
    if (item.kind === 'carte') {
      const row = {
        id,
        partieId,
        joueurId,
        carteId: item.cardId,
        origine: item.origine,
        obtenuA: item.obtenuA,
        faux: item.faux ?? null,
        marque: item.marque ?? null,
        maudite: item.maudite ?? false,
        coffreJusqua: item.coffreJusqua ?? null,
        cachee: item.cachee ?? false,
      };
      await db.insert(exemplaires).values(row).onConflictDoUpdate({ target: exemplaires.id, set: row });
    } else if (item.kind === 'objet') {
      // Un objet peut changer de main (échange).
      const row = { id, partieId, joueurId, type: item.objet, obtenuA: item.obtenuA };
      await db.insert(objets).values(row).onConflictDoUpdate({ target: objets.id, set: row });
    } else if (item.kind === 'gm') {
      // RG-8.17 : la carte de Maître du jeu (ligne unique de la partie) change de détenteur.
      await db.update(cartesGm).set({ joueurId, obtenuA: item.obtenuA }).where(eq(cartesGm.id, id));
    } else if (!old) {
      await db.insert(sorts).values({ id, partieId, joueurId, type: item.spell, obtenuA: item.obtenuA });
    }
  }

  const sortis = [...avant.values()].filter((i) => !apres.has(i.id));
  const cartesSorties = sortis.filter((i) => i.kind === 'carte').map((i) => i.id);
  const sortsUtilises = sortis.filter((i) => i.kind === 'sort').map((i) => i.id);
  if (cartesSorties.length > 0) await db.delete(exemplaires).where(inArray(exemplaires.id, cartesSorties));
  if (sortsUtilises.length > 0) await db.update(sorts).set({ utilise: true, utiliseA: now }).where(inArray(sorts.id, sortsUtilises));
  const objetsUtilises = sortis.filter((i) => i.kind === 'objet').map((i) => i.id);
  if (objetsUtilises.length > 0) await db.update(objets).set({ utilise: true, utiliseA: now }).where(inArray(objets.id, objetsUtilises));
  // RG-8.17 : une carte de Maître du jeu qui ne figure plus dans aucun Livre revient au Maître du jeu.
  for (const i of sortis) {
    if (i.kind === 'gm') await db.update(cartesGm).set({ joueurId: null }).where(and(eq(cartesGm.id, i.id), eq(cartesGm.joueurId, proprietaireAvant.get(i.id)!)));
  }

  for (const c of changes) {
    const nouvelles = c.after.pertes.slice(c.before.pertes.length);
    if (nouvelles.length === 0) continue;
    await db.insert(pertes).values(nouvelles.map((p) => ({ joueurId: c.joueurId, carteId: p.cardId, cause: p.cause, par: p.par ?? null, a: p.a })));
  }
}

// --- Cartes de Maître du jeu (RG-8.15 à 8.17) ---

/** Ligne unique de la carte dans la partie (créée au besoin) ; son id est celui de l'élément du Book. */
export async function ligneCarteGm(db: DbOrTx, partieId: string, gm: CarteGm) {
  const [l] = await db.select().from(cartesGm).where(and(eq(cartesGm.partieId, partieId), eq(cartesGm.type, gm)));
  if (l) return l;
  const [n] = await db.insert(cartesGm).values({ id: newId(), partieId, type: gm }).returning();
  return n!;
}

/** RG-8.16 : cartes encore au Maître du jeu (jamais sorties, jouées ou rendues). */
export async function cartesGmLibres(db: DbOrTx, partieId: string, types: readonly CarteGm[]): Promise<CarteGm[]> {
  const prises = new Set((await db.select().from(cartesGm).where(eq(cartesGm.partieId, partieId))).filter((l) => l.joueurId !== null).map((l) => l.type));
  return types.filter((t) => !prises.has(t));
}

/** RG-8.16 : élément du Book d'une carte de Maître du jeu qui arrive chez un joueur (refusé si elle est déjà en jeu). */
export async function donnerCarteGm(db: DbOrTx, partieId: string, gm: CarteGm, now: number): Promise<GmItem | null> {
  const l = await ligneCarteGm(db, partieId, gm);
  return l.joueurId === null ? { kind: 'gm', id: l.id, gm, obtenuA: now } : null;
}

// --- Joueurs ---

export async function loadJoueur(db: DbOrTx, joueurId: string): Promise<JoueurRow | undefined> {
  const [j] = await db.select().from(joueurs).where(eq(joueurs.id, joueurId));
  return j;
}

export async function isLivreGele(db: DbOrTx, joueurId: string): Promise<boolean> {
  const [l] = await db.select({ gele: livres.gele }).from(livres).where(eq(livres.joueurId, joueurId));
  return l?.gele ?? false;
}

export async function updateJoueur(db: DbOrTx, joueurId: string, patch: Partial<JoueurRow>): Promise<void> {
  await db.update(joueurs).set(patch).where(eq(joueurs.id, joueurId));
}

/** Une action rend le joueur actif (RG-5.7) et compte pour J (« au moins une action dans les 15 dernières min »). */
export const actionPatch = (j: JoueurRow, now: number): Partial<JoueurRow> => ({
  derniereActionA: now,
  ...(j.statut === 'inactif' ? { statut: 'actif' as const } : {}),
});

// --- Catalogue ---

export interface Catalogue {
  cartes: (typeof cartes.$inferSelect)[];
  /** Cartes désignées dans l'ordre du catalogue (RG-8.5). */
  designees: string[];
  rangDe: (cardId: string) => Rank;
  nomDe: (cardId: string) => string;
  numeroDe: (cardId: string) => number;
}

/** Ce qu'un joueur voit d'une carte du catalogue : numéro, nom, rang, texte d'ambiance, limite d'exemplaires (RG-8.2). */
export function vueCarte(cat: Catalogue, cardId: string, limites: Record<Rank, number>) {
  const x = cat.cartes.find((k) => k.id === cardId);
  return { numero: x?.numero ?? null, nom: x?.nom ?? '?', rang: x?.rang ?? null, texte: x?.texte ?? null, limite: x ? limites[x.rang] : null };
}

export async function loadCatalogue(db: DbOrTx, partieId: string): Promise<Catalogue> {
  const rows = await db.select().from(cartes).where(eq(cartes.partieId, partieId)).orderBy(cartes.numero);
  const byId = new Map(rows.map((c) => [c.id, c]));
  return {
    cartes: rows,
    designees: rows.filter((c) => c.designee).map((c) => c.id),
    rangDe: (id) => byId.get(id)?.rang ?? 'D',
    nomDe: (id) => byId.get(id)?.nom ?? '?',
    numeroDe: (id) => byId.get(id)?.numero ?? 0,
  };
}

/** RG-8.2 / RG-8.6 : exemplaires vrais en circulation, pour la table de tirage. */
export async function circulation(db: DbOrTx, partieId: string): Promise<Map<string, number>> {
  // Lu à chaque tirage : la base compte elle-même (une ligne par carte au lieu d'une par exemplaire, offre gratuite).
  // Même règle que countInCirculation : un exemplaire compte pour sa carte, un déguisé pour sa vraie carte, une copie ratée pour rien.
  const vraie = sql<string | null>`case when ${exemplaires.faux} is null then ${exemplaires.carteId} when ${exemplaires.faux}->>'nature' = 'deguise' then ${exemplaires.faux}->>'vraieCarteId' end`;
  const rows = await db.select({ carteId: vraie, n: count() }).from(exemplaires).where(eq(exemplaires.partieId, partieId)).groupBy(vraie);
  return new Map(rows.flatMap((r) => (r.carteId === null ? [] : [[r.carteId, r.n] as const])));
}

export async function catalogForDraw(db: DbOrTx, cat: Catalogue, partieId: string): Promise<CatalogCard[]> {
  const n = await circulation(db, partieId);
  return cat.cartes.map((c) => ({ id: c.id, rank: c.rang, enCirculation: n.get(c.id) ?? 0 }));
}

/** Limites d'exemplaires par rang (paramètres RG-14). */
export const limitesOf = (p: Record<'limiteSS' | 'limiteS' | 'limiteA' | 'limiteB' | 'limiteCD', number>): Record<Rank, number> => ({
  SS: p.limiteSS,
  S: p.limiteS,
  A: p.limiteA,
  B: p.limiteB,
  C: p.limiteCD,
  D: p.limiteCD,
});

// --- Balises ---

type BaliseRow = typeof balises.$inferSelect;

export const beaconOf = (b: BaliseRow): Beacon => ({ id: b.id, zoneId: b.zoneId, type: b.type, state: b.etat, stock: b.stock, epuiseeA: b.epuiseeA });

export async function loadBeacons(db: DbOrTx, partieId: string): Promise<Beacon[]> {
  return (await db.select().from(balises).where(eq(balises.partieId, partieId))).map(beaconOf);
}

/** Enregistre les balises modifiées. */
export async function saveBeacons(db: DbOrTx, partieId: string, before: readonly Beacon[], after: readonly Beacon[]): Promise<void> {
  const old = new Map(before.map((b) => [b.id, b]));
  for (const b of after) {
    if (same(old.get(b.id), b)) continue;
    await db.update(balises).set({ type: b.type, etat: b.state, stock: b.stock, epuiseeA: b.epuiseeA }).where(and(eq(balises.partieId, partieId), eq(balises.id, b.id))); // même QR possible dans une autre partie
  }
}

// --- Événements ---

type EvenementRow = typeof evenements.$inferSelect;

export const eventOf = (e: EvenementRow): GameEvent => ({
  id: e.id,
  zoneId: e.zoneId,
  debut: e.debut,
  fin: e.fin,
  etat: e.etat,
  data: e.data,
  ...(e.reussi !== null ? { reussi: e.reussi } : {}),
});

/** Événements encore marqués actifs (l'échéance est vérifiée par le moteur avec `isActive`). */
export async function loadActiveEvents(db: DbOrTx, partieId: string): Promise<GameEvent[]> {
  return (await db.select().from(evenements).where(and(eq(evenements.partieId, partieId), eq(evenements.etat, 'actif')))).map(eventOf);
}

export async function saveEvent(db: DbOrTx, partieId: string, e: GameEvent, lancePar?: string | null): Promise<void> {
  const row = { id: e.id, partieId, zoneId: e.zoneId, debut: e.debut, fin: e.fin, etat: e.etat, reussi: e.reussi ?? null, data: e.data };
  await db
    .insert(evenements)
    .values({ ...row, lancePar: lancePar ?? null })
    .onConflictDoUpdate({ target: evenements.id, set: row });
}

/** Joueurs de la partie hors ceux exclus (ids). */
/** Ce que lisent les tâches planifiées à chaque passage (toutes les 5 s) : pas la fiche entière. */
export type JoueurTache = Pick<JoueurRow, 'id' | 'pseudo' | 'statut' | 'geleJusqua' | 'derniereActionA' | 'position'>;
export async function loadJoueursTache(db: DbOrTx, partieId: string): Promise<JoueurTache[]> {
  return db
    .select({ id: joueurs.id, pseudo: joueurs.pseudo, statut: joueurs.statut, geleJusqua: joueurs.geleJusqua, derniereActionA: joueurs.derniereActionA, position: joueurs.position })
    .from(joueurs)
    .where(eq(joueurs.partieId, partieId));
}

/** Pseudos des joueurs d'une partie (provenances du Livre, noms dans les messages). */
export async function loadPseudos(db: DbOrTx, partieId: string): Promise<Map<string, string>> {
  const rows = await db.select({ id: joueurs.id, pseudo: joueurs.pseudo }).from(joueurs).where(eq(joueurs.partieId, partieId));
  return new Map(rows.map((j) => [j.id, j.pseudo]));
}

export async function loadJoueurs(db: DbOrTx, partieId: string, sauf: readonly string[] = []): Promise<JoueurRow[]> {
  const cond = sauf.length > 0 ? and(eq(joueurs.partieId, partieId), notInArray(joueurs.id, [...sauf])) : eq(joueurs.partieId, partieId);
  return db.select().from(joueurs).where(cond);
}
