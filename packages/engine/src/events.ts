// Événements lancés par le GM (RG-12) et retour en jeu des SS (RG-8.12).
// Toutes les heures sont en horloge de jeu : la pause suspend les comptes à rebours.
import type { GameState, PlayerStatus, Rank, SpellType } from '@gq/shared';
import { removeItem, type Book, type BookItem, type CardItem, type SpellItem } from './book.js';
import { initialStock, type Beacon, type BeaconChange, type BeaconUpdate } from './beacons.js';
import { pick, randomInt, weightedPick, type Rng } from './rng.js';

export const EVENT_TYPES = [
  'apparition',
  'double_gain',
  'zone_maudite',
  'raid',
  'krach',
  'carte_maudite',
  'mission_secrete',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** Événements attachés à une zone : un seul à la fois par zone (RG-12.1). */
export const ZONE_EVENTS: readonly EventType[] = ['apparition', 'double_gain', 'zone_maudite'];

/** Durées par défaut du tableau RG-12 (la mission secrète est réglable : 20 min proposé). */
export const DEFAULT_EVENT_DURATION_MS: Record<EventType, number> = {
  apparition: 10 * 60_000,
  double_gain: 10 * 60_000,
  zone_maudite: 10 * 60_000,
  raid: 10 * 60_000,
  krach: 15 * 60_000,
  carte_maudite: 10 * 60_000,
  mission_secrete: 20 * 60_000,
};

export const SS_RETURN_INACTIVITY_MS = 20 * 60_000; // RG-8.12

export type EventData =
  | { type: 'apparition'; baliseId: string }
  | { type: 'double_gain' }
  | { type: 'zone_maudite' }
  | { type: 'raid'; pvMax: number; pv: number; participants: readonly string[]; reponses: readonly string[] }
  | { type: 'krach' }
  | { type: 'carte_maudite'; itemId: string }
  | { type: 'mission_secrete'; joueurId: string; objectif: string; recompenseJenny: number };

export interface GameEvent {
  id: string;
  zoneId: string | null;
  debut: number;
  fin: number;
  etat: 'actif' | 'termine' | 'annule';
  /** Raid vaincu ou mission validée avant la fin. */
  reussi?: boolean;
  data: EventData;
}

export const isActive = (e: GameEvent, now: number) => e.etat === 'actif' && now < e.fin;

// --- Effets lus par les autres modules ---

/** Zones fermées par une Zone maudite : leurs scans sont refusés (RG-7, étape 3). */
export function closedZones(events: readonly GameEvent[], now: number): Set<string> {
  return new Set(events.filter((e) => isActive(e, now) && e.data.type === 'zone_maudite' && e.zoneId).map((e) => e.zoneId!));
}

/** Double gain : nombre de gains par tirage dans la zone. Le stock de la balise ne baisse qu'une fois. */
export function gainsPerDraw(events: readonly GameEvent[], zoneId: string, now: number): number {
  return events.some((e) => isActive(e, now) && e.data.type === 'double_gain' && e.zoneId === zoneId) ? 2 : 1;
}

/** Krach de Masadora : multiplicateur du prix des paquets. */
export function shopPriceMultiplier(events: readonly GameEvent[], now: number): number {
  return events.some((e) => isActive(e, now) && e.data.type === 'krach') ? 0.5 : 1;
}

// --- Lancement (RG-12.1) ---

export type StartResult = { ok: true; event: GameEvent; beacons?: BeaconUpdate } | { ok: false; message: string };

interface StartBase {
  id: string;
  now: number;
  gameState: GameState;
  events: readonly GameEvent[];
  dureeMs?: number;
}

function checkStart(b: StartBase, type: EventType, zoneId: string | null): string | null {
  if (b.gameState !== 'en_cours' && b.gameState !== 'phase_finale') return 'Les événements se lancent pendant la partie';
  if (ZONE_EVENTS.includes(type)) {
    if (!zoneId) return 'Choisis une zone';
    const occupe = b.events.some((e) => isActive(e, b.now) && e.zoneId === zoneId && ZONE_EVENTS.includes(e.data.type));
    if (occupe) return 'Un événement est déjà en cours dans cette zone'; // RG-12.1
  }
  return null;
}

const make = (b: StartBase, zoneId: string | null, data: EventData): GameEvent => ({
  id: b.id,
  zoneId,
  debut: b.now,
  fin: b.now + (b.dureeMs ?? DEFAULT_EVENT_DURATION_MS[data.type]),
  etat: 'actif',
  data,
});

/** Double gain, Zone maudite (zone) ou Krach (global). */
export function startSimpleEvent(b: StartBase, type: 'double_gain' | 'zone_maudite' | 'krach', zoneId: string | null): StartResult {
  const err = checkStart(b, type, type === 'krach' ? null : zoneId);
  if (err) return { ok: false, message: err };
  return { ok: true, event: make(b, type === 'krach' ? null : zoneId, { type }) };
}

/** Apparition : une balise dormante de la zone passe en mode fantôme (1 ou 2 tirages S ou SS). */
export function startApparition(b: StartBase, zoneId: string, beacons: readonly Beacon[], rng: Rng): StartResult {
  const err = checkStart(b, 'apparition', zoneId);
  if (err) return { ok: false, message: err };
  const dormantes = beacons.filter((x) => x.zoneId === zoneId && x.state === 'dormante');
  if (dormantes.length === 0) return { ok: false, message: 'Aucune balise dormante dans cette zone' };
  const choisie = pick(rng, dormantes);
  const stock = initialStock('fantome', 0, rng);
  const change: BeaconChange = { beaconId: choisie.id, zoneId, from: 'dormante', to: 'active', cause: 'cible', type: 'fantome', stock };
  return {
    ok: true,
    event: make(b, zoneId, { type: 'apparition', baliseId: choisie.id }),
    beacons: {
      beacons: beacons.map((x) => (x.id === choisie.id ? { ...x, state: 'active', type: 'fantome', stock, epuiseeA: null } : x)),
      changes: [change],
    },
  };
}

/** Fin d'Apparition : la balise fantôme, si elle n'est pas épuisée, redevient dormante. */
export function endApparition(event: GameEvent, beacons: readonly Beacon[]): BeaconUpdate {
  if (event.data.type !== 'apparition') return { beacons: [...beacons], changes: [] };
  const id = event.data.baliseId;
  const changes: BeaconChange[] = [];
  const next = beacons.map((x) => {
    if (x.id !== id || x.type !== 'fantome' || x.state !== 'active') return x;
    changes.push({ beaconId: x.id, zoneId: x.zoneId, from: 'active', to: 'dormante', cause: 'rotation' });
    return { ...x, state: 'dormante' as const, type: null, stock: 0 };
  });
  return { beacons: next, changes };
}

// --- Raid de la Brigade ---

/** PV du boss : paramètre pvBoss (J × 10, RG-14). */
export function startRaid(b: StartBase, pvBoss: number): StartResult {
  const err = checkStart(b, 'raid', null);
  if (err) return { ok: false, message: err };
  return { ok: true, event: make(b, null, { type: 'raid', pvMax: pvBoss, pv: pvBoss, participants: [], reponses: [] }) };
}

/**
 * Une réponse dans l'app. Chaque bonne réponse retire 1 PV ; une question ne compte qu'une fois par joueur.
 * Quand le boss tombe, l'événement est réussi et se termine.
 */
export function answerRaid(event: GameEvent, playerId: string, questionId: string, correcte: boolean, now: number): GameEvent {
  const d = event.data;
  if (d.type !== 'raid' || !isActive(event, now)) return event;
  const cle = `${playerId}:${questionId}`;
  if (d.reponses.includes(cle)) return event;
  const reponses = [...d.reponses, cle];
  if (!correcte) return { ...event, data: { ...d, reponses } };
  const pv = Math.max(0, d.pv - 1);
  const participants = d.participants.includes(playerId) ? d.participants : [...d.participants, playerId];
  const data = { ...d, pv, participants, reponses };
  return pv === 0 ? { ...event, data, etat: 'termine', reussi: true, fin: now } : { ...event, data };
}

/** Récompense du raid : un paquet de 3 sorts par participant (débordement du Livre toléré, comme un vol). */
export function raidRewards(
  event: GameEvent,
  sorts: Record<SpellType, number>,
  now: number,
  newId: () => string,
  rng: Rng,
): Map<string, SpellItem[]> {
  const res = new Map<string, SpellItem[]>();
  if (event.data.type !== 'raid' || !event.reussi) return res;
  for (const p of event.data.participants) {
    res.set(
      p,
      Array.from({ length: 3 }, () => ({
        kind: 'sort' as const,
        id: newId(),
        spell: weightedPick(rng, Object.entries(sorts) as [SpellType, number][]) ?? 'gel',
        obtenuA: now,
      })),
    );
  }
  return res;
}

// --- Carte maudite ---

/**
 * Une carte piégée arrive chez un joueur actif au hasard. Elle imite une carte du catalogue
 * et ne compte jamais (comme une contrefaçon). Son porteur sait qu'elle est maudite ;
 * pour les autres, elle paraît normale, y compris dans un échange.
 */
export function startCurse(
  b: StartBase & { newId: () => string },
  joueurs: readonly { id: string; status: PlayerStatus; livreGele: boolean }[],
  catalogue: readonly string[],
  rng: Rng,
): (StartResult & { ok: true; porteur: string; carte: CardItem }) | { ok: false; message: string } {
  const err = checkStart(b, 'carte_maudite', null);
  if (err) return { ok: false, message: err };
  if (b.events.some((e) => isActive(e, b.now) && e.data.type === 'carte_maudite')) return { ok: false, message: 'Une carte maudite circule déjà' };
  const candidats = joueurs.filter((j) => j.status === 'actif' && !j.livreGele);
  if (candidats.length === 0 || catalogue.length === 0) return { ok: false, message: 'Aucun joueur pour recevoir la carte' };
  const porteur = pick(rng, candidats).id;
  const carte: CardItem = {
    kind: 'carte',
    id: b.newId(),
    cardId: pick(rng, catalogue),
    origine: { type: 'correction_gm', par: 'evenement' },
    obtenuA: b.now,
    faux: { nature: 'copie' },
    maudite: true,
  };
  return { ok: true, event: make(b, null, { type: 'carte_maudite', itemId: carte.id }), porteur, carte };
}

/**
 * À l'échéance : la carte maudite disparaît et son porteur perd 2 cartes au hasard, hors SS.
 * Un Livre gelé (Clear provisoire) n'est pas touché. Si l'événement est annulé (RG-12.2), seule la carte disparaît.
 */
export function triggerCurse(book: Book, itemId: string, now: number, rangDe: (cardId: string) => Rank, rng: Rng, appliquer: boolean): { book: Book; perdues: BookItem[] } {
  if (!book.items.some((i) => i.id === itemId)) return { book, perdues: [] };
  let b: Book = { ...book, items: book.items.filter((i) => i.id !== itemId) };
  const perdues: BookItem[] = [];
  if (!appliquer) return { book: b, perdues };
  for (let n = 0; n < 2; n++) {
    const prenables = b.items.filter((i) => i.kind === 'carte' && rangDe(i.cardId) !== 'SS');
    if (prenables.length === 0) break;
    const item = prenables[randomInt(rng, prenables.length)]!;
    perdues.push(item);
    b = removeItem(b, item.id, { cause: 'malediction', a: now });
  }
  return { book: b, perdues };
}

// --- Mission secrète ---

export function startMission(b: StartBase, joueurId: string, objectif: string, recompenseJenny: number): StartResult {
  const err = checkStart(b, 'mission_secrete', null);
  if (err) return { ok: false, message: err };
  return { ok: true, event: make(b, null, { type: 'mission_secrete', joueurId, objectif, recompenseJenny }) };
}

/** Un PNJ valide la mission avant l'échéance. */
export function validateMission(event: GameEvent, now: number): { ok: true; event: GameEvent; joueurId: string; jenny: number } | { ok: false; message: string } {
  if (event.data.type !== 'mission_secrete' || !isActive(event, now)) return { ok: false, message: 'Mission introuvable ou terminée' };
  return { ok: true, event: { ...event, etat: 'termine', reussi: true, fin: now }, joueurId: event.data.joueurId, jenny: event.data.recompenseJenny };
}

// --- Fin et annulation ---

/** RG-12.2 : le GM annule ; les effets cessent, les gains déjà obtenus restent. */
export function cancelEvent(event: GameEvent, now: number): GameEvent {
  return event.etat === 'actif' ? { ...event, etat: 'annule', fin: Math.min(event.fin, now) } : event;
}

/** Événements arrivés à échéance : l'appelant applique leurs suites (fantôme, carte maudite…). */
export function expireEvents(events: readonly GameEvent[], now: number): { events: GameEvent[]; termines: GameEvent[] } {
  const termines: GameEvent[] = [];
  const next = events.map((e) => {
    if (e.etat !== 'actif' || now < e.fin) return e;
    const fini: GameEvent = { ...e, etat: 'termine', reussi: e.reussi ?? false };
    termines.push(fini);
    return fini;
  });
  return { events: next, termines };
}

// --- Annonces (tableau RG-12) ---

export interface Announcement {
  ecran: boolean;
  push: boolean;
  texte: string;
}

export function announce(e: GameEvent, nomZone: (id: string) => string): Announcement | null {
  const zone = e.zoneId ? nomZone(e.zoneId) : '';
  switch (e.data.type) {
    case 'apparition':
      return { ecran: true, push: true, texte: `Apparition dans la zone ${zone} !` };
    case 'double_gain':
      return { ecran: true, push: true, texte: `Double gain à ${zone}` };
    case 'zone_maudite':
      return { ecran: true, push: true, texte: `${zone} est maudite : zone fermée` };
    case 'raid':
      return { ecran: true, push: true, texte: 'Raid de la Brigade ! Réponds aux questions pour abattre le boss' };
    case 'krach':
      return { ecran: true, push: true, texte: 'Krach de Masadora : boutique à moitié prix' };
    case 'carte_maudite':
      return { ecran: true, push: true, texte: 'Une carte maudite circule…' };
    case 'mission_secrete':
      return null;
  }
}

// --- RG-8.12 : retour en jeu des SS ---

/**
 * SS d'un joueur inactif depuis 20 min, qui abandonne ou qui est disqualifié : elles quittent son Livre.
 * Le comptage des limites se faisant sur les Livres, elles redeviennent tirables (balises fantômes d'Apparition).
 */
export function reclaimSS(
  p: { status: PlayerStatus; derniereActionA: number; book: Book },
  now: number,
  rangDe: (cardId: string) => Rank,
): { book: Book; rendues: BookItem[] } {
  const concerne =
    p.status === 'abandon' || p.status === 'disqualifie' || now - p.derniereActionA >= SS_RETURN_INACTIVITY_MS;
  if (!concerne) return { book: p.book, rendues: [] };
  const rendues = p.book.items.filter((i) => i.kind === 'carte' && !i.faux && rangDe(i.cardId) === 'SS');
  const book = rendues.reduce((b, i) => removeItem(b, i.id, { cause: 'retour_en_jeu', a: now }), p.book);
  return { book, rendues };
}
