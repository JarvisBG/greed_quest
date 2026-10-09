// Sorts (RG-10) et pouvoirs de Nen liés (RG-5.4). Un refus ne consomme rien ;
// un sort accepté est consommé même s'il est bloqué ou sans effet.
import type { GameState, NenType, PlayerStatus, Rank, SpellType } from '@gq/shared';
import { addItem, removeItem, transferItem, type Book, type BookItem, type CardItem } from './book.js';
import { counterfeitsOnPage, revealItems } from './counterfeits.js';
import { isInRange, isOffRadar, isValidPosition, zoneOf, type Polygon, type Position, type RangeSettings } from './geo.js';
import { pick, type Rng } from './rng.js';

export const IMMUNITY_MS = 5 * 60_000; // RG-10.2
export const CASTER_DELAY_MS = 2 * 60_000; // RG-10.3
export const GEL_MS = 3 * 60_000; // RG-10 Gel
export const SS_THEFT_IMMUNITY_MS = 10 * 60_000; // RG-8.11

export type OffensiveSpell = 'vol' | 'echange_force' | 'gel';
/** Pouvoirs de Nen utilisables une fois par partie. */
export type NenPower = 'renforcement' | 'emission' | 'manipulation';

export interface SpellPlayer {
  id: string;
  status: PlayerStatus;
  position: Position | null;
  book: Book;
  nen: NenType;
  pouvoirsUtilises: readonly NenPower[];
  immuniteJusqua: number | null;
  dernierOffensifA: number | null;
  geleJusqua: number | null;
  /** RG-13.1 : Livre gelé après un Clear provisoire, plus aucun sort ne peut le viser. */
  livreGele: boolean;
}

export interface SpellWorld {
  now: number;
  gameState: GameState;
  portee: RangeSettings;
  rangDe: (cardId: string) => Rank;
  newId: () => string;
}

export type SpellRefusalCode =
  | 'partie_fermee'
  | 'lanceur_bloque'
  | 'gps_invalide'
  | 'sort_absent'
  | 'sort_passif'
  | 'pouvoir_indisponible'
  | 'delai_lanceur'
  | 'cible_invalide'
  | 'cible_livre_gele'
  | 'cible_hors_radar'
  | 'cible_hors_portee'
  | 'cible_immunisee'
  | 'carte_absente'
  | 'page_invalide';

export interface SpellRefusal {
  ok: false;
  code: SpellRefusalCode;
  message: string;
}

const refuse = (code: SpellRefusalCode, message: string): SpellRefusal => ({ ok: false, code, message });
const secondes = (ms: number) => Math.ceil(ms / 1000);

/** Ce qui s'affiche sur l'écran géant (RG-10.6) et dans l'alerte de la cible (RG-10.5). */
export interface SpellNotice {
  lanceur: string;
  cible: string | null;
  sort: SpellType;
  resultat: 'reussi' | 'bloque' | 'sans_effet';
}

/** Origine du sort lancé : une carte du Livre, ou le pouvoir de Manipulation (échange forcé gratuit). */
export type SpellSource = { type: 'carte'; itemId: string } | { type: 'pouvoir' };

// --- Vérifications communes ---

function checkCaster(w: SpellWorld, p: SpellPlayer): SpellRefusal | null {
  if (w.gameState !== 'en_cours' && w.gameState !== 'phase_finale') {
    return refuse('partie_fermee', w.gameState === 'pause' ? 'La partie est en pause' : 'Les sorts sont indisponibles');
  }
  if (p.status === 'disqualifie' || p.status === 'abandon' || p.status === 'gele') {
    return refuse('lanceur_bloque', 'Tu ne peux pas lancer de sort maintenant');
  }
  if (!isValidPosition(p.position, w.now)) return refuse('gps_invalide', 'Position GPS introuvable : active ta localisation'); // RG-7.6
  return null;
}

function findSpellCard(book: Book, itemId: string, sort: SpellType): BookItem | null {
  const item = book.items.find((i) => i.id === itemId);
  return item?.kind === 'sort' && item.spell === sort ? item : null;
}

const usePower = (p: SpellPlayer, power: NenPower): SpellPlayer => ({ ...p, pouvoirsUtilises: [...p.pouvoirsUtilises, power] });
const hasPower = (p: SpellPlayer, power: NenPower) => p.nen === power && !p.pouvoirsUtilises.includes(power);

