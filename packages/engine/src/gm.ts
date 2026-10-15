// Cartes de Maître du jeu (RG-8.15 à 8.21, amendement du 2026-10-15, Sivraj) : cadre noir, chacune unique dans la
// partie, usage unique puis retour au Maître du jeu. « Jarvis tout-puissant » : Décret (une carte désignée choisie
// apparaît, reprise à un détenteur si sa limite est atteinte) et Jugement (joueurs à portée figés 3 min, lanceur
// intouchable 10 min) ; rien ne les arrête. « Le Sceau d'Ange » : Book d'un joueur à portée scellé 5 min.
import type { CarteGm, GameState, PlayerStatus, Rank } from '@gq/shared';
import { addItem, layoutBook, removeItem, transferItem, type Book, type BookItem, type CardItem, type GmItem } from './book.js';
import { isInRange, isTargetable, isValidPosition, type Position, type RangeSettings } from './geo.js';
import { pick, type Rng } from './rng.js';
import { IMMUNITY_MS } from './spells.js';

/** RG-8.19 : Jugement, joueurs à portée figés (ni scan, ni sort, ni échange). */
export const JUGEMENT_FIGE_MS = 3 * 60_000;
/** RG-8.19 : Jugement, le lanceur est intouchable (aucun sort ne peut le viser). */
export const JUGEMENT_INTOUCHABLE_MS = 10 * 60_000;
/** RG-8.20 : Sceau, Book scellé (ni scan, ni sort, ni échange, ni déplacement de carte, ni objet). */
export const SCEAU_MS = 5 * 60_000;

const secondes = (ms: number) => Math.ceil(ms / 1000);
const actif = (t: number | null | undefined, now: number) => t != null && t > now;

/** États posés par les cartes de Maître du jeu, lus partout où le joueur agit (scan, sorts, échanges, Book). */
export interface EtatsGm {
  /** RG-8.19 : figé par le Jugement (ni scan, ni sort, ni échange). */
  figeJusqua?: number | null;
  /** RG-8.20 : Book scellé (ni scan, ni sort, ni échange, ni déplacement, ni objet). */
  scelleJusqua?: number | null;
  /** RG-8.19 : intouchable, aucun sort ni carte ne peut le viser. */
  intouchableJusqua?: number | null;
}

/** RG-8.19, RG-8.20 : refus en clair quand un état de Maître du jeu empêche d'agir, sinon null. */
export function blocageGm(p: EtatsGm, now: number, action: 'scan' | 'sort' | 'echange' | 'livre' | 'objet'): string | null {
  if (actif(p.scelleJusqua, now)) return `Ton Book est scellé par Ange : attends encore ${secondes(p.scelleJusqua! - now)} s`;
  if ((action === 'scan' || action === 'sort' || action === 'echange') && actif(p.figeJusqua, now)) {
    return `Tu es figé par le Jugement de Jarvis : attends encore ${secondes(p.figeJusqua! - now)} s`;
  }
  return null;
}
export const estIntouchable = (p: EtatsGm, now: number) => actif(p.intouchableJusqua, now);

export const cartesGmDe = (book: Book): GmItem[] => book.items.filter((i): i is GmItem => i.kind === 'gm');

/** RG-8.16 : au scan, chaque carte encore au Maître du jeu peut tomber, avec la probabilité `pct` (%) par scan. */
export function carteGmDeScan(libres: readonly CarteGm[], pct: number, rng: Rng): CarteGm | null {
  if (libres.length === 0 || pct <= 0 || rng.next() * 100 >= pct) return null;
  return pick(rng, libres);
}

export type GmRefusalCode =
  | 'partie_fermee'
  | 'joueur_bloque'
  | 'gps_invalide'
  | 'carte_absente'
  | 'carte_invalide'
  | 'carte_imprenable'
  | 'cible_invalide'
  | 'cible_livre_gele'
  | 'cible_hors_radar'
  | 'cible_hors_portee'
  | 'cible_immunisee'
  | 'cible_intouchable';
export interface GmRefusal {
  ok: false;
  code: GmRefusalCode;
  message: string;
}
const refuse = (code: GmRefusalCode, message: string): GmRefusal => ({ ok: false, code, message });

export interface GmJoueur extends EtatsGm {
  id: string;
  status: PlayerStatus;
  position: Position | null;
  book: Book;
  /** RG-13.1 : Book gelé par un Clear provisoire (ni ses cartes ni lui ne peuvent être visés). */
  livreGele: boolean;
  immuniteJusqua: number | null;
}

export interface GmMonde {
  now: number;
  gameState: GameState;
  portee: RangeSettings;
  rangDe: (cardId: string) => Rank;
  /** RG-8.1 : cartes désignées, dans l'ordre du catalogue. */
  designees: readonly string[];
  newId: () => string;
}

