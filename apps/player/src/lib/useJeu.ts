// État de l'app joueur : partie visée, session, profil, connexion temps réel, fil des évènements,
// suivi de position (RG-10.9) et scans, y compris la file hors ligne (RG-7.5).
import type { NenType } from '@gq/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api';
import { api, API_URL, file, session } from './client';
import { libelleEvenement, resumeIssue } from './format';
import { positionActuelle } from './geo';
import { connectRealtime, type EtatConnexion } from './realtime';
import { rejouerFile, scanner, type IssueScan } from './scan';
import { partieFromUrl, type Session } from './session';
import { creerSuivi, type Suivi } from './suivi';

export interface Partie {
  id: string;
  nom: string;
  etat: string;
  inscriptionsOuvertes: boolean;
  restantMs: number;
  zones: { id: string; nom: string; type: string }[];
}

export interface Moi {
  id: string;
  pseudo: string;
  jenny: number;
  nen: NenType | null;
  statut: string;
  examenFait: boolean;
}

export interface Notif {
  n: number;
  texte: string;
  recuA: number;
}

export type Phase = 'sans_partie' | 'chargement' | 'non_inscrit' | 'en_jeu' | 'erreur';

export function useJeu() {
  const [partieId, setPartieId] = useState<string | null>(() => partieFromUrl(location.search) ?? session.get()?.partieId ?? null);
  const [sess, setSess] = useState<Session | null>(() => {
    const s = session.get();
    return s && s.partieId === partieId ? s : null;
  });
  const [partie, setPartie] = useState<Partie | null>(null);
  const [moi, setMoi] = useState<Moi | null>(null);
  const [licenceSecret, setLicenceSecret] = useState<string | null>(null);
  /** Incrémenté à chaque évènement reçu : les écrans (Livre…) se rechargent. */
  const [version, setVersion] = useState(0);
  const [connexion, setConnexion] = useState<EtatConnexion>('hors_ligne');
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [phase, setPhase] = useState<Phase>(partieId ? 'chargement' : 'sans_partie');
  const [erreur, setErreur] = useState<string | null>(null);
  const [gpsErreur, setGpsErreur] = useState<string | null>(null);
  const [enFile, setEnFile] = useState(() => (partieId ? file.aRejouer(partieId, Date.now()).valides.length : 0));
  const compteur = useRef(0);
  const suivi = useRef<Suivi | null>(null);
  const rejeuEnCours = useRef(false);

  const notifier = useCallback((texte: string) => {
    setNotifs((l) => [{ n: ++compteur.current, texte, recuA: Date.now() }, ...l].slice(0, 30));
  }, []);
  const majJenny = useCallback((jenny: number) => setMoi((m) => (m ? { ...m, jenny } : m)), []);

  const rafraichir = useCallback(async () => {
    if (!partieId) return;
    try {
      const p = await api.get<{ partie: Partie }>(`/parties/${partieId}`);
      setPartie(p.partie);
      let s = sess;
      if (!s) {
        // Le téléphone est peut-être déjà inscrit (app réinstallée, autre navigateur…).
        try {
          const r = await api.post<{ joueurId: string; token: string }>(`/parties/${partieId}/reconnexion`, { appareilId: session.appareilId() });
          s = { partieId, joueurId: r.joueurId, token: r.token };
          session.set(s);
          setSess(s);
        } catch (e) {
          if (e instanceof ApiError && e.code === 'inconnu') return setPhase('non_inscrit');
          throw e;
        }
      }
      const m = await api.get<{ joueur: Moi; licenceSecret: string }>(`/parties/${partieId}/moi`);
      setMoi(m.joueur);
      setLicenceSecret(m.licenceSecret);
      setPhase('en_jeu');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        session.clear();
        setSess(null);
        return;
      }
      // Réseau coupé en cours de partie : on garde l'écran (RG-7.5, les scans partent en file).
      if (e instanceof ApiError && e.horsLigne && phase === 'en_jeu') return;
      setErreur(e instanceof Error ? e.message : String(e));
      setPhase('erreur');
    }
  }, [partieId, sess, phase]);

  useEffect(() => {
    void rafraichir();
    // Au changement de partie ou de session ; ensuite rafraîchi à la demande ou sur évènement.
  }, [partieId, sess]);

  /** RG-7.5 : rejoue les scans en attente dès que la connexion revient. */
  const rejouer = useCallback(async () => {
    if (!sess || rejeuEnCours.current) return;
    rejeuEnCours.current = true;
    try {
      for (const r of await rejouerFile(api, file, sess.partieId, Date.now())) {
        if (r.issue.type === 'ok') majJenny(r.issue.jenny);
        notifier(`Scan hors ligne : ${resumeIssue(r.issue)}`);
      }
    } finally {
      rejeuEnCours.current = false;
      setEnFile(file.aRejouer(sess.partieId, Date.now()).valides.length);
    }
  }, [sess, majJenny, notifier]);

  useEffect(() => {
    if (!sess) return;
    const t = connectRealtime(API_URL, sess.token, {
      etat: (e) => {
        setConnexion(e);
        if (e === 'en_ligne') void rejouer();
      },
      evenement: (nom, data) => {
        notifier(libelleEvenement(nom));
        setVersion((v) => v + 1);
        if (nom === 'partie') void rafraichir();
        const j = (data as { jenny?: unknown } | null)?.jenny;
        if (nom === 'tirage' && typeof j === 'number') majJenny(j);
      },
    });
    const enLigne = () => void rejouer();
    addEventListener('online', enLigne);
    return () => {
      t.close();
      removeEventListener('online', enLigne);
    };
  }, [sess]);

  // RG-10.9 : suivi de position tant qu'une session est ouverte.
  useEffect(() => {
    if (!sess) return;
    const s = creerSuivi({
      geo: globalThis.navigator?.geolocation,
      envoyer: (p) => api.post(`/parties/${sess.partieId}/position`, p),
      onErreur: setGpsErreur,
    });
    s.demarrer();
    suivi.current = s;
    return () => {
      s.arreter();
      suivi.current = null;
    };
  }, [sess]);

  /** RG-7 : scan d'une balise, position jointe (RG-7.6 : sans position, pas de scan). */
  const scannerBalise = useCallback(
    async (baliseId: string): Promise<IssueScan> => {
      if (!sess) return { type: 'refus', code: 'non_inscrit', message: 'Inscris-toi d’abord' };
      let position = suivi.current?.fraiche() ?? null;
      if (!position) {
        try {
          position = await positionActuelle();
        } catch (e) {
          return { type: 'refus', code: 'gps', message: e instanceof Error ? e.message : String(e) };
        }
      }
      const issue = await scanner(api, file, sess.partieId, baliseId, position, Date.now());
      if (issue.type === 'ok') {
        suivi.current?.marquerEnvoyee(position);
        majJenny(issue.jenny);
        setVersion((v) => v + 1);
      }
      if (issue.type === 'en_file') setEnFile((n) => n + 1);
      return issue;
    },
    [sess, majJenny],
  );

  // Retour sur l'app (écran rallumé, onglet revenu au premier plan) : le navigateur a pu suspendre
  // le GPS, les minuteries et la connexion. On redemande la position, on resynchronise le profil
  // et on rejoue les scans en attente.
  useEffect(() => {
    if (!sess) return;
    const auRetour = () => {
      if (document.visibilityState !== 'visible') return;
      void suivi.current?.relancer();
      void rafraichir();
      void rejouer();
      setVersion((v) => v + 1);
    };
    document.addEventListener('visibilitychange', auRetour);
    return () => document.removeEventListener('visibilitychange', auRetour);
  }, [sess, rafraichir, rejouer]);

  const choisirPartie = useCallback((id: string) => {
    setPartieId(id);
    setSess(null);
    setPhase('chargement');
    history.replaceState(null, '', `?partie=${encodeURIComponent(id)}`);
  }, []);

  /** Après l'inscription : garde le jeton ; le rafraîchissement charge le profil. */
  const ouvrirSession = useCallback((s: Session) => {
    session.set(s);
    setSess(s);
  }, []);

  return {
    partieId,
    partie,
    moi,
    licenceSecret,
    version,
    connexion,
    notifs,
    phase,
    erreur,
    gpsErreur,
    enFile,
    rafraichir,
    choisirPartie,
    ouvrirSession,
    scannerBalise,
  };
}