/** RG-8.11 : une SS ne peut pas être prise dans les 10 min qui suivent son obtention. */
export function takeableCards(book: Book, now: number, rangDe: (cardId: string) => Rank): CardItem[] {
  return book.items.filter(
    (i): i is CardItem => i.kind === 'carte' && !(rangDe(i.cardId) === 'SS' && now - i.obtenuA < SS_THEFT_IMMUNITY_MS),
  );
}

// --- Sorts offensifs (Vol, Échange forcé, Gel) ---

export interface OffensiveInput {
  sort: OffensiveSpell;
  source: SpellSource;
  lanceur: SpellPlayer;
  cible: SpellPlayer;
  /** Utiliser le pouvoir d'Émission si la cible est hors portée (RG-10.1). */
  emission?: boolean;
  /** Échange forcé : carte choisie par le lanceur. */
  carteDonneeId?: string;
}

export interface OffensiveSuccess {
  ok: true;
  resultat: 'reussi' | 'bloque' | 'sans_effet';
  /** RG-10.4 : protection consommée. */
  protection?: 'barriere' | 'renforcement';
  lanceur: SpellPlayer;
  cible: SpellPlayer;
  donne?: BookItem;
  recu?: BookItem;
  /** RG-10.5 (alerte à la cible) et RG-10.6 (écran géant). */
  notice: SpellNotice;
}

