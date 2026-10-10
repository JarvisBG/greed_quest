// Sorts (RG-10) et pouvoirs de Nen liés (RG-5.4). Un refus ne consomme rien ;
// un sort accepté est consommé même s'il est bloqué ou sans effet.
import type { GameState, NenType, PlayerStatus, PouvoirSpe, Rank, SpellType } from '@gq/shared';
import { addItem, cartesParEmplacement, removeItem, transferItem, type Book, type BookItem, type CardItem } from './book.js';
import { counterfeitsOnPage, revealItems } from './counterfeits.js';
import { isInRange, isTargetable, isValidPosition, zoneOf, type Polygon, type Position, type RangeSettings } from './geo.js';
import { pick, type Rng } from './rng.js';
import { estInvisible, speDisponibleDans } from './specialisation.js';

export const IMMUNITY_MS = 5 * 60_000; // RG-10.2
export const CASTER_DELAY_MS = 2 * 60_000; // RG-10.3
export const GEL_MS = 3 * 60_000; // RG-10 Gel
export const SS_THEFT_IMMUNITY_MS = 10 * 60_000; // RG-8.11
/** Amendement 2026-10-10 : Accompagnement, gel de la cible et position montrée au lanceur. */
export const ACCOMPAGNEMENT_MS = 3 * 60_000;

export type OffensiveSpell = 'vol' | 'echange_force' | 'gel' | 'pickpocket' | 'accompagnement';
/** Pouvoirs de Nen liés aux sorts : une fois par partie (document), rechargeables (amendement 2026-10-10). */
export type NenPower = 'renforcement' | 'emission' | 'manipulation';

export interface SpellPlayer {
  id: string;
  status: PlayerStatus;
  position: Position | null;
  book: Book;
  nen: NenType;
  /** Heure de jeu du dernier usage de chaque pouvoir (absent = jamais utilisé). */
  pouvoirsA: Readonly<Partial<Record<NenPower, number>>>;
  immuniteJusqua: number | null;
  dernierOffensifA: number | null;
  geleJusqua: number | null;
  /** RG-13.1 : Livre gelé après un Clear provisoire, plus aucun sort ne peut le viser. */
  livreGele: boolean;
  /** Spécialisation (amendement 2026-10-10) : pouvoir, dernier usage, fin du Zetsu. */
  pouvoirSpe?: PouvoirSpe | null;
  speA?: number | null;
  zetsuJusqua?: number | null;
  /** Amendement 2026-10-10 : sous Accompagnement (ni scan, ni sort, ni échange) jusqu'à cette heure. */
  accompagneJusqua?: number | null;
}

export interface SpellWorld {
  now: number;
  gameState: GameState;
  portee: RangeSettings;
  rangDe: (cardId: string) => Rank;
  newId: () => string;
  /**
   * Amendement 2026-10-10 : recharge des pouvoirs de Nen (ms). Pouvoir absent = une fois par partie (RG-5.4).
   * Par défaut du jeu : Renforcement 30 min, Émission et Manipulation 40 min (`rechargesNenMs`).
   */
  rechargeNenMs?: Partial<Record<NenPower, number>>;
  /** Recharge des pouvoirs de Spécialisation (Bandit), en ms. */
  rechargeSpeMs?: number;
  /**
   * RG-8.5 amendé : cartes désignées, dans l'ordre du catalogue. Vol ne prend que dans les emplacements fixes,
   * Pickpocket que dans les libres ; sans elles, Vol prend n'importe quelle carte (règle d'avant l'amendement).
   */
  designees?: readonly string[];
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
  | 'page_invalide'
  | 'cible_non_rencontree'
  | 'ville_inconnue';

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
  if (p.accompagneJusqua != null && p.accompagneJusqua > w.now) {
    return refuse('lanceur_bloque', `Tu es sous Accompagnement : attends encore ${secondes(p.accompagneJusqua - w.now)} s`);
  }
  if (!isValidPosition(p.position, w.now)) return refuse('gps_invalide', 'Position GPS introuvable : active ta localisation'); // RG-7.6
  return null;
}

function findSpellCard(book: Book, itemId: string, sort: SpellType): BookItem | null {
  const item = book.items.find((i) => i.id === itemId);
  return item?.kind === 'sort' && item.spell === sort ? item : null;
}

