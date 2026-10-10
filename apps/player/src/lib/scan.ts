// RG-7 : envoi de l'intention de scan (P1 : « j'ai scanné cette balise, ici »).
// RG-7.5 : sans réseau, le scan part en file ; la file est rejouée au retour de la connexion.
import { ApiError, type Api } from './api';
import type { FileScans, ScanEnAttente } from './file';
import type { ObjetType, PositionInput, Rank, SpellType } from '@gq/shared';

export type Gain =
  /** Carte tirée, complète pour la retourner à l'écran : numéro de l'anime, texte d'ambiance, limite de la partie (RG-8.2). */
  | { kind: 'carte'; carteId: string; nom: string; rang: Rank; numero?: number | null; texte?: string | null; limite?: number | null }
  | { kind: 'sort'; sort: SpellType }
  | { kind: 'jenny'; montant: number }
  /** Amendement 2026-10-10 : objet reçu en plus des jenny d'un repli. */
  | { kind: 'objet'; objet: ObjetType };

export type IssueScan =
  | { type: 'ok'; gains: Gain[]; jenny: number; secondSouffle?: boolean }
  | { type: 'refus'; code: string; message: string }
  | { type: 'en_file' }
  | { type: 'deja_en_file' };

type Reponse = { gains: Gain[]; jenny: number; secondSouffle?: boolean };

async function envoyer(api: Api, s: ScanEnAttente, horsLigne: boolean, secondSouffle = false): Promise<IssueScan> {
  const corps = { baliseId: s.baliseId, position: s.position, ...(horsLigne ? { scanneA: s.scanneA } : {}), ...(secondSouffle ? { secondSouffle: true } : {}) };
  const r = await api.post<Reponse>(`/parties/${s.partieId}/scan`, corps);
  return { type: 'ok', gains: r.gains, jenny: r.jenny, ...(r.secondSouffle ? { secondSouffle: true } : {}) };
}

/** `secondSouffle` (objet, amendement 2026-10-10) : le serveur ne le consomme que si la boucle (RG-7.1) refuserait le scan. */
export async function scanner(api: Api, file: FileScans, partieId: string, baliseId: string, position: PositionInput, now: number, secondSouffle = false): Promise<IssueScan> {
  const s: ScanEnAttente = { partieId, baliseId, position, scanneA: now };
  try {
    return await envoyer(api, s, false, secondSouffle);
  } catch (e) {
    if (e instanceof ApiError && e.horsLigne) return file.ajouter(s) ? { type: 'en_file' } : { type: 'deja_en_file' };
    if (e instanceof ApiError) return { type: 'refus', code: e.code, message: e.message };
    throw e;
  }
}

export interface Rejeu {
  scan: ScanEnAttente;
  issue: IssueScan;
}

/** Rejoue la file dans l'ordre ; s'arrête si le réseau retombe (le reste attend le prochain retour). */
export async function rejouerFile(api: Api, file: FileScans, partieId: string, now: number): Promise<Rejeu[]> {
  const { valides, perimes } = file.aRejouer(partieId, now);
  const out: Rejeu[] = perimes.map((scan) => {
    file.retirer(scan);
    return { scan, issue: { type: 'refus', code: 'scan_perime', message: 'Scan trop ancien (plus de 10 min) : il n’a pas été pris en compte' } };
  });
  for (const scan of valides) {
    let issue: IssueScan;
    try {
      issue = await envoyer(api, scan, true);
    } catch (e) {
      if (e instanceof ApiError && e.horsLigne) break;
      issue = e instanceof ApiError ? { type: 'refus', code: e.code, message: e.message } : { type: 'refus', code: 'erreur', message: String(e) };
    }
    file.retirer(scan);
    out.push({ scan, issue });
  }
  return out;
}
