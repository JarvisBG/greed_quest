// Simulateur de partie pour le calibrage (point ouvert du document : temps moyen d'un Clear).
// Modèle volontairement simple, qui utilise les vraies règles du moteur :
// - chaque joueur marche vers une balise au hasard (il ne sait pas lesquelles sont actives, RG-6.5) et scanne ;
// - à chaque action, il peut croiser un autre joueur à portée : il lui lance un sort offensif
//   (Vol, sinon Échange forcé avec un doublon, sinon Gel), puis tente un échange ou lui achète un doublon ;
// - la Barrière est gardée comme protection ; les autres sorts sont utilisés aussitôt, sans effet modélisé ;
// - à Masadora : revente des doublons (hors SS) et achat de paquets de sorts ;
// - le GM lance une Apparition à intervalle régulier ;
// - options (calibrage du 2026-10-09) : arène de Soufrabi (mise, défi, tirage A / S / SS), enchères de SS à Antokiba,
//   cession de cartes du Livre (SS, S) d'un joueur distancé au joueur qui en a besoin ;
// - option (2026-10-10) : cartes hors collection, données à la place d'une partie des replis en jenny.
import { NEN_TYPES, RANKS, type NenType, type Rank } from '@gq/shared';
import { consumeDraw, fillToTarget, rechargeBeacons, replaceExhausted, rotate, ROTATION_INTERVAL_MS, type Beacon } from '../beacons.js';
import { arenaReward, enterArena } from '../arena.js';
import { addItem, emptyBook, isBookFull, layoutBook, removeItem, type Book, type CardItem } from '../book.js';
import { countInCirculation } from '../counterfeits.js';
import { draw, type CatalogCard } from '../draw.js';
import { endApparition, expireEvents, startApparition, type GameEvent } from '../events.js';
import type { Position } from '../geo.js';
import { DEFAULT_SETTINGS, resolveParams, type ParamSettings } from '../params.js';
import { checkClear } from '../ranking.js';
import { randomInt, seededRng, weightedPick, type Rng } from '../rng.js';
import { checkScan, previousDrawsOn, type ScanRefusalCode } from '../scan.js';
import { DEFAULT_SHOP_CONFIG, buyPack, currentWave, type ShopWave } from '../shop.js';
import { castOffensive, type NenPower, type OffensiveSpell, type SpellPlayer } from '../spells.js';
import { closeAuction, joinAuction, openAuction, placeBid, trade, type Auction } from '../trades.js';

const MIN = 60_000;

/** Cartes hors collection (proposition du 2026-10-10) : ne comptent pas pour le Clear. */
export type CarteHC = 'pepite' | 'ticket' | 'boussole' | 'souffle' | 'voile' | 'coffre';
const CARTES_HC: CarteHC[] = ['pepite', 'ticket', 'boussole', 'souffle', 'voile', 'coffre'];

export interface SimConfig {
  joueurs: number;
  seed: number;
  /** Balises posées ; ignoré si balisesParJoueur est renseigné. */
  balisesPosees: number;
  /** Balises posées = max(10, J × ce nombre). null = utiliser balisesPosees. */
  balisesParJoueur: number | null;
  zones: number;
  dureeMin: number;
  /** Temps de marche entre deux balises (min). */
  marcheMin: [number, number];
  /** Probabilité, à chaque action, de croiser un autre joueur à portée. */
  probaRencontre: number;
  /** Intervalle entre deux Apparitions lancées par le GM (min), null = aucune. */
  apparitionToutesLesMin: number | null;
  /** Multiplicateur des limites d'exemplaires (mode Multiplicateur RG-14.2), 1 = formules du document. */
  multLimites: number;
  /** Prix d'achat d'un doublon entre joueurs, en multiple de son prix de revente. */
  prixAchatCarte: number;
  sorts: boolean;
  achatsBoutique: boolean;
  achatsCartes: boolean;
  /**
   * Probabilité, à chaque action, de réussir un checkpoint PNJ (défi, énigme…) qui donne une carte
   * de rang B, A ou S (poids ci-dessous), sous les limites. Le document ne chiffre pas ces sources.
   */
  probaCheckpoint: number;
  rangsCheckpoint: Partial<Record<Rank, number>>;
  /**
   * Arène de Soufrabi : à chaque action, probabilité qu'un joueur à qui il manque une carte A, S ou SS
   * y aille (à la place d'un scan), s'il en a le droit (mise, délai). 0 = pas d'arène.
   */
  probaArene: number;
  /** Chance de gagner le défi de l'arène. */
  probaVictoireArene: number;
  areneMiseJ: number;
  areneDelaiMin: number;
  /** Intervalle entre deux enchères de SS lancées par le PNJ d'Antokiba (min), null = aucune. */
  encheresSSToutesLesMin: number | null;
  prixDepartEnchereSS: number;
  /** Probabilité qu'un joueur à qui manque la SS mise en vente vienne enchérir (il y passe les 3 min). */
  probaVenirEnchere: number;
  /**
   * Cession : à chaque action, probabilité qu'un joueur à qui manque une carte d'un rang cessible cherche
   * un détenteur prêt à la lui céder (l'action y passe). 0 = pas de cession.
   */
  probaCession: number;
  /** Rangs cessibles et prix demandé (jenny ; le joueur peut payer en partie avec des doublons utiles au vendeur). */
  prixCession: Partial<Record<Rank, number>>;
  /** Le détenteur ne cède que s'il a au moins cet écart de cartes désignées de retard sur l'acheteur. */
  ecartCession: number;
  /** Multiplicateur propre aux limites de SS (null = celui de multLimites). */
  multLimiteSS: number | null;
  /** Limite de SS en « 1 exemplaire pour X joueurs » (prioritaire sur multLimiteSS), au moins limiteSSMin. */
  limiteSSUnPour: number | null;
  limiteSSMin: number;
  /** Multiplicateur propre aux limites des rangs C et D (null = celui de multLimites). */
  multLimiteCD: number | null;
  /**
   * Cartes hors collection : part des replis en jenny (carte épuisée) qui donnent à la place une carte
   * hors collection, tirée selon `poidsHC`. 0 = aucune. Section à part du Livre, `placesHC` places.
   */
  partReplisHC: number;
  poidsHC: Record<CarteHC, number>;
  placesHC: number;
  /** true : la carte hors collection s'ajoute aux jenny du repli au lieu de les remplacer. */
  hcEnPlus: boolean;
  /** Pépite : revendue à Masadora. */
  pepiteJ: number;
  /** Ticket à gratter : gains possibles et leurs poids. */
  ticketGains: [number, number][];
  /** Voile, Coffre (défenses non modélisées) : revente du surplus à Masadora (1 de chaque gardé). */
  reventeHCJ: number;
  /** Répartition du catalogue par rang (RG-8 : SS 2, S 3, A 5, B 6, C 7, D 7). */
  catalogue: Record<Rank, number>;
}