const usePower = (w: SpellWorld, p: SpellPlayer, power: NenPower): SpellPlayer => ({ ...p, pouvoirsA: { ...p.pouvoirsA, [power]: w.now } });

/**
 * RG-5.4 amendé (2026-10-10) : temps avant que le pouvoir soit de nouveau disponible (0 = disponible),
 * null si le joueur n'a pas ce pouvoir ou s'il l'a déjà utilisé et qu'il ne se recharge pas.
 */
export function pouvoirDisponibleDans(
  p: { nen: NenType | null; pouvoirsA: Readonly<Partial<Record<NenPower, number>>> },
  power: NenPower,
  now: number,
  rechargeMs: number | undefined,
): number | null {
  if (p.nen !== power) return null;
  const dernier = p.pouvoirsA[power];
  if (dernier === undefined) return 0;
  if (rechargeMs === undefined) return null;
  return Math.max(0, dernier + rechargeMs - now);
}
const hasPower = (w: SpellWorld, p: SpellPlayer, power: NenPower) => pouvoirDisponibleDans(p, power, w.now, w.rechargeNenMs?.[power]) === 0;

/** RG-8.11 : une SS ne peut pas être prise dans les 10 min qui suivent son obtention. */
export function takeableCards(book: Book, now: number, rangDe: (cardId: string) => Rank): CardItem[] {
  return book.items.filter(
    (i): i is CardItem =>
      i.kind === 'carte' &&
      !(rangDe(i.cardId) === 'SS' && now - i.obtenuA < SS_THEFT_IMMUNITY_MS) &&
      // Coffre scellé (objet, amendement 2026-10-10).
      !(i.coffreJusqua !== undefined && i.coffreJusqua > now),
  );
}

