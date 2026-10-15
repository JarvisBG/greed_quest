// État de l'écran géant : `GET /ecran` à l'ouverture (et après chaque coupure ou changement d'état de la partie),
// puis la room tracker. Les grands moments passent par une file de cinématiques, jouées une à une.
import { useCallback, useEffect, useRef, useState } from 'react';
import { chargerEcran, connecterEcran, type EvenementEcranNom } from './api';
import { bruiter, dire } from './son';
import { depassement, estCarteRare, phraseEvenement } from './textes';
import type { BarreRaid, EntreeFil, EtatEcran, EtatPartie, EvenementEcran, LigneClassement, Point } from './types';

export type CineSans =
  | { k: 'tirage'; e: Extract<EntreeFil, { type: 'tirage' | 'arene' }> }
  | { k: 'jarvis'; lanceur: string; carte: string; figes: string[]; reprisA: string | null }
  | { k: 'ange'; lanceur: string; cible: string }
  | { k: 'alarme' }
  | { k: 'raid_fin'; reussi: boolean; frappeurs: number; pv: number }
  | { k: 'clear'; pseudo: string }
  | { k: 'fin' }
  | { k: 'claque'; ev: EvenementEcran };
export type Cine = CineSans & { id: number };

export interface Raid {
  id: string;
  pv: number;
  pvMax: number;
  finA: number;
  frappeurs: number;
  coups: { n: number; pseudo: string; degats: number }[];
  vaincu: boolean;
  /** Le plan du raid remplace la case une fois l'alarme passée. */
  montre: boolean;
}

export interface Vue extends EtatEcran {
  /** `performance.now()` à la réception du chrono et de l'heure de jeu. */
  recuA: number;
  evs: (EvenementEcran & { finA: number })[];
  raid: Raid | null;
  enLigne: boolean;
  /** Hunters qui entrent dans Greed Island (accueil), un à la fois. */
  entrees: string[];
  monte: { pseudo: string; n: number } | null;
  scan: { zoneId: string; n: number } | null;
  /** Compteur de rotations des halos (ils s'éteignent et se rallument ailleurs). */
  halosN: number;
}

export const enMarche = (e: EtatPartie) => e === 'en_cours' || e === 'phase_finale';

const avecFins = (evs: EvenementEcran[], t: number) => evs.filter((e) => e.type !== 'raid' && e.type !== 'mission_secrete').map((e) => ({ ...e, finA: t + e.resteMs }));

function raidDuSnapshot(s: EtatEcran, t: number, avant: Raid | null): Raid | null {
  const r = s.evenements.find((e) => e.type === 'raid');
  if (!r) return null;
  const garde = avant?.id === r.id ? avant : null;
  return { id: r.id, pv: r.pv ?? 0, pvMax: r.pvMax ?? 1, finA: t + r.resteMs, frappeurs: garde?.frappeurs ?? 0, coups: garde?.coups ?? [], vaincu: false, montre: garde?.montre ?? true };
}

function fusion(s: EtatEcran, avant: Vue | null): Vue {
  const t = performance.now();
  const memesHalos = avant && JSON.stringify(avant.halos) === JSON.stringify(s.halos);
  return {
    ...s,
    recuA: t,
    evs: avecFins(s.evenements, t),
    raid: raidDuSnapshot(s, t, avant?.raid ?? null),
    enLigne: avant?.enLigne ?? true,
    entrees: avant?.entrees ?? [],
    monte: avant?.monte ?? null,
    scan: avant?.scan ?? null,
    halosN: (avant?.halosN ?? 0) + (avant && !memesHalos ? 1 : 0),
  };
}

