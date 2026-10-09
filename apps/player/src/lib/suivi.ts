// RG-10.9 : suivi de position. Le téléphone garde sa dernière position GPS et l'envoie toutes
// les 15 s s'il a bougé de plus de 10 m (règle du moteur). RG-10.10 : une position de plus de
// 2 min sort le joueur du radar ; on renvoie donc aussi au moins toutes les 60 s, même immobile.
import { shouldSendPosition } from '@gq/engine';
import type { PositionInput } from '@gq/shared';
import { messageGeo, versPosition } from './geo';

export const INTERVALLE_MS = 15_000;
export const BATTEMENT_MS = 60_000;
/** Au-delà, la position gardée est trop vieille pour accompagner un scan : on en redemande une. */
export const FRAICHEUR_MS = 30_000;

export interface Horodatee extends PositionInput {
  a: number;
}

export function doitEnvoyer(dernierEnvoi: Horodatee | null, courante: Horodatee): boolean {
  if (shouldSendPosition(dernierEnvoi, courante)) return true;
  return dernierEnvoi !== null && courante.a - dernierEnvoi.a >= BATTEMENT_MS;
}

export interface SuiviOptions {
  geo: Geolocation | undefined;
  envoyer: (p: PositionInput) => Promise<unknown>;
  now?: () => number;
  /** Erreur GPS (refus, introuvable) : affichée au joueur. */
  onErreur?: (message: string | null) => void;
}

export function creerSuivi({ geo, envoyer, now = Date.now, onErreur }: SuiviOptions) {
  let courante: Horodatee | null = null;
  let envoyee: Horodatee | null = null;
  let watchId: number | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let enCours = false;

  const tick = async () => {
    if (!courante || enCours || !doitEnvoyer(envoyee, { ...courante, a: now() })) return;
    enCours = true;
    const p = { ...courante, a: now() };
    try {
      await envoyer({ lat: p.lat, lng: p.lng, precisionM: p.precisionM });
      envoyee = p;
    } catch {
      // réseau coupé : on réessaiera au prochain tour
    } finally {
      enCours = false;
    }
  };

  return {
    demarrer() {
      if (!geo || watchId !== null) return;
      watchId = geo.watchPosition(
        (pos) => {
          courante = { ...versPosition(pos.coords), a: now() };
          onErreur?.(null);
          void tick();
        },
        (e) => onErreur?.(messageGeo(e.code).message),
        { enableHighAccuracy: true, maximumAge: 5_000 },
      );
      timer = setInterval(() => void tick(), INTERVALLE_MS);
    },
    arreter() {
      if (watchId !== null) geo?.clearWatch(watchId);
      if (timer !== null) clearInterval(timer);
      watchId = null;
      timer = null;
    },
    /** Au retour au premier plan : position redemandée tout de suite puis envoyée si besoin. */
    relancer(): Promise<void> {
      if (!geo) return Promise.resolve();
      return new Promise((fin) =>
        geo.getCurrentPosition(
          (pos) => {
            courante = { ...versPosition(pos.coords), a: now() };
            onErreur?.(null);
            void tick().then(fin);
          },
          (e) => {
            onErreur?.(messageGeo(e.code).message);
            fin();
          },
          { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
        ),
      );
    },
    /** Dernière position GPS si elle a moins de 30 s. */
    fraiche(): PositionInput | null {
      if (!courante || now() - courante.a > FRAICHEUR_MS) return null;
      return { lat: courante.lat, lng: courante.lng, precisionM: courante.precisionM };
    },
    /** Une intention (scan, achat, sort) a porté la position : elle compte comme envoyée. */
    marquerEnvoyee(p: PositionInput) {
      envoyee = { ...p, a: now() };
    },
    tick,
  };
}

export type Suivi = ReturnType<typeof creerSuivi>;