/** Voile d'ombre (objet, amendement 2026-10-10) : le plus ancien du Livre, s'il y en a un. */
export function voileDe(book: Book): BookItem | undefined {
  return [...book.items].sort((a, b) => a.obtenuA - b.obtenuA).find((i) => i.kind === 'objet' && i.objet === 'voile');
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
  /** Bandit (Spécialisation) : carte du catalogue visée ; prise si la cible en a un exemplaire prenable, jamais la SS. */
  carteVoulueId?: string;
  /** Accompagnement : le lanceur a déjà croisé la cible (comme Regard). */
  rencontre?: boolean;
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

  // Source : carte de sort, pouvoir de Manipulation (échange forcé gratuit) ou de Bandit (Vol gratuit, Spécialisation).
  const bandit = source.type === 'pouvoir' && sort === 'vol';
  if (source.type === 'pouvoir') {
    const ok = bandit
      ? speDisponibleDans({ pouvoirSpe: lanceur.pouvoirSpe ?? null, speA: lanceur.speA ?? null }, 'bandit', w.now, w.rechargeSpeMs ?? Infinity) === 0
      : sort === 'echange_force' && hasPower(w, lanceur, 'manipulation');
    if (!ok) return refuse('pouvoir_indisponible', 'Pouvoir indisponible');
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
  if (cible.livreGele) return refuse('cible_livre_gele', 'Ce joueur a complété son Book : il ne peut plus être visé');
  if (!isTargetable(cible.position, w.now, w.portee) || estInvisible(cible, w.now)) return refuse('cible_hors_radar', 'Ce joueur est hors radar'); // RG-10.10 amendé, Zetsu
  // Accompagnement (amendement 2026-10-10) : pas de portée, mais un joueur déjà croisé.
  if (sort === 'accompagnement' && !input.rencontre) return refuse('cible_non_rencontree', 'Tu n’as encore jamais croisé ce joueur');
  let viaEmission = false;
  if (sort !== 'accompagnement' && !isInRange(lanceur.position!, cible.position, w.portee)) {
    if (!input.emission || !hasPower(w, lanceur, 'emission')) return refuse('cible_hors_portee', 'Ce joueur est hors de portée');
    viaEmission = true; // RG-10.1
  }
  if (cible.immuniteJusqua !== null && cible.immuniteJusqua > w.now) {
    return refuse('cible_immunisee', `Ce joueur est protégé encore ${secondes(cible.immuniteJusqua - w.now)} s`); // RG-10.2
  }
  let carteDonnee: CardItem | undefined;
  if (sort === 'echange_force') {
    const item = lanceur.book.items.find((i) => i.id === input.carteDonneeId);
    if (item?.kind !== 'carte') return refuse('carte_absente', 'Choisis une carte de ton Book à donner');
    carteDonnee = item;
  }

  // Le sort est lancé : on le consomme.
  lanceur =
    source.type === 'carte'
      ? { ...lanceur, book: removeItem(lanceur.book, source.itemId) }
      : bandit
        ? { ...lanceur, speA: w.now }
        : usePower(w, lanceur, 'manipulation');
  // Zetsu : attaquer rompt l'invisibilité.
  if (estInvisible(lanceur, w.now)) lanceur = { ...lanceur, zetsuJusqua: null };
  if (viaEmission) lanceur = usePower(w, lanceur, 'emission');
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
  if (hasPower(w, cible, 'renforcement')) {
    cible = usePower(w, cible, 'renforcement');
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
    case 'accompagnement': {
      // Gelée 3 min (ni scan, ni sort, ni échange) ; sa position est montrée au lanceur pendant ce temps (API).
      const fin = w.now + ACCOMPAGNEMENT_MS;
      cible = { ...cible, geleJusqua: Math.max(cible.geleJusqua ?? 0, fin), accompagneJusqua: fin };
      return reussi();
    }
    case 'vol':
    case 'pickpocket': {
      const prenables = takeableCards(cible.book, w.now, w.rangDe);
      // RG-10 amendé : Vol prend dans les emplacements fixes, Pickpocket dans les libres.
      const emplacements = w.designees ? cartesParEmplacement(cible.book, w.designees) : null;
      const zone = emplacements ? new Set((sort === 'vol' ? emplacements.fixes : emplacements.libres).map((c) => c.id)) : null;
      const auHasard = zone ? prenables.filter((c) => zone.has(c.id)) : prenables;
      // Bandit : la carte visée si la cible en a un exemplaire prenable (jamais la SS), où qu'elle soit ; sinon au hasard.
      const visee = bandit && input.carteVoulueId ? prenables.find((c) => c.cardId === input.carteVoulueId && w.rangDe(c.cardId) !== 'SS') : undefined;
      if (!visee && auHasard.length === 0) return { ok: true, resultat: 'sans_effet', lanceur, cible, notice: notice('sans_effet') };
      const t = transferItem(cible.book, lanceur.book, (visee ?? pick(rng, auHasard)).id, {
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
  /** Radar, Regard : Voile d'ombre de la cible consommé (objet, amendement 2026-10-10). */
  voile?: { cibleBook: Book };
}

/** Radar et Regard bloqués par un Voile d'ombre : le sort est consommé, le lanceur ne voit rien. */
function voileBloque<T>(lanceur: SpellPlayer, cible: { id: string; book?: Book }, sort: SpellType, vide: T): SimpleSuccess<T> | null {
  const voile = cible.book ? voileDe(cible.book) : undefined;
  if (!voile || !cible.book) return null;
  return {
    ok: true,
    lanceur,
    resultat: vide,
    notice: { lanceur: lanceur.id, cible: cible.id, sort, resultat: 'bloque' },
    voile: { cibleBook: removeItem(cible.book, voile.id) },
  };
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
  return refuse('sort_passif', 'Le Mur défensif agit tout seul : garde-le dans ton Book');
}

/** Radar : zone de la dernière position connue d'un joueur choisi. La cible est prévenue (RG-10.5). */
export function castRadar(
  w: SpellWorld,
  input: {
    lanceur: SpellPlayer;
    itemId: string;
    /** `book` : pour le Voile d'ombre de la cible. */
    cible: { id: string; position: Position | null; book?: Book; zetsuJusqua?: number | null };
    zones: readonly { id: string; polygon: Polygon }[];
  },
): SimpleSuccess<{ zoneId: string | null }> | SpellRefusal {
  if (input.cible.id === input.lanceur.id) return refuse('cible_invalide', 'Cible invalide');
  if (estInvisible(input.cible, w.now)) return refuse('cible_hors_radar', 'Ce joueur est hors radar'); // Zetsu
  const lanceur = consumeSimple(w, input.lanceur, input.itemId, 'radar');
  if (isRefusal(lanceur)) return lanceur;
  const voile = voileBloque(lanceur, input.cible, 'radar', { zoneId: null });
  if (voile) return voile;
  const zoneId = input.cible.position ? zoneOf(input.cible.position, input.zones) : null;
  return {
    ok: true,
    lanceur,
    resultat: { zoneId },
    notice: { lanceur: lanceur.id, cible: input.cible.id, sort: 'radar', resultat: zoneId ? 'reussi' : 'sans_effet' },
  };
}

/** Ce que Regard montre d'une carte. */
export interface CarteVue {
  cardId: string;
  n: number;
  /** Copie déjà démasquée par son détenteur : elle apparaît comme contrefaçon. */
  contrefacon: boolean;
}

/**
 * Amendement 2026-10-09 : Regard (« Peek » de Greed Island). Montre les cartes d'un joueur déjà rencontré,
 * telles qu'elles paraissent : une contrefaçon non démasquée paraît vraie (bluff), sorts non montrés.
 * La cible est prévenue sans savoir qui a regardé ; le Livre gelé d'un Clear provisoire est protégé (RG-13.1).
 */
export function castRegard(
  w: SpellWorld,
  input: {
    lanceur: SpellPlayer;
    itemId: string;
    cible: { id: string; book: Book; livreGele: boolean; zetsuJusqua?: number | null };
    rencontre: boolean;
    /** Amendement 2026-10-10 : `regard` (Voyance) montre les emplacements libres, `clairvoyance` les emplacements fixes. */
    sort?: 'regard' | 'clairvoyance';
  },
): SimpleSuccess<{ cartes: CarteVue[] }> | SpellRefusal {
  const sort = input.sort ?? 'regard';
  if (input.cible.id === input.lanceur.id) return refuse('cible_invalide', 'Cible invalide');
  if (estInvisible(input.cible, w.now)) return refuse('cible_hors_radar', 'Ce joueur est hors radar'); // Zetsu
  if (!input.rencontre) return refuse('cible_non_rencontree', 'Tu n’as encore jamais croisé ce joueur');
  if (input.cible.livreGele) return refuse('cible_livre_gele', 'Ce Book est protégé');
  const lanceur = consumeSimple(w, input.lanceur, input.itemId, sort);
  if (isRefusal(lanceur)) return lanceur;
  const voile = voileBloque<{ cartes: CarteVue[] }>(lanceur, input.cible, sort, { cartes: [] });
  if (voile) return voile;
  const emplacements = w.designees ? cartesParEmplacement(input.cible.book, w.designees) : null;
  const montrees = emplacements ? (sort === 'clairvoyance' ? emplacements.fixes : emplacements.libres) : input.cible.book.items;
  const vues = new Map<string, CarteVue>();
  for (const i of montrees) {
    if (i.kind !== 'carte') continue;
    const contrefacon = !!i.faux && i.marque === 'demasquee';
    const cle = `${i.cardId}:${contrefacon}`;
    const v = vues.get(cle);
    if (v) v.n++;
    else vues.set(cle, { cardId: i.cardId, n: 1, contrefacon });
  }
  return {
    ok: true,
    lanceur,
    resultat: { cartes: [...vues.values()] },
    notice: { lanceur: lanceur.id, cible: input.cible.id, sort, resultat: 'reussi' },
  };
}

/** Villes de Greed Island dont les services s'utilisent à distance avec Retour. */
export type VilleRetour = 'masadora' | 'antokiba';

/**
 * Amendement 2026-10-10 : Retour. Consomme la carte et ouvre une visite à distance d'une ville déjà visitée
 * (son QR scanné dans la partie) ; l'API fixe la durée de la visite.
 */
export function castRetour(
  w: SpellWorld,
  input: { lanceur: SpellPlayer; itemId: string; ville: VilleRetour; visitees: readonly string[] },
): SimpleSuccess<{ ville: VilleRetour }> | SpellRefusal {
  if (!input.visitees.includes(input.ville)) {
    return refuse('ville_inconnue', `Tu n’es encore jamais allé à ${input.ville === 'masadora' ? 'Masadora' : 'Antokiba'}`);
  }
  const lanceur = consumeSimple(w, input.lanceur, input.itemId, 'retour');
  if (isRefusal(lanceur)) return lanceur;
  return { ok: true, lanceur, resultat: { ville: input.ville }, notice: { lanceur: lanceur.id, cible: null, sort: 'retour', resultat: 'reussi' } };
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
  if (modele?.kind !== 'carte') return refuse('carte_absente', 'Choisis une carte de ton Book');
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