export function useEcran(partieId: string | null) {
  const [vue, setVue] = useState<Vue | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [file, setFile] = useState<Cine[]>([]);
  const ref = useRef<Vue | null>(null);
  ref.current = vue;
  const seq = useRef(0);
  const dernierDepassement = useRef(0);

  const jouer = useCallback((c: CineSans) => setFile((f) => [...f, { ...c, id: ++seq.current }]), []);
  const finCine = useCallback(() => setFile((f) => f.slice(1)), []);
  const maj = useCallback((f: (v: Vue) => Vue) => setVue((v) => (v ? f(v) : v)), []);

  const recharger = useCallback(async () => {
    if (!partieId) return;
    try {
      const s = await chargerEcran(partieId);
      setVue((v) => fusion(s, v));
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'API injoignable');
    }
  }, [partieId]);

  /** Nouveau classement : la course glisse ; un dépassement en tête de course est annoncé (au plus toutes les 15 s). */
  const classement = useCallback(
    (lignes: LigneClassement[]) => {
      const avant = ref.current?.classement ?? [];
      const d = avant.length ? depassement(avant, lignes) : null;
      const t = performance.now();
      const annonce = d && t - dernierDepassement.current > 15_000;
      if (annonce) {
        dernierDepassement.current = t;
        bruiter('souffle', 600);
        dire(d.tete ? 'Un joueur prend la tête !' : 'Dépassement ! Un joueur gagne une place !', { delai: 700 });
      }
      maj((v) => ({ ...v, classement: lignes, monte: annonce && d ? { pseudo: d.pseudo, n: (v.monte?.n ?? 0) + 1 } : v.monte }));
    },
    [maj],
  );

  const evenement = useCallback(
    (nom: EvenementEcranNom, data: unknown) => {
      const v = ref.current;
      if (!v) return;
      switch (nom) {
        case 'partie': {
          const p = data as { etat: EtatPartie; de: EtatPartie; cause: string };
          if (p.etat === 'phase_finale' && p.de === 'en_cours') {
            bruiter('sirene');
            dire('Phase finale ! Les dernières minutes commencent !', { delai: 300, vitesse: 1.1 });
          }
          if (p.etat === 'pause') {
            bruiter('impact');
            dire('La partie est en pause.', { delai: 200 });
          }
          if (p.de === 'pause' && enMarche(p.etat)) dire('Reprise de la partie !', { delai: 200 });
          if (p.etat === 'en_cours' && p.de === 'inscriptions') {
            bruiter('gong');
            dire('Bienvenue dans Greed Island !', { delai: 500 });
          }
          // Clear : la cinématique du Clear passe d'abord, puis la fin (évènement `clear`).
          if (p.etat === 'terminee' && p.cause !== 'clear') jouer({ k: 'fin' });
          // Le chrono repart de là où il en est (pas de saut), en attendant l'état complet.
          maj((x) => ({ ...x, recuA: performance.now(), partie: { ...x.partie, etat: p.etat, restantMs: restantMaintenant(x), heureJeu: heureJeuMaintenant(x) } }));
          void recharger();
          return;
        }
        case 'classement':
          return classement(data as LigneClassement[]);
        case 'classement_final':
          return maj((x) => ({ ...x, classement: data as LigneClassement[], classementFinal: true }));
        case 'progression': {
          const p = data as { pseudo: string; cartes: number };
          if (!v.classement.some((l) => l.pseudo === p.pseudo)) return;
          return classement(v.classement.map((l) => (l.pseudo === p.pseudo ? { ...l, cartes: p.cartes } : l)));
        }
        case 'heatmap':
          return maj((x) => ({ ...x, heatmap: data as Point[] }));
        case 'halos':
          return maj((x) => ({ ...x, halos: data as Point[], halosN: x.halosN + 1 }));
        case 'balises_par_zone':
          return maj((x) => ({ ...x, balisesParZone: data as Record<string, number> }));
        case 'scans_zones': {
          // Zones des 30 dernières secondes (avec 2 min de retard) : on les allume une à une sur la même durée.
          const zones = data as string[];
          const pas = Math.min(5000, 28_000 / Math.max(1, zones.length));
          zones.forEach((zoneId, i) => setTimeout(() => maj((x) => ({ ...x, scan: { zoneId, n: (x.scan?.n ?? 0) + 1 } })), i * pas));
          return;
        }
        case 'evenement': {
          const e = data as EvenementEcran;
          if (e.type === 'mission_secrete') return;
          if (e.type === 'raid') {
            const t = performance.now();
            maj((x) => ({ ...x, raid: { id: e.id, pv: e.pv ?? 0, pvMax: e.pvMax ?? 1, finA: t + e.resteMs, frappeurs: 0, coups: [], vaincu: false, montre: false } }));
            jouer({ k: 'alarme' });
            return;
          }
          jouer({ k: 'claque', ev: e });
          return;
        }
        case 'evenement_fin': {
          const f = data as { id: string; type: string; annule: boolean; reussi: boolean };
          if (f.type === 'raid') {
            const r = v.raid;
            if (!r || f.annule) return maj((x) => ({ ...x, raid: null }));
            maj((x) => ({
              ...x,
              raid: x.raid ? { ...x.raid, vaincu: f.reussi, pv: f.reussi ? 0 : x.raid.pv } : null,
              fil: [{ type: 'raid' as const, reussi: f.reussi, frappeurs: r.frappeurs, heureJeu: heureJeuMaintenant(x) }, ...x.fil].slice(0, 30),
            }));
            jouer({ k: 'raid_fin', reussi: f.reussi, frappeurs: r.frappeurs, pv: r.pv });
            return;
          }
          return maj((x) => ({ ...x, evs: x.evs.filter((e) => e.id !== f.id) }));
        }
        case 'raid': {
          const b = data as BarreRaid;
          return maj((x) => {
            if (!x.raid || x.raid.id !== b.id) return x;
            const degats = Math.max(0, x.raid.pv - b.pv);
            const coups = b.par && degats > 0 ? [{ n: (x.raid.coups[0]?.n ?? 0) + 1, pseudo: b.par.pseudo, degats }, ...x.raid.coups].slice(0, 6) : x.raid.coups;
            return { ...x, raid: { ...x.raid, pv: b.pv, pvMax: b.pvMax, frappeurs: b.frappeurs, finA: performance.now() + b.resteMs, coups } };
          });
        }
        case 'fil': {
          const e = data as EntreeFil;
          maj((x) => ({ ...x, fil: [e, ...x.fil].slice(0, 30) }));
          if (estCarteRare(e)) jouer({ k: 'tirage', e });
          if (e.type === 'carte_gm' && 'carte' in e) jouer({ k: 'jarvis', lanceur: e.lanceur, carte: e.carte, figes: e.figes, reprisA: e.reprisA });
          if (e.type === 'carte_gm' && 'cible' in e) jouer({ k: 'ange', lanceur: e.lanceur, cible: e.cible });
          return;
        }
        case 'clear': {
          const c = data as { pseudo: string };
          maj((x) => ({ ...x, clear: c }));
          jouer({ k: 'clear', pseudo: c.pseudo });
          jouer({ k: 'fin' });
          return;
        }
        case 'joueur_inscrit': {
          const { pseudo } = data as { pseudo: string };
          // Le classement n'est rafraîchi que pendant le jeu : le nouvel inscrit y entre tout de suite, à zéro carte.
          maj((x) => (x.classement.some((l) => l.pseudo === pseudo) ? x : { ...x, classement: [...x.classement, { place: x.classement.length + 1, pseudo, cartes: 0, points: 0 }] }));
          if (v.partie.etat === 'inscriptions' || v.partie.etat === 'brouillon') maj((x) => ({ ...x, entrees: [...x.entrees, pseudo] }));
          else maj((x) => ({ ...x, arrivants: [pseudo, ...x.arrivants].slice(0, 6) }));
          return;
        }
      }
    },
    [classement, jouer, maj, recharger],
  );

  useEffect(() => {
    if (!partieId) return;
    void recharger();
    const fermer = connecterEcran(partieId, {
      enLigne: (on) => maj((x) => ({ ...x, enLigne: on })),
      reconnecte: () => void recharger(),
      evenement: (nom, data) => evenement(nom, data),
    });
    return fermer;
  }, [partieId, recharger, evenement, maj]);

  /** Fin de la case qui claque : l'évènement rejoint l'habillage du haut. */
  const evenementPose = useCallback((e: EvenementEcran) => {
    const t = performance.now();
    maj((x) => ({ ...x, evs: [{ ...e, finA: t + e.resteMs }, ...x.evs.filter((y) => y.id !== e.id)] }));
  }, [maj]);
  const raidMontre = useCallback(() => maj((x) => ({ ...x, raid: x.raid ? { ...x.raid, montre: true } : null })), [maj]);
  const raidFini = useCallback(() => maj((x) => ({ ...x, raid: null })), [maj]);
  const entreeFinie = useCallback(() => maj((x) => ({ ...x, entrees: x.entrees.slice(1), arrivants: [x.entrees[0]!, ...x.arrivants].slice(0, 6) })), [maj]);

  return { vue, erreur, cine: file[0] ?? null, finCine, evenementPose, raidMontre, raidFini, entreeFinie };
}

/** Horloge de jeu maintenant (RG-4.4) : arrêtée hors de la partie en cours. */
export function heureJeuMaintenant(v: Pick<Vue, 'partie' | 'recuA'>, t = performance.now()): number {
  return v.partie.heureJeu + (enMarche(v.partie.etat) ? t - v.recuA : 0);
}

export function restantMaintenant(v: Pick<Vue, 'partie' | 'recuA'>, t = performance.now()): number {
  return Math.max(0, v.partie.restantMs - (enMarche(v.partie.etat) ? t - v.recuA : 0));
}

/** « Maintenant » pour les décomptes (évènements, raid) : figé hors de la partie en cours (pause). */
export const instantVue = (v: Pick<Vue, 'partie' | 'recuA'>, t = performance.now()) => (enMarche(v.partie.etat) ? t : v.recuA);