export function castOffensive(w: SpellWorld, input: OffensiveInput, rng: Rng): OffensiveSuccess | SpellRefusal {
  const { sort, source } = input;
  let { lanceur, cible } = input;

  const bloque = checkCaster(w, lanceur);
  if (bloque) return bloque;

  // Source : carte de sort, ou pouvoir de Manipulation (1 échange forcé gratuit).
  if (source.type === 'pouvoir') {
    if (sort !== 'echange_force' || !hasPower(lanceur, 'manipulation')) {
      return refuse('pouvoir_indisponible', 'Pouvoir indisponible');
    }
  } else if (!findSpellCard(lanceur.book, source.itemId, sort)) {
    return refuse('sort_absent', "Tu n'as pas ce sort");
  }

  // RG-10.3 : 2 min entre deux sorts offensifs du même lanceur.
  if (lanceur.dernierOffensifA !== null) {
    const attente = lanceur.dernierOffensifA + CASTER_DELAY_MS - w.now;
    if (attente > 0) return refuse('delai_lanceur', `Attends encore ${secondes(attente)} s avant un nouveau sort offensif`);
  }

  // Cible.
  if (cible.id === lanceur.id || cible.status === 'disqualifie' || cible.status === 'abandon') {
    return refuse('cible_invalide', 'Cible invalide');
  }
  if (cible.livreGele) return refuse('cible_livre_gele', 'Ce joueur a complété son Livre : il ne peut plus être visé');
  if (isOffRadar(cible.position, w.now) || cible.position === null) return refuse('cible_hors_radar', 'Ce joueur est hors radar'); // RG-10.10
  let viaEmission = false;
  if (!isInRange(lanceur.position!, cible.position, w.portee)) {
    if (!input.emission || !hasPower(lanceur, 'emission')) return refuse('cible_hors_portee', 'Ce joueur est hors de portée');
    viaEmission = true; // RG-10.1
  }
  if (cible.immuniteJusqua !== null && cible.immuniteJusqua > w.now) {
    return refuse('cible_immunisee', `Ce joueur est protégé encore ${secondes(cible.immuniteJusqua - w.now)} s`); // RG-10.2
  }
  let carteDonnee: CardItem | undefined;
  if (sort === 'echange_force') {
    const item = lanceur.book.items.find((i) => i.id === input.carteDonneeId);
    if (item?.kind !== 'carte') return refuse('carte_absente', 'Choisis une carte de ton Livre à donner');
    carteDonnee = item;
  }

  // Le sort est lancé : on le consomme.
  lanceur =
    source.type === 'carte'
      ? { ...lanceur, book: removeItem(lanceur.book, source.itemId) }
      : usePower(lanceur, 'manipulation');
  if (viaEmission) lanceur = usePower(lanceur, 'emission');
  lanceur = { ...lanceur, dernierOffensifA: w.now };

  const notice = (resultat: SpellNotice['resultat']): SpellNotice => ({ lanceur: lanceur.id, cible: cible.id, sort, resultat });

  // RG-10.4 : Barrière d'abord, puis Renforcement. Une protection consommée est perdue.
  const barriere = [...cible.book.items]
    .sort((a, b) => a.obtenuA - b.obtenuA)
    .find((i) => i.kind === 'sort' && i.spell === 'barriere');
  if (barriere) {
    cible = { ...cible, book: removeItem(cible.book, barriere.id) };
    return { ok: true, resultat: 'bloque', protection: 'barriere', lanceur, cible, notice: notice('bloque') };
  }
  if (hasPower(cible, 'renforcement')) {
    cible = usePower(cible, 'renforcement');
    return { ok: true, resultat: 'bloque', protection: 'renforcement', lanceur, cible, notice: notice('bloque') };
  }

  const reussi = (extra: Pick<OffensiveSuccess, 'donne' | 'recu'> = {}): OffensiveSuccess => ({
    ok: true,
    resultat: 'reussi',
    lanceur,
    cible: { ...cible, immuniteJusqua: w.now + IMMUNITY_MS }, // RG-10.2
    ...extra,
    notice: notice('reussi'),
  });

  switch (sort) {
    case 'gel': {
      const fin = Math.max(cible.geleJusqua ?? 0, w.now + GEL_MS);
      cible = { ...cible, geleJusqua: fin };
      return reussi();
    }
    case 'vol': {
      const prenables = takeableCards(cible.book, w.now, w.rangDe);
      if (prenables.length === 0) return { ok: true, resultat: 'sans_effet', lanceur, cible, notice: notice('sans_effet') };
      const t = transferItem(cible.book, lanceur.book, pick(rng, prenables).id, {
        now: w.now,
        origine: { type: 'vol', sur: cible.id },
        perte: { cause: 'vol', par: lanceur.id },
      });
      cible = { ...cible, book: t.from };
      lanceur = { ...lanceur, book: t.to };
      return reussi({ recu: t.item });
    }
    case 'echange_force': {
      const prenables = takeableCards(cible.book, w.now, w.rangDe);
      if (prenables.length === 0) return { ok: true, resultat: 'sans_effet', lanceur, cible, notice: notice('sans_effet') };
      // La carte reçue est tirée avant le don, pour ne jamais récupérer sa propre carte.
      const prise = pick(rng, prenables);
      const don = transferItem(lanceur.book, cible.book, carteDonnee!.id, {
        now: w.now,
        origine: { type: 'echange', avec: lanceur.id },
        perte: { cause: 'echange_force', par: cible.id },
      });
      const recu = transferItem(don.to, don.from, prise.id, {
        now: w.now,
        origine: { type: 'echange', avec: cible.id },
        perte: { cause: 'echange_force', par: lanceur.id },
      });
      lanceur = { ...lanceur, book: recu.to };
      cible = { ...cible, book: recu.from };
      return reussi({ donne: don.item, recu: recu.item });
    }
  }
}

// --- Sorts non offensifs ---

export interface SimpleSuccess<T> {
  ok: true;
  lanceur: SpellPlayer;
  resultat: T;
  notice: SpellNotice;
}

/** Vérifie le lanceur et retire la carte de sort. La Barrière ne se lance pas : elle agit seule. */
function consumeSimple(w: SpellWorld, lanceur: SpellPlayer, itemId: string, sort: SpellType): SpellPlayer | SpellRefusal {
  const bloque = checkCaster(w, lanceur);
  if (bloque) return bloque;
  if (!findSpellCard(lanceur.book, itemId, sort)) return refuse('sort_absent', "Tu n'as pas ce sort");
  return { ...lanceur, book: removeItem(lanceur.book, itemId) };
}

const isRefusal = (x: SpellPlayer | SpellRefusal): x is SpellRefusal => 'ok' in x;

export function castBarrier(): SpellRefusal {
  return refuse('sort_passif', 'La Barrière agit toute seule : garde-la dans ton Livre');
}