export const DEFAULT_SIM: Omit<SimConfig, 'joueurs' | 'seed'> = {
  balisesPosees: 40,
  balisesParJoueur: null,
  zones: 5,
  dureeMin: 150,
  marcheMin: [1, 3],
  probaRencontre: 0.3,
  apparitionToutesLesMin: 15,
  multLimites: 1,
  prixAchatCarte: 2,
  sorts: true,
  achatsBoutique: true,
  achatsCartes: true,
  probaCheckpoint: 0,
  rangsCheckpoint: { S: 15, A: 35, B: 50 },
  probaArene: 0,
  probaVictoireArene: 0.5,
  areneMiseJ: 30,
  areneDelaiMin: 15,
  encheresSSToutesLesMin: null,
  prixDepartEnchereSS: 50,
  probaVenirEnchere: 0.3,
  probaCession: 0,
  prixCession: { SS: 100 },
  ecartCession: 3,
  multLimiteSS: null,
  limiteSSUnPour: null,
  limiteSSMin: 3,
  multLimiteCD: null,
  catalogue: { SS: 2, S: 3, A: 5, B: 6, C: 7, D: 7 },
  partReplisHC: 0,
  poidsHC: { pepite: 3, ticket: 3, boussole: 2, souffle: 2, voile: 1, coffre: 1 },
  placesHC: 8,
  hcEnPlus: false,
  pepiteJ: 30,
  ticketGains: [[0, 40], [10, 35], [30, 20], [100, 5]],
  reventeHCJ: 10,
};

export interface SimResult {
  joueurs: number;
  seed: number;
  /** Minute du premier Clear, null si personne. */
  clearMin: number | null;
  /** Cartes désignées vraies du meilleur joueur à la fin. */
  meilleur: number;
  /** Moyenne des cartes désignées vraies. */
  moyenne: number;
  tiragesParJoueur: number;
  /** Part des tirages « carte » transformés en jenny faute de carte disponible. */
  partRepliJenny: number;
  echanges: number;
  achatsCartes: number;
  volsReussis: number;
  paquetsAchetes: number;
  checkpoints: number;
  areneTentatives: number;
  areneVictoires: number;
  /** SS obtenues à l'arène. */
  areneSS: number;
  encheresSS: number;
  encheresSSVendues: number;
  /** Prix moyen d'une SS vendue aux enchères (null si aucune). */
  prixMoyenSS: number | null;
  /** SS vraies détenues par le meilleur joueur à la fin. */
  ssDuMeilleur: number;
  /** Exemplaires de SS en jeu à la fin, tous joueurs confondus. */
  ssEnJeu: number;
  /** Cartes du Livre cédées entre joueurs, par rang. */
  cessions: Partial<Record<Rank, number>>;
  refus: Partial<Record<ScanRefusalCode, number>>;
  /** Cartes manquantes au meilleur joueur, par rang. */
  manquesDuMeilleur: Partial<Record<Rank, number>>;
  /** Cartes hors collection obtenues, et utilisées (Boussole, Second souffle). */
  hcObtenues: Partial<Record<CarteHC, number>>;
  boussoles: number;
  souffles: number;
  /** Jenny rapportés par les Pépites, Tickets et reventes de cartes hors collection. */
  jennyHC: number;
}

