// État de l'app joueur : partie visée, session, profil, connexion temps réel, fil des évènements.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api';
import { api, API_URL, session } from './client';
import { connectRealtime, type EtatConnexion, type EvenementJoueur } from './realtime';
import { partieFromUrl, type Session } from './session';

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
  nen: string | null;
  statut: string;
  examenFait: boolean;
}

export interface Notif {
  n: number;
  nom: EvenementJoueur;
  data: unknown;
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
  const [connexion, setConnexion] = useState<EtatConnexion>('hors_ligne');
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [phase, setPhase] = useState<Phase>(partieId ? 'chargement' : 'sans_partie');
  const [erreur, setErreur] = useState<string | null>(null);
  const compteur = useRef(0);

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
      const m = await api.get<{ joueur: Moi }>(`/parties/${partieId}/moi`);
      setMoi(m.joueur);
      setPhase('en_jeu');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        session.clear();
        setSess(null);
        return;
      }
      setErreur(e instanceof Error ? e.message : String(e));
      setPhase('erreur');
    }
  }, [partieId, sess]);

  useEffect(() => {
    void rafraichir();
  }, [rafraichir]);

  useEffect(() => {
    if (!sess) return;
    const t = connectRealtime(API_URL, sess.token, {
      etat: setConnexion,
      evenement: (nom, data) => {
        setNotifs((l) => [{ n: ++compteur.current, nom, data, recuA: Date.now() }, ...l].slice(0, 30));
        if (nom === 'partie') void rafraichir();
      },
    });
    return () => t.close();
  }, [sess, rafraichir]);

  const choisirPartie = useCallback((id: string) => {
    setPartieId(id);
    setSess(null);
    setPhase('chargement');
    history.replaceState(null, '', `?partie=${encodeURIComponent(id)}`);
  }, []);

  return { partieId, partie, moi, connexion, notifs, phase, erreur, rafraichir, choisirPartie };
}