/** Radar : zone de la dernière position connue d'un joueur choisi. La cible est prévenue (RG-10.5). */
export function castRadar(
  w: SpellWorld,
  input: { lanceur: SpellPlayer; itemId: string; cible: { id: string; position: Position | null }; zones: readonly { id: string; polygon: Polygon }[] },
): SimpleSuccess<{ zoneId: string | null }> | SpellRefusal {
  if (input.cible.id === input.lanceur.id) return refuse('cible_invalide', 'Cible invalide');
  const lanceur = consumeSimple(w, input.lanceur, input.itemId, 'radar');
  if (isRefusal(lanceur)) return lanceur;
  const zoneId = input.cible.position ? zoneOf(input.cible.position, input.zones) : null;
  return {
    ok: true,
    lanceur,
    resultat: { zoneId },
    notice: { lanceur: lanceur.id, cible: input.cible.id, sort: 'radar', resultat: zoneId ? 'reussi' : 'sans_effet' },
  };
}

/** Révélation : zone d'une balise rare active, au hasard. */
export function castRevelation(
  w: SpellWorld,
  input: { lanceur: SpellPlayer; itemId: string; balisesRaresActives: readonly { zoneId: string }[] },
  rng: Rng,
): SimpleSuccess<{ zoneId: string | null }> | SpellRefusal {
  const lanceur = consumeSimple(w, input.lanceur, input.itemId, 'revelation');
  if (isRefusal(lanceur)) return lanceur;
  const zoneId = input.balisesRaresActives.length > 0 ? pick(rng, input.balisesRaresActives).zoneId : null;
  return {
    ok: true,
    lanceur,
    resultat: { zoneId },
    notice: { lanceur: lanceur.id, cible: null, sort: 'revelation', resultat: zoneId ? 'reussi' : 'sans_effet' },
  };
}

/**
 * Duplication (RG-10.7) : vraie copie si la carte est sous sa limite, contrefaçon sinon (RG-8.7).
 * Copier une contrefaçon donne toujours une contrefaçon.
 */
export function castDuplication(
  w: SpellWorld,
  input: { lanceur: SpellPlayer; itemId: string; carteItemId: string; sousLimite: (cardId: string) => boolean },
): SimpleSuccess<{ copie: CardItem }> | SpellRefusal {
  const modele = input.lanceur.book.items.find((i) => i.id === input.carteItemId);
  if (modele?.kind !== 'carte') return refuse('carte_absente', 'Choisis une carte de ton Livre');
  let lanceur = consumeSimple(w, input.lanceur, input.itemId, 'duplication');
  if (isRefusal(lanceur)) return lanceur;

  const base = { kind: 'carte' as const, id: w.newId(), cardId: modele.cardId, origine: { type: 'duplication' as const }, obtenuA: w.now };
  const copie: CardItem =
    !modele.faux && input.sousLimite(modele.cardId) ? base : { ...base, faux: { nature: 'copie' }, marque: 'creee' };
  lanceur = { ...lanceur, book: addItem(lanceur.book, copie) };
  return { ok: true, lanceur, resultat: { copie }, notice: { lanceur: lanceur.id, cible: null, sort: 'duplication', resultat: 'reussi' } };
}

/**
 * Analyse (RG-10.8) : révèle les contrefaçons d'une page de son propre Livre (pages numérotées à partir de 1).
 * La page est lue avant de retirer la carte Analyse. Résultat visible du lanceur seulement.
 * Effets de la révélation : RG-8.9 (revealItems).
 */
export function castAnalyse(
  w: SpellWorld,
  input: { lanceur: SpellPlayer; itemId: string; page: number; designees: readonly string[] },
): SimpleSuccess<{ contrefacons: string[] }> | SpellRefusal {
  const ids = counterfeitsOnPage(input.lanceur.book, input.designees, input.page);
  if (ids === null) return refuse('page_invalide', 'Cette page n’existe pas');

  let lanceur = consumeSimple(w, input.lanceur, input.itemId, 'analyse');
  if (isRefusal(lanceur)) return lanceur;
  lanceur = { ...lanceur, book: revealItems(lanceur.book, ids) };
  return { ok: true, lanceur, resultat: { contrefacons: ids }, notice: { lanceur: lanceur.id, cible: null, sort: 'analyse', resultat: 'reussi' } };
}
