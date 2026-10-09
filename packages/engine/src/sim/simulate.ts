// Simulateur de partie pour le calibrage (point ouvert du document : temps moyen d'un Clear).
// Modèle volontairement simple, qui utilise les vraies règles du moteur :
// - chaque joueur marche vers une balise au hasard (il ne sait pas lesquelles sont actives, RG-6.5) et scanne ;
// - les sorts tirés ne sont pas joués (ignorés) ; les jenny servent seulement à départager ;
// - Livre presque plein : aller-retour à Masadora pour revendre les doublons (hors SS) ;
// - échanges : de temps en temps, deux joueurs échangent un doublon contre une carte qui leur manque ;
// - le GM lance une Apparition à intervalle régulier (seule source de SS).
import { RANKS, type Rank } from '@gq/shared';
import { consumeDraw, fillToTarget, rechargeBeacons, replaceExhausted, rotate, ROTATION_INTERVAL_MS, type Beacon } from '../beacons.js';
import { addItem, emptyBook, isBookFull, layoutBook, removeItem, type Book, type CardItem } from '../book.js';
import { countInCirculation } from '../counterfeits.js';
import { draw, type CatalogCard } from '../draw.js';
import { endApparition, expireEvents, startApparition, type GameEvent } from '../events.js';
import { DEFAULT_SETTINGS, resolveParams } from '../params.js';
import { checkClear } from '../ranking.js';
import { randomInt, seededRng, type Rng } from '../rng.js';
import { checkScan, previousDrawsOn, type ScanRefusalCode } from '../scan.js';
import { DEFAULT_SHOP_CONFIG } from '../shop.js';
import { trade } from '../trades.js';

const MIN = 60_000;

export interface SimConfig {
  joueurs: number;
  balisesPosees: number;
  zones: number;
  dureeMin: number;
  seed: number;
  /** Temps de marche entre deux balises (min). */
  marcheMin: [number, number];
  /** Probabilité, à chaque action, de tenter un échange avec un autre joueur. */
  probaEchange: number;
  /** Intervalle entre deux Apparitions lancées par le GM (min), null = aucune. */
  apparitionToutesLesMin: number | null;
  /** Répartition du catalogue par rang (RG-8 : SS 2, S 3, A 5, B 6, C 7, D 7). */
  catalogue: Record<Rank, number>;
}

export const DEFAULT_SIM: Omit<SimConfig, 'joueurs' | 'seed'> = {
  balisesPosees: 40,
  zones: 5,
  dureeMin: 150,
  marcheMin: [1, 3],
  probaEchange: 0.2,
  apparitionToutesLesMin: 15,
  catalogue: { SS: 2, S: 3, A: 5, B: 6, C: 7, D: 7 },
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
  refus: Partial<Record<ScanRefusalCode, number>>;
  /** Cartes manquantes au meilleur joueur, par rang. */
  manquesDuMeilleur: Partial<Record<Rank, number>>;
}

interface SimPlayer {
  id: string;
  book: Book;
  jenny: number;
  historique: string[];
  dernierTirageA: number | null;
  prochaineAction: number;
  versMasadora: boolean;
  derniersEchanges: Map<string, number>;
}

function buildCatalogue(c: Record<Rank, number>): { ids: string[]; rang: Map<string, Rank> } {
  const rang = new Map<string, Rank>();
  let n = 1;
  for (const r of RANKS) for (let i = 0; i < c[r]; i++) rang.set(String(n++).padStart(3, '0'), r);
  return { ids: [...rang.keys()], rang };
}

const marche = (rng: Rng, [a, b]: [number, number]) => (a + rng.next() * (b - a)) * MIN;