interface SimPlayer {
  id: string;
  nen: NenType;
  book: Book;
  jenny: number;
  historique: string[];
  dernierTirageA: number | null;
  prochaineAction: number;
  versMasadora: boolean;
  derniersEchanges: Map<string, number>;
  immuniteJusqua: number | null;
  dernierOffensifA: number | null;
  geleJusqua: number | null;
  pouvoirsUtilises: NenPower[];
  derniereAreneA: number | null;
  hc: CarteHC[];
}

function buildCatalogue(c: Record<Rank, number>): { ids: string[]; rang: Map<string, Rank> } {
  const rang = new Map<string, Rank>();
  let n = 1;
  for (const r of RANKS) for (let i = 0; i < c[r]; i++) rang.set(String(n++).padStart(3, '0'), r);
  return { ids: [...rang.keys()], rang };
}

const marche = (rng: Rng, [a, b]: [number, number]) => (a + rng.next() * (b - a)) * MIN;

function settingsFor(cfg: SimConfig): ParamSettings {
  // multLimites = 1 : formules du document telles quelles (le défaut du jeu est × 2).
  const m = cfg.multLimites === 1 ? ({ mode: 'auto' } as const) : ({ mode: 'multiplicateur', coef: cfg.multLimites } as const);
  // J est constant dans le simulateur : une formule « 1 pour X joueurs » se pose en valeur verrouillée.
  const ss =
    cfg.limiteSSUnPour !== null
      ? ({ mode: 'verrouille', value: Math.max(cfg.limiteSSMin, Math.ceil(cfg.joueurs / cfg.limiteSSUnPour)) } as const)
      : cfg.multLimiteSS === null ? m : ({ mode: 'multiplicateur', coef: cfg.multLimiteSS } as const);
  const cd = cfg.multLimiteCD === null ? m : ({ mode: 'multiplicateur', coef: cfg.multLimiteCD } as const);
  return { ...DEFAULT_SETTINGS, limiteSS: ss, limiteS: m, limiteA: m, limiteB: m, limiteCD: cd };
}