function verifierJoueur(w: GmMonde, p: GmJoueur, gm: CarteGm, itemId: string): GmItem | GmRefusal {
  if (w.gameState !== 'en_cours' && w.gameState !== 'phase_finale') {
    return refuse('partie_fermee', w.gameState === 'pause' ? 'La partie est en pause' : 'Les cartes sont indisponibles');
  }
  if (p.status === 'disqualifie' || p.status === 'abandon' || p.status === 'gele') return refuse('joueur_bloque', 'Tu ne peux pas jouer de carte maintenant');
  if (p.livreGele) return refuse('joueur_bloque', 'Ton Book est gelé : ses cartes sont inutilisables'); // RG-8.15
  const bloque = blocageGm(p, w.now, 'sort');
  if (bloque) return refuse('joueur_bloque', bloque);
  if (!isValidPosition(p.position, w.now)) return refuse('gps_invalide', 'Position GPS introuvable : active ta localisation'); // RG-7.6
  const item = p.book.items.find((i): i is GmItem => i.id === itemId && i.kind === 'gm');
  if (!item || item.gm !== gm) return refuse('carte_absente', 'Tu n’as pas cette carte');
  return item;
}
const estRefus = (x: object): x is GmRefusal => 'ok' in x && (x as GmRefusal).ok === false;

// --- Jarvis tout-puissant (RG-8.19) ---

export interface JarvisInput {
  lanceur: GmJoueur;
  /** Tous les autres joueurs de la partie (détenteurs possibles de la carte, joueurs à portée). */
  autres: readonly GmJoueur[];
  itemId: string;
  /** Carte désignée choisie pour le Décret. */
  carteVoulueId: string;
  /** RG-8.2 : limite d'exemplaires en circulation de la carte et nombre actuel (contrefaçons exclues). */
  limite: number;
  enCirculation: number;
}

export interface JarvisSuccess {
  ok: true;
  lanceur: GmJoueur;
  /** Joueurs modifiés (figés, ou privés de la carte reprise), à enregistrer. */
  autres: GmJoueur[];
  /** Carte apparue dans le Book du lanceur. */
  carte: CardItem;
  /** Détenteur à qui la carte a été reprise (limite atteinte), sinon absent. */
  reprisA?: string;
  /** Joueurs figés par le Jugement. */
  figes: string[];
  /** La carte jouée, qui revient au Maître du jeu. */
  rendue: GmItem;
}

/** RG-8.19 : cartes que le Décret peut faire apparaître (désignées, sauf la SS, absentes des emplacements fixes du lanceur). */
export function cartesDuDecret(book: Book, w: Pick<GmMonde, 'designees' | 'rangDe'>): string[] {
  const enPlace = new Set(layoutBook(book, w.designees).designes.filter((d) => d.slot.etat === 'plein').map((d) => d.cardId));
  return w.designees.filter((id) => !enPlace.has(id) && w.rangDe(id) !== 'SS');
}

export function jouerJarvis(w: GmMonde, input: JarvisInput, rng: Rng): JarvisSuccess | GmRefusal {
  const item = verifierJoueur(w, input.lanceur, 'jarvis', input.itemId);
  if (estRefus(item)) return item;
  if (!cartesDuDecret(input.lanceur.book, w).includes(input.carteVoulueId)) {
    return refuse('carte_invalide', w.rangDe(input.carteVoulueId) === 'SS' ? 'Le Décret ne peut pas créer la carte SS' : 'Choisis une carte désignée qui manque à ton Book');
  }

  let lanceur: GmJoueur = { ...input.lanceur, book: removeItem(input.lanceur.book, item.id) };
  const autres = new Map(input.autres.map((p) => [p.id, p]));
  let carte: CardItem;
  let reprisA: string | undefined;

  // Décret : la carte apparaît ; à sa limite, elle est reprise à un détenteur au hasard (aucune protection ne l'arrête,
  // sauf un Book gelé par un Clear provisoire, RG-13.1). Les contrefaçons ne comptent pas.
  if (input.enCirculation < input.limite) {
    carte = { kind: 'carte', id: w.newId(), cardId: input.carteVoulueId, origine: { type: 'decret' }, obtenuA: w.now };
    lanceur = { ...lanceur, book: addItem(lanceur.book, carte) };
  } else {
    const prenables = input.autres.flatMap((p) =>
      p.livreGele || p.status === 'disqualifie' ? [] : p.book.items.filter((i): i is CardItem => i.kind === 'carte' && i.cardId === input.carteVoulueId && !i.faux).map((c) => ({ p, c })),
    );
    if (prenables.length === 0) return refuse('carte_imprenable', 'Aucun exemplaire de cette carte ne peut être repris : choisis-en une autre');
    const { p, c } = pick(rng, prenables);
    const t = transferItem(p.book, lanceur.book, c.id, { now: w.now, origine: { type: 'decret' }, perte: { cause: 'decret', par: lanceur.id } });
    autres.set(p.id, { ...p, book: t.from });
    lanceur = { ...lanceur, book: t.to };
    carte = t.item as CardItem;
    reprisA = p.id;
  }

  // Jugement : les joueurs à portée sont figés 3 min (ni immunité, ni protection, ni Zetsu) ; le lanceur est intouchable 10 min.
  const figes: string[] = [];
  for (const p of autres.values()) {
    if (p.status === 'disqualifie' || p.status === 'abandon' || p.livreGele) continue;
    if (!isTargetable(p.position, w.now, w.portee) || !isInRange(lanceur.position!, p.position, w.portee)) continue;
    autres.set(p.id, { ...p, figeJusqua: Math.max(p.figeJusqua ?? 0, w.now + JUGEMENT_FIGE_MS) });
    figes.push(p.id);
  }
  lanceur = { ...lanceur, intouchableJusqua: w.now + JUGEMENT_INTOUCHABLE_MS };

  const modifies = [...autres.values()].filter((p) => p !== input.autres.find((x) => x.id === p.id));
  return { ok: true, lanceur, autres: modifies, carte, ...(reprisA ? { reprisA } : {}), figes, rendue: item };
}

