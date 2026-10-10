// Vérifications d'un scan de balise (RG-7), dans l'ordre, arrêt au premier échec.
// Toutes les heures sont en horloge de jeu (ms), suspendue pendant la pause (RG-4.4).
import type { BeaconState, GameState, PlayerStatus } from '@gq/shared';

export const SCAN_DELAY_MS = 30_000; // RG-7.3
export const OFFLINE_MAX_AGE_MS = 10 * 60_000; // RG-7.5

export interface ScanContext {
  now: number;
  gameState: GameState;
  player: {
    status: PlayerStatus;
    /** Fin du gel en cours (sort Gel ou sanction PNJ), null si aucun. */
    geleJusqua: number | null;
    /** Position récente et précise (calculée par le module géoloc, RG-7.6). */
    positionValide: boolean;
    /** Ids des balises de ses tirages réussis, du plus ancien au plus récent. */
    historiqueTirages: readonly string[];
    /** Heure de son dernier tirage réussi, null si aucun. */
    dernierTirageA: number | null;
    /** Résultat de isBookFull (RG-8.5). */
    livrePlein: boolean;
  };
  beacon: {
    id: string;
    state: BeaconState;
    zoneId: string;
    stock: number;
  };
  /** Zones fermées par un événement Zone maudite (RG-12). */
  zonesFermees: ReadonlySet<string>;
  /** K de la règle de la boucle (paramètre kBoucle, RG-14). */
  k: number;
  /** Second souffle (objet, amendement 2026-10-10) : la boucle (RG-7.1) ne s'applique pas à ce scan. */
  ignorerBoucle?: boolean;
}

export type ScanRefusalCode =
  | 'partie_non_ouverte'
  | 'partie_en_pause'
  | 'partie_terminee'
  | 'joueur_exclu'
  | 'joueur_gele'
  | 'gps_invalide'
  | 'balise_dormante'
  | 'balise_epuisee'
  | 'balise_coupee'
  | 'zone_fermee'
  | 'boucle'
  | 'delai'
  | 'livre_plein'
  | 'stock_vide';

export type ScanCheck = { ok: true } | { ok: false; code: ScanRefusalCode; message: string };

const refuse = (code: ScanRefusalCode, message: string): ScanCheck => ({ ok: false, code, message });

const secondes = (ms: number) => Math.ceil(ms / 1000);

/** RG-7.1 : nombre de balises différentes à scanner avant de revenir sur `beaconId`. */
export function loopRemaining(historique: readonly string[], beaconId: string, k: number): number {
  const last = historique.lastIndexOf(beaconId);
  if (last === -1) return 0;
  const autres = new Set(historique.slice(last + 1));
  return Math.max(0, k - autres.size);
}

/** RG-7.2 : tirages déjà réussis par ce joueur sur cette balise. */
export function previousDrawsOn(historique: readonly string[], beaconId: string): number {
  return historique.filter((id) => id === beaconId).length;
}

/** RG-7.5 : un scan mis en file hors ligne est traité s'il date de moins de 10 min. */
export function isQueuedScanFresh(scanneA: number, recuA: number): boolean {
  return recuA - scanneA < OFFLINE_MAX_AGE_MS;
}

/** RG-7 : vérifie un scan. Un refus ne coûte rien (RG-7.4) ; le motif est affiché tel quel. */
export function checkScan(c: ScanContext): ScanCheck {
  // 1. La partie est en cours.
  if (c.gameState === 'pause') return refuse('partie_en_pause', 'La partie est en pause');
  if (c.gameState === 'terminee') return refuse('partie_terminee', 'La partie est terminée');
  if (c.gameState !== 'en_cours' && c.gameState !== 'phase_finale') {
    return refuse('partie_non_ouverte', "La partie n'a pas encore commencé");
  }

  // 2. Joueur en jeu, non gelé, position valide (RG-7.6).
  const { player } = c;
  if (player.status === 'disqualifie') return refuse('joueur_exclu', 'Tu as été disqualifié');
  if (player.status === 'abandon') return refuse('joueur_exclu', 'Tu as abandonné la partie');
  if (player.status === 'gele' || (player.geleJusqua !== null && player.geleJusqua > c.now)) {
    const reste = player.geleJusqua !== null ? ` encore ${secondes(player.geleJusqua - c.now)} s` : '';
    return refuse('joueur_gele', `Tu es gelé${reste}`);
  }
  if (!player.positionValide) return refuse('gps_invalide', 'Position GPS introuvable : active ta localisation');

  // 3. Balise active, zone ouverte (RG-6).
  switch (c.beacon.state) {
    case 'dormante':
      return refuse('balise_dormante', 'Cette balise dort');
    case 'epuisee':
      return refuse('balise_epuisee', 'Plus rien ici, cherche ailleurs');
    case 'coupee':
      return refuse('balise_coupee', 'Scan refusé');
  }
  if (c.zonesFermees.has(c.beacon.zoneId)) return refuse('zone_fermee', 'Zone maudite : cette zone est fermée');

  // 4. Règle de la boucle (RG-7.1).
  const reste = c.ignorerBoucle ? 0 : loopRemaining(player.historiqueTirages, c.beacon.id, c.k);
  if (reste > 0) {
    const balises = reste === 1 ? '1 balise différente' : `${reste} balises différentes`;
    return refuse('boucle', `Boucle : scanne encore ${balises}`);
  }

  // 5. Délai entre scans (RG-7.3).
  if (player.dernierTirageA !== null) {
    const attente = player.dernierTirageA + SCAN_DELAY_MS - c.now;
    if (attente > 0) return refuse('delai', `Attends encore ${secondes(attente)} s avant de scanner`);
  }

  // 6. Place dans le Livre (RG-8.5).
  if (player.livrePlein) return refuse('livre_plein', 'Livre plein : revends ou utilise quelque chose');

  // 7. Stock de la balise.
  if (c.beacon.stock <= 0) return refuse('stock_vide', 'Plus rien ici, cherche ailleurs');

  return { ok: true };
}