export function simulate(cfg: SimConfig): SimResult {
  const rng = seededRng(cfg.seed);
  const { ids: designees, rang } = buildCatalogue(cfg.catalogue);
  const rangDe = (id: string) => rang.get(id) ?? 'D';
  const fin = cfg.dureeMin * MIN;
  let idSeq = 0;
  const newId = () => `x${idSeq++}`;
  const settings = settingsFor(cfg);
  const nbBalises = cfg.balisesParJoueur === null ? cfg.balisesPosees : Math.max(10, Math.round(cfg.joueurs * cfg.balisesParJoueur));

  let beacons: Beacon[] = Array.from({ length: nbBalises }, (_, i) => ({
    id: `b${i}`,
    zoneId: `z${i % cfg.zones}`,
    type: null,
    state: 'dormante',
    stock: 0,
    epuiseeA: null,
  }));
  const visites = new Map<string, number>();
  const nens = NEN_TYPES.filter((n) => n !== 'specialisation');
  const players: SimPlayer[] = Array.from({ length: cfg.joueurs }, (_, i) => ({
    id: `p${i}`,
    nen: nens[randomInt(rng, nens.length)]!,
    book: emptyBook(),
    jenny: 50,
    historique: [],
    dernierTirageA: null,
    prochaineAction: rng.next() * 2 * MIN,
    versMasadora: false,
    derniersEchanges: new Map(),
    immuniteJusqua: null,
    dernierOffensifA: null,
    geleJusqua: null,
    pouvoirsUtilises: [],
    derniereAreneA: null,
    hc: [],
  }));

  // Tous les joueurs restent actifs : J = nombre de joueurs.
  const ctx = () => ({
    J: cfg.joueurs,
    balisesPosees: nbBalises,
    balisesActivesCourantes: beacons.filter((b) => b.state === 'active' && b.type !== 'fantome').length,
  });
  let params = resolveParams(settings, ctx());
  const opts = () => ({ stockBalise: params.stockBalise, partRaresPct: params.partRaresPct, visitesParZone: visites });
  beacons = fillToTarget(beacons, params.balisesActives, opts(), rng).beacons;

  let events: GameEvent[] = [];
  let wave: ShopWave | null = null;
  let prochaineRotation = ROTATION_INTERVAL_MS;
  let prochaineApparition = cfg.apparitionToutesLesMin === null ? Infinity : cfg.apparitionToutesLesMin * MIN;
  let prochainRecalcul = 2 * MIN;
  let prochaineEnchereSS = cfg.encheresSSToutesLesMin === null ? Infinity : cfg.encheresSSToutesLesMin * MIN;
  let clearA: number | null = null;
  const cessions: Partial<Record<Rank, number>> = {};
  const stats = { arene: 0, areneVictoires: 0, areneSS: 0, encheresSS: 0, encheresSSVendues: 0, prixSS: 0, checkpoints: 0, tirages: 0, tiragesCarte: 0, replis: 0, echanges: 0, achatsCartes: 0, vols: 0, paquets: 0 };
  const refus: SimResult['refus'] = {};
  const hcObtenues: SimResult['hcObtenues'] = {};
  const statsHC = { boussoles: 0, souffles: 0, jenny: 0 };
  const poidsHC = CARTES_HC.filter((h) => cfg.poidsHC[h] > 0).map((h) => [h, cfg.poidsHC[h]] as [CarteHC, number]);
  /** Repli en jenny : une partie devient une carte hors collection (s'il reste une place). */
  const repli = (p: SimPlayer, amount: number) => {
    if (poidsHC.length > 0 && p.hc.length < cfg.placesHC && rng.next() < cfg.partReplisHC) {
      const h = weightedPick(rng, poidsHC)!;
      hcObtenues[h] = (hcObtenues[h] ?? 0) + 1;
      if (h === 'ticket') {
        const g = weightedPick(rng, cfg.ticketGains) ?? 0;
        p.jenny += g;
        statsHC.jenny += g;
      } else p.hc.push(h);
      if (cfg.hcEnPlus) p.jenny += amount;
      return;
    }
    p.jenny += amount;
  };
  const prendreHC = (p: SimPlayer, h: CarteHC) => {
    const i = p.hc.indexOf(h);
    if (i < 0) return false;
    p.hc.splice(i, 1);
    return true;
  };

  const limites = (): Record<Rank, number> => ({
    SS: params.limiteSS,
    S: params.limiteS,
    A: params.limiteA,
    B: params.limiteB,
    C: params.limiteCD,
    D: params.limiteCD,
  });

  const missing = (p: SimPlayer) => {
    const l = layoutBook(p.book, designees);
    return new Set(l.designes.filter((d) => d.slot.etat !== 'plein').map((d) => d.cardId));
  };
  /** Doublons : cartes hors emplacement désigné. */
  const duplicates = (p: SimPlayer): CardItem[] => {
    const l = layoutBook(p.book, designees);
    return l.libres.flatMap((s) => (s.etat === 'plein' && s.item.kind === 'carte' ? [s.item] : []));
  };
  const checkClearOf = (p: SimPlayer, now: number) => {
    if (clearA === null && checkClear(p.book, designees).etat === 'complet') clearA = now;
  };
  /** Sorts sans effet modélisé : utilisés (retirés) aussitôt obtenus. */
  const useNonOffensive = (p: SimPlayer) => {
    p.book = {
      ...p.book,
      items: p.book.items.filter((i) => i.kind !== 'sort' || ['vol', 'echange_force', 'gel', 'barriere'].includes(i.spell)),
    };
  };
  const toSpellPlayer = (p: SimPlayer, pos: Position): SpellPlayer => ({
    id: p.id,
    status: 'actif',
    position: pos,
    book: p.book,
    nen: p.nen,
    pouvoirsUtilises: p.pouvoirsUtilises,
    immuniteJusqua: p.immuniteJusqua,
    dernierOffensifA: p.dernierOffensifA,
    geleJusqua: p.geleJusqua,
    livreGele: false,
  });
  const fromSpellPlayer = (p: SimPlayer, s: SpellPlayer) => {
    p.book = s.book;
    p.pouvoirsUtilises = [...s.pouvoirsUtilises];
    p.immuniteJusqua = s.immuniteJusqua;
    p.dernierOffensifA = s.dernierOffensifA;
    p.geleJusqua = s.geleJusqua;
  };

  function encounter(p: SimPlayer, autre: SimPlayer, now: number) {
    // 1. Sort offensif : Vol, sinon Échange forcé avec un doublon, sinon Gel.
    if (cfg.sorts) {
      const pos: Position = { lat: 48.85, lng: 2.35, precisionM: 0, a: now };
      const sorts = p.book.items.filter((i) => i.kind === 'sort');
      const doublon = duplicates(p)[0];
      const choix = (['vol', 'echange_force', 'gel'] as OffensiveSpell[]).find((s) =>
        sorts.some((i) => i.kind === 'sort' && i.spell === s) && (s !== 'echange_force' || doublon),
      );
      if (choix) {
        const item = sorts.find((i) => i.kind === 'sort' && i.spell === choix)!;
        const r = castOffensive(
          { now, gameState: 'en_cours', portee: { porteeM: 30, margeMaxM: 20 }, rangDe, newId },
          {
            sort: choix,
            source: { type: 'carte', itemId: item.id },
            lanceur: toSpellPlayer(p, pos),
            cible: toSpellPlayer(autre, pos),
            ...(choix === 'echange_force' && doublon ? { carteDonneeId: doublon.id } : {}),
          },
          rng,
        );
        if (r.ok) {
          fromSpellPlayer(p, r.lanceur);
          fromSpellPlayer(autre, r.cible);
          if (choix === 'vol' && r.resultat === 'reussi') stats.vols++;
          checkClearOf(p, now);
        }
      }
    }

    // 2. Échange 1 contre 1, sinon achat d'un de ses doublons qui me manque.
    const mesManques = missing(p);
    const recoit = duplicates(autre).find((c) => mesManques.has(c.cardId));
    if (!recoit) return;
    const sesManques = missing(autre);
    const donne = duplicates(p).find((c) => sesManques.has(c.cardId));
    const prix = Math.max(1, Math.round((DEFAULT_SHOP_CONFIG.revente[rangDe(recoit.cardId)] ?? 100) * cfg.prixAchatCarte));
    let donneA: { itemIds: string[]; jenny: number } | null = null;
    if (donne) donneA = { itemIds: [donne.id], jenny: 0 };
    else if (cfg.achatsCartes && p.jenny >= prix) donneA = { itemIds: [], jenny: prix };
    if (!donneA) return;

    const r = trade(
      {
        now,
        gameState: 'en_cours',
        a: { id: p.id, status: 'actif', book: p.book, jenny: p.jenny, livreGele: false },
        b: { id: autre.id, status: 'actif', book: autre.book, jenny: autre.jenny, livreGele: false },
        donneA,
        donneB: { itemIds: [recoit.id], jenny: 0 },
        dernierEchangePaireA: p.derniersEchanges.get(autre.id) ?? null,
      },
      rangDe,
    );
    if (!r.ok) return;
    p.book = r.a.book;
    p.jenny = r.a.jenny;
    autre.book = r.b.book;
    autre.jenny = r.b.jenny;
    p.derniersEchanges.set(autre.id, now);
    autre.derniersEchanges.set(p.id, now);
    if (donneA.itemIds.length > 0) stats.echanges++;
    else stats.achatsCartes++;
    checkClearOf(p, now);
    checkClearOf(autre, now);
  }

  const catalogueNow = (): CatalogCard[] => {
    const circ = countInCirculation(players.map((x) => x.book));
    return designees.map((id) => ({ id, rank: rangDe(id), enCirculation: circ.get(id) ?? 0 }));
  };
  const hautRangManquant = (p: SimPlayer) => [...missing(p)].some((id) => ['A', 'S', 'SS'].includes(rangDe(id)));

  /** Arène de Soufrabi : mise, défi arbitré par le PNJ, victoire = tirage A / S / SS (moteur arena.ts). */
  function arene(p: SimPlayer, now: number): boolean {
    const entree = enterArena(
      { statut: 'actif', jenny: p.jenny, derniereEntreeA: p.derniereAreneA, tentativeEnCours: false },
      now,
      { mise: cfg.areneMiseJ, delaiMin: cfg.areneDelaiMin },
    );
    if (!entree.ok) return false;
    p.jenny -= entree.mise;
    p.derniereAreneA = now;
    stats.arene++;
    if (rng.next() >= cfg.probaVictoireArene) return true;
    stats.areneVictoires++;
    const g = arenaReward(catalogueNow(), limites(), rng);
    if (g.kind === 'carte') {
      p.book = addItem(p.book, { kind: 'carte', id: newId(), cardId: g.cardId, origine: { type: 'arene', tentativeId: 'sim' }, obtenuA: now });
      if (g.rank === 'SS') stats.areneSS++;
      checkClearOf(p, now);
    } else if (g.kind === 'jenny') {
      if (g.repli) repli(p, g.amount);
      else p.jenny += g.amount;
    }
    return true;
  }

  /**
   * Enchère d'une SS (RG-11.4, moteur trades.ts) : les joueurs à qui elle manque viennent avec une
   * probabilité donnée ; enchère à l'anglaise, chacun prêt à miser tous ses jenny. Résolue à l'ouverture,
   * les participants sont occupés pendant les 3 min.
   */
  function enchereSS(now: number) {
    const ss = catalogueNow().filter((c) => c.rank === 'SS' && c.enCirculation < limites().SS);
    if (ss.length === 0) return;
    const carte = ss[randomInt(rng, ss.length)]!;
    let a: Auction = openAuction(newId(), carte.id, now, cfg.prixDepartEnchereSS);
    stats.encheresSS++;
    const venus = players.filter((x) => missing(x).has(carte.id) && rng.next() < cfg.probaVenirEnchere);
    for (const x of venus) {
      const r = joinAuction(a, x.id, now);
      if (r.ok) a = r.auction;
      x.prochaineAction = Math.max(x.prochaineAction, a.fin);
    }
    // Le deuxième plus riche mise tout ce qu'il a, le plus riche le dépasse de 1 J.
    const parBudget = [...venus].sort((x, y) => y.jenny - x.jenny);
    for (const x of parBudget.slice(0, 2).reverse()) {
      const meilleure = a.offres.at(-1)?.montant ?? 0;
      const montant = x === parBudget[0] ? Math.max(cfg.prixDepartEnchereSS, meilleure + 1) : x.jenny;
      const r = placeBid(a, x.id, montant, x.jenny, now);
      if (r.ok) a = r.auction;
    }
    const { gagnant } = closeAuction(a, (id) => players.find((x) => x.id === id)!.jenny);
    if (!gagnant) return;
    const g = players.find((x) => x.id === gagnant.playerId)!;
    g.jenny -= gagnant.montant;
    g.book = addItem(g.book, { kind: 'carte', id: newId(), cardId: carte.id, origine: { type: 'enchere', enchereId: a.id }, obtenuA: a.fin });
    stats.encheresSSVendues++;
    stats.prixSS += gagnant.montant;
    checkClearOf(g, a.fin);
  }

  const score = (p: SimPlayer) => layoutBook(p.book, designees).designes.filter((d) => d.slot.etat === 'plein').length;

  /**
   * Cession (RG-11, échange) : p cherche une carte d'un rang cessible qui lui manque chez un joueur distancé
   * (au moins `ecartCession` cartes désignées de retard), qui la lui cède contre le prix demandé :
   * d'abord des doublons qui manquent au vendeur (valeur = revente × prixAchatCarte), le reste en jenny.
   */
  function cession(p: SimPlayer, now: number): boolean {
    const voulues = [...missing(p)].filter((id) => cfg.prixCession[rangDe(id)] !== undefined);
    if (voulues.length === 0) return false;
    const monScore = score(p);
    const offres = players.flatMap((v) => {
      if (v === p || score(v) > monScore - cfg.ecartCession) return [];
      const item = v.book.items.find((i): i is CardItem => i.kind === 'carte' && !i.faux && voulues.includes(i.cardId));
      return item ? [{ v, item }] : [];
    });
    if (offres.length === 0) return false;
    const { v, item } = offres[randomInt(rng, offres.length)]!;
    const prix = cfg.prixCession[rangDe(item.cardId)]!;
    const manquesVendeur = missing(v);
    const cartes: string[] = [];
    let valeur = 0;
    for (const d of duplicates(p)) {
      if (valeur >= prix) break;
      if (!manquesVendeur.has(d.cardId)) continue;
      cartes.push(d.id);
      valeur += Math.round((DEFAULT_SHOP_CONFIG.revente[rangDe(d.cardId)] ?? 100) * cfg.prixAchatCarte);
    }
    const jenny = Math.max(0, prix - valeur);
    if (p.jenny < jenny) return false;
    const r = trade(
      {
        now,
        gameState: 'en_cours',
        a: { id: p.id, status: 'actif', book: p.book, jenny: p.jenny, livreGele: false },
        b: { id: v.id, status: 'actif', book: v.book, jenny: v.jenny, livreGele: false },
        donneA: { itemIds: cartes, jenny },
        donneB: { itemIds: [item.id], jenny: 0 },
        dernierEchangePaireA: p.derniersEchanges.get(v.id) ?? null,
      },
      rangDe,
    );
    if (!r.ok) return false;
    p.book = r.a.book;
    p.jenny = r.a.jenny;
    v.book = r.b.book;
    v.jenny = r.b.jenny;
    p.derniersEchanges.set(v.id, now);
    v.derniersEchanges.set(p.id, now);
    const rg = rangDe(item.cardId);
    cessions[rg] = (cessions[rg] ?? 0) + 1;
    checkClearOf(p, now);
    return true;
  }

  function masadora(p: SimPlayer, now: number) {
    // Hors collection : Pépites revendues, surplus de Voile / Coffre revendu (1 de chaque gardé).
    for (const h of [...p.hc]) {
      if (h === 'pepite') {
        prendreHC(p, h);
        p.jenny += cfg.pepiteJ;
        statsHC.jenny += cfg.pepiteJ;
      } else if ((h === 'voile' || h === 'coffre') && p.hc.filter((x) => x === h).length > 1) {
        prendreHC(p, h);
        p.jenny += cfg.reventeHCJ;
        statsHC.jenny += cfg.reventeHCJ;
      }
    }
    for (const d of duplicates(p)) {
      const prix = DEFAULT_SHOP_CONFIG.revente[rangDe(d.cardId)];
      if (prix === null) continue;
      p.book = removeItem(p.book, d.id, { cause: 'revente', a: now });
      p.jenny += prix;
    }
    if (cfg.achatsBoutique && cfg.sorts) {
      // Garde de quoi acheter des cartes aux autres joueurs.
      while (p.jenny >= DEFAULT_SHOP_CONFIG.prixPaquet + 40) {
        wave = currentWave(wave, now, 0, params.paquetsParVague);
        const r = buyPack(
          { now, gameState: 'en_cours', qrBoutiqueScanne: true, designees, wave, newId },
          { id: p.id, status: 'actif', position: { lat: 0, lng: 0, precisionM: 0, a: now }, jenny: p.jenny, book: p.book },
          rng,
        );
        if (!r.ok) break;
        wave = r.wave;
        p.jenny = r.player.jenny;
        p.book = r.player.book;
        stats.paquets++;
        useNonOffensive(p);
      }
    }
    // Livre toujours plein : on se débarrasse des Gel.
    while (layoutBook(p.book, designees).libresUtilises >= 13) {
      const gel = p.book.items.find((i) => i.kind === 'sort' && i.spell === 'gel');
      if (!gel) break;
      p.book = removeItem(p.book, gel.id);
    }
    p.versMasadora = false;
  }

  while (clearA === null) {
    const p = players.reduce((a, b) => (b.prochaineAction < a.prochaineAction ? b : a));
    const now = p.prochaineAction;
    if (now >= fin) break;

    // Tâches planifiées (RG-14.1, RG-6.3, RG-6.4, RG-12).
    while (prochainRecalcul <= now) {
      params = resolveParams(settings, ctx());
      beacons = rechargeBeacons(beacons, prochainRecalcul).beacons;
      beacons = fillToTarget(beacons, params.balisesActives, opts(), rng).beacons;
      const exp = expireEvents(events, prochainRecalcul);
      events = exp.events;
      for (const e of exp.termines) beacons = endApparition(e, beacons).beacons;
      prochainRecalcul += 2 * MIN;
    }
    while (prochaineRotation <= now) {
      beacons = rotate(beacons, params.balisesActives, opts(), rng).beacons;
      prochaineRotation += ROTATION_INTERVAL_MS;
    }
    while (prochaineApparition <= now) {
      const zone = `z${randomInt(rng, cfg.zones)}`;
      const r = startApparition({ id: newId(), now: prochaineApparition, gameState: 'en_cours', events }, zone, beacons, rng);
      if (r.ok) {
        events = [...events, r.event];
        if (r.beacons) beacons = r.beacons.beacons;
      }
      prochaineApparition += (cfg.apparitionToutesLesMin ?? Infinity) * MIN;
    }
    while (prochaineEnchereSS <= now) {
      enchereSS(prochaineEnchereSS);
      prochaineEnchereSS += (cfg.encheresSSToutesLesMin ?? Infinity) * MIN;
    }
    if (clearA !== null) break;

    if (p.versMasadora) {
      masadora(p, now);
      p.prochaineAction = now + marche(rng, cfg.marcheMin);
      continue;
    }

    // Cession : la recherche du vendeur remplace le scan de cette action.
    if (cfg.probaCession > 0 && rng.next() < cfg.probaCession && cession(p, now)) {
      if (clearA !== null) break;
      p.prochaineAction = now + marche(rng, cfg.marcheMin);
      continue;
    }

    // Arène : le trajet et le défi remplacent le scan de cette action.
    if (cfg.probaArene > 0 && hautRangManquant(p) && rng.next() < cfg.probaArene && arene(p, now)) {
      if (clearA !== null) break;
      p.prochaineAction = now + marche(rng, cfg.marcheMin);
      continue;
    }

    if (cfg.probaCheckpoint > 0 && rng.next() < cfg.probaCheckpoint) {
      // Checkpoint PNJ : une carte de haut rang encore disponible sous sa limite.
      const circ = countInCirculation(players.map((x) => x.book));
      const catalogue: CatalogCard[] = designees.map((id) => ({ id, rank: rangDe(id), enCirculation: circ.get(id) ?? 0 }));
      const rangTire = weightedPick(rng, Object.entries(cfg.rangsCheckpoint) as [Rank, number][]);
      const dispo = catalogue.filter((c) => c.rank === rangTire && c.enCirculation < limites()[c.rank]);
      if (dispo.length > 0) {
        const c = dispo[randomInt(rng, dispo.length)]!;
        p.book = addItem(p.book, { kind: 'carte', id: newId(), cardId: c.id, origine: { type: 'pnj', checkpointId: 'sim' }, obtenuA: now });
        stats.checkpoints++;
        checkClearOf(p, now);
        if (clearA !== null) break;
      }
    }

    if (rng.next() < cfg.probaRencontre) {
      const autre = players[randomInt(rng, players.length)]!;
      if (autre !== p) encounter(p, autre, now);
      if (clearA !== null) break;
    }

    // Scan d'une balise au hasard ; avec une Boussole, une balise active jamais scannée par le joueur.
    let beacon = beacons[randomInt(rng, beacons.length)]!;
    if (p.hc.includes('boussole')) {
      const vues = new Set(p.historique);
      const cibles = beacons.filter((b) => b.state === 'active' && b.type !== 'fantome' && !vues.has(b.id));
      if (cibles.length > 0 && prendreHC(p, 'boussole')) {
        beacon = cibles[randomInt(rng, cibles.length)]!;
        statsHC.boussoles++;
      }
    }
    visites.set(beacon.zoneId, (visites.get(beacon.zoneId) ?? 0) + 1);
    const scanCheck = (k: number) => checkScan({
      now,
      gameState: 'en_cours',
      player: {
        status: 'actif',
        geleJusqua: p.geleJusqua,
        positionValide: true,
        historiqueTirages: p.historique,
        dernierTirageA: p.dernierTirageA,
        livrePlein: isBookFull(p.book, designees),
      },
      beacon: { id: beacon.id, state: beacon.state, zoneId: beacon.zoneId, stock: beacon.stock },
      zonesFermees: new Set(),
      k,
    });
    let check = scanCheck(params.kBoucle);
    // Second souffle : retirer sur cette balise sans attendre la boucle (RG-7.1 ; le rendement décroissant RG-7.2 reste).
    if (!check.ok && check.code === 'boucle' && prendreHC(p, 'souffle')) {
      statsHC.souffles++;
      check = scanCheck(0);
    }

    if (!check.ok) {
      refus[check.code] = (refus[check.code] ?? 0) + 1;
      if (check.code === 'livre_plein') p.versMasadora = true;
    } else {
      const circ = countInCirculation(players.map((x) => x.book));
      const catalogue: CatalogCard[] = designees.map((id) => ({ id, rank: rangDe(id), enCirculation: circ.get(id) ?? 0 }));
      const gain = draw(
        { beaconType: beacon.type ?? 'standard', tiragesPrecedents: previousDrawsOn(p.historique, beacon.id), catalogue, limites: limites() },
        rng,
      );
      stats.tirages++;
      if (gain.kind === 'carte') {
        stats.tiragesCarte++;
        p.book = addItem(p.book, { kind: 'carte', id: newId(), cardId: gain.cardId, origine: { type: 'balise', baliseId: beacon.id }, obtenuA: now });
      } else if (gain.kind === 'sort') {
        if (cfg.sorts) {
          p.book = addItem(p.book, { kind: 'sort', id: newId(), spell: gain.spell, obtenuA: now });
          useNonOffensive(p);
        }
      } else if (gain.repli) {
        stats.tiragesCarte++;
        stats.replis++;
        repli(p, gain.amount);
      } else p.jenny += gain.amount;
      p.historique.push(beacon.id);
      p.dernierTirageA = now;

      const consumed = consumeDraw(beacon, now);
      beacons = beacons.map((b) => (b.id === beacon.id ? consumed.beacon : b));
      if (consumed.change && beacon.type !== 'fantome') {
        beacons = replaceExhausted(beacons, consumed.beacon, params.balisesActives, opts(), rng).beacons;
      }

      checkClearOf(p, now);
      if (layoutBook(p.book, designees).libresUtilises >= 13 || (cfg.achatsBoutique && p.jenny >= 150)) p.versMasadora = true;
    }
    p.prochaineAction = now + marche(rng, cfg.marcheMin);
  }

  // Bilan : vraies cartes désignées (RG-13.7, classement final).
  const scores = players.map((p) => layoutBook(p.book, designees).designes.filter((d) => d.slot.etat === 'plein').length);
  const iBest = scores.indexOf(Math.max(...scores));
  const manques: SimResult['manquesDuMeilleur'] = {};
  for (const id of missing(players[iBest]!)) manques[rangDe(id)] = (manques[rangDe(id)] ?? 0) + 1;
  const finalClear = clearA as number | null;
  const ssDuMeilleur = layoutBook(players[iBest]!.book, designees).designes.filter((d) => d.slot.etat === 'plein' && rangDe(d.cardId) === 'SS').length;

  return {
    joueurs: cfg.joueurs,
    seed: cfg.seed,
    clearMin: finalClear === null ? null : Math.round(finalClear / MIN),
    meilleur: scores[iBest]!,
    moyenne: scores.reduce((a, b) => a + b, 0) / scores.length,
    tiragesParJoueur: stats.tirages / cfg.joueurs,
    partRepliJenny: stats.tiragesCarte === 0 ? 0 : stats.replis / stats.tiragesCarte,
    echanges: stats.echanges,
    achatsCartes: stats.achatsCartes,
    volsReussis: stats.vols,
    paquetsAchetes: stats.paquets,
    checkpoints: stats.checkpoints,
    areneTentatives: stats.arene,
    areneVictoires: stats.areneVictoires,
    areneSS: stats.areneSS,
    encheresSS: stats.encheresSS,
    encheresSSVendues: stats.encheresSSVendues,
    prixMoyenSS: stats.encheresSSVendues === 0 ? null : stats.prixSS / stats.encheresSSVendues,
    ssDuMeilleur,
    cessions,
    ssEnJeu: [...countInCirculation(players.map((x) => x.book))].filter(([id]) => rangDe(id) === 'SS').reduce((a, [, n]) => a + n, 0),
    refus,
    manquesDuMeilleur: manques,
    hcObtenues,
    boussoles: statsHC.boussoles,
    souffles: statsHC.souffles,
    jennyHC: statsHC.jenny,
  };
}