// --- Le Sceau d'Ange (RG-8.20) ---

export interface SceauSuccess {
  ok: true;
  lanceur: GmJoueur;
  cible: GmJoueur;
  rendue: GmItem;
}

export function jouerSceau(w: GmMonde, input: { lanceur: GmJoueur; cible: GmJoueur; itemId: string }): SceauSuccess | GmRefusal {
  const item = verifierJoueur(w, input.lanceur, 'ange', input.itemId);
  if (estRefus(item)) return item;
  const { cible } = input;
  if (cible.id === input.lanceur.id || cible.status === 'disqualifie' || cible.status === 'abandon') return refuse('cible_invalide', 'Cible invalide');
  if (cible.livreGele) return refuse('cible_livre_gele', 'Ce joueur a complété son Book : il ne peut plus être visé'); // RG-13.1
  if (estIntouchable(cible, w.now)) return refuse('cible_intouchable', 'Ce joueur est intouchable'); // RG-8.19
  // Ni Mur défensif ni Zetsu ne la bloquent ; la cible doit être à portée.
  if (!isTargetable(cible.position, w.now, w.portee)) return refuse('cible_hors_radar', 'Ce joueur est hors radar');
  if (!isInRange(input.lanceur.position!, cible.position, w.portee)) return refuse('cible_hors_portee', 'Ce joueur est hors de portée');
  if (cible.immuniteJusqua !== null && cible.immuniteJusqua > w.now) {
    return refuse('cible_immunisee', `Ce joueur est protégé encore ${secondes(cible.immuniteJusqua - w.now)} s`);
  }
  const fin = w.now + SCEAU_MS;
  return {
    ok: true,
    lanceur: { ...input.lanceur, book: removeItem(input.lanceur.book, item.id) },
    // Ensuite, l'immunité de 5 min des sorts offensifs (RG-10.2) : le Sceau ne peut pas l'enchaîner.
    cible: { ...cible, scelleJusqua: Math.max(cible.scelleJusqua ?? 0, fin), immuniteJusqua: fin + IMMUNITY_MS },
    rendue: item,
  };
}

/** RG-8.17 : élément du Book d'une carte de Maître du jeu qui arrive chez un joueur (scan, raid, enchère, don). */
export const nouvelleCarteGm = (gm: CarteGm, id: string, now: number): GmItem => ({ kind: 'gm', id, gm, obtenuA: now });

/** RG-8.17 : comme les SS (RG-8.12), inactif depuis 20 min, abandon ou disqualification. */
export const RETOUR_GM_INACTIVITE_MS = 20 * 60_000;
export const doitRendreCartesGm = (p: { status: PlayerStatus; derniereActionA: number }, now: number) =>
  p.status === 'abandon' || p.status === 'disqualifie' || now - p.derniereActionA >= RETOUR_GM_INACTIVITE_MS;

/** RG-8.17 : un joueur qui quitte la partie (inactif 20 min, abandon, disqualification) rend ses cartes de Maître du jeu. */
export function rendreCartesGm(book: Book): { book: Book; rendues: GmItem[] } {
  const rendues = cartesGmDe(book);
  return { book: rendues.reduce((b, i) => removeItem(b, i.id), book), rendues };
}