export function simulate(cfg: SimConfig): SimResult {
  const rng = seededRng(cfg.seed);
  const { ids: designees, rang } = buildCatalogue(cfg.catalogue);
  const rangDe = (id: string) => rang.get(id) ?? 'D';
  const fin = cfg.dureeMin * MIN;
  let idSeq = 0;
  const newId = () => `x${idSeq++}`;

  let beacons: Beacon[] = Array.from({ length: cfg.balisesPosees }, (_, i) => ({
    id: `b${i}`,
    zoneId: `z${i % cfg.zones}`,
    type: null,
    state: 'dormante',
    stock: 0,
    epuiseeA: null,
  }));
  const visites = new Map<string, number>();
  const players: SimPlayer[] = Array.from({ length: cfg.joueurs }, (_, i) => ({
    id: `p${i}`,
    book: emptyBook(),
    jenny: 50,
    historique: [],
    dernierTirageA: null,
    prochaineAction: rng.next() * 2 * MIN,
    versMasadora: false,
    derniersEchanges: new Map(),
  }));

  // Tous les joueurs restent actifs : J = nombre de joueurs.
  const ctx = () => ({
    J: cfg.joueurs,
    balisesPosees: cfg.balisesPosees,
    balisesActivesCourantes: beacons.filter((b) => b.state === 'active' && b.type !== 'fantome').length,
  });
  let params = resolveParams(DEFAULT_SETTINGS, ctx());
  const opts = () => ({ stockBalise: params.stockBalise, partRaresPct: params.partRaresPct, visitesParZone: visites });
  beacons = fillToTarget(beacons, params.balisesActives, opts(), rng).beacons;

  let events: GameEvent[] = [];
  let prochaineRotation = ROTATION_INTERVAL_MS;
  let prochaineApparition = cfg.apparitionToutesLesMin === null ? Infinity : cfg.apparitionToutesLesMin * MIN;
  let prochainRecalcul = 2 * MIN;
  let clearA: number | null = null;
  let tirages = 0;
  let tiragesCarte = 0;
  let replis = 0;
  let echanges = 0;
  const refus: SimResult['refus'] = {};

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
  /** Doublons échangeables : exemplaires hors emplacement désigné. */
  const duplicates = (p: SimPlayer): CardItem[] => {
    const l = layoutBook(p.book, designees);
    return l.libres.flatMap((s) => (s.etat === 'plein' && s.item.kind === 'carte' ? [s.item] : []));
  };

  while (clearA === null) {
    const p = players.reduce((a, b) => (b.prochaineAction < a.prochaineAction ? b : a));
    const now = p.prochaineAction;
    if (now >= fin) break;

    // Tâches planifiées (RG-14.1, RG-6.3, RG-6.4, RG-12).
    while (prochainRecalcul <= now) {
      params = resolveParams(DEFAULT_SETTINGS, ctx());
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

    // Aller-retour à Masadora : revente des doublons non SS.
    if (p.versMasadora) {
      for (const d of duplicates(p)) {
        const prix = DEFAULT_SHOP_CONFIG.revente[rangDe(d.cardId)];
        if (prix === null) continue;
        p.book = removeItem(p.book, d.id, { cause: 'revente', a: now });
        p.jenny += prix;
      }
      p.versMasadora = false;
      p.prochaineAction = now + marche(rng, cfg.marcheMin);
      continue;
    }

    // Échange occasionnel : un de mes doublons qui lui manque contre un des siens qui me manque.
    if (rng.next() < cfg.probaEchange) {
      const autre = players[randomInt(rng, players.length)]!;
      if (autre !== p) {
        const mesManques = missing(p);
        const sesManques = missing(autre);
        const donne = duplicates(p).find((c) => sesManques.has(c.cardId));
        const recoit = duplicates(autre).find((c) => mesManques.has(c.cardId));
        if (donne && recoit) {
          const r = trade(
            {
              now,
              gameState: 'en_cours',
              a: { id: p.id, status: 'actif', book: p.book, jenny: p.jenny, livreGele: false },
              b: { id: autre.id, status: 'actif', book: autre.book, jenny: autre.jenny, livreGele: false },
              donneA: { itemIds: [donne.id], jenny: 0 },
              donneB: { itemIds: [recoit.id], jenny: 0 },
              dernierEchangePaireA: p.derniersEchanges.get(autre.id) ?? null,
            },
            rangDe,
          );
          if (r.ok) {
            p.book = r.a.book;
            autre.book = r.b.book;
            p.derniersEchanges.set(autre.id, now);
            autre.derniersEchanges.set(p.id, now);
            echanges++;
          }
        }
      }
    }

    // Scan d'une balise au hasard.
    const beacon = beacons[randomInt(rng, beacons.length)]!;
    visites.set(beacon.zoneId, (visites.get(beacon.zoneId) ?? 0) + 1);
    const livrePlein = isBookFull(p.book, designees);
    const check = checkScan({
      now,
      gameState: 'en_cours',
      player: { status: 'actif', geleJusqua: null, positionValide: true, historiqueTirages: p.historique, dernierTirageA: p.dernierTirageA, livrePlein },
      beacon: { id: beacon.id, state: beacon.state, zoneId: beacon.zoneId, stock: beacon.stock },
      zonesFermees: new Set(),
      k: params.kBoucle,
    });

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
      tirages++;
      if (gain.kind === 'carte') {
        tiragesCarte++;
        p.book = addItem(p.book, { kind: 'carte', id: newId(), cardId: gain.cardId, origine: { type: 'balise', baliseId: beacon.id }, obtenuA: now });
      } else if (gain.kind === 'jenny') {
        p.jenny += gain.amount;
        if (gain.repli) {
          tiragesCarte++;
          replis++;
        }
      }
      p.historique.push(beacon.id);
      p.dernierTirageA = now;

      const consumed = consumeDraw(beacon, now);
      beacons = beacons.map((b) => (b.id === beacon.id ? consumed.beacon : b));
      if (consumed.change && beacon.type !== 'fantome') {
        beacons = replaceExhausted(beacons, consumed.beacon, params.balisesActives, opts(), rng).beacons;
      }

      if (checkClear(p.book, designees).etat === 'complet') clearA = now;
      if (layoutBook(p.book, designees).libresUtilises >= 13) p.versMasadora = true;
    }
    p.prochaineAction = now + marche(rng, cfg.marcheMin);
  }

  // Bilan : vraies cartes désignées (RG-13.7, classement final).
  const scores = players.map((p) => {
    const l = layoutBook(p.book, designees);
    return l.designes.filter((d) => d.slot.etat === 'plein').length;
  });
  const iBest = scores.indexOf(Math.max(...scores));
  const manques: SimResult['manquesDuMeilleur'] = {};
  for (const id of missing(players[iBest]!)) manques[rangDe(id)] = (manques[rangDe(id)] ?? 0) + 1;

  return {
    joueurs: cfg.joueurs,
    seed: cfg.seed,
    clearMin: clearA === null ? null : Math.round(clearA / MIN),
    meilleur: scores[iBest]!,
    moyenne: scores.reduce((a, b) => a + b, 0) / scores.length,
    tiragesParJoueur: tirages / cfg.joueurs,
    partRepliJenny: tiragesCarte === 0 ? 0 : replis / tiragesCarte,
    echanges,
    refus,
    manquesDuMeilleur: manques,
  };
}

