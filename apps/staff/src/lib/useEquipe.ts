// État de la console : session de l'équipe, partie, joueurs, catalogue, temps réel (journal, alertes).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from './api';
import { API_URL, api, session as store } from './client';
import type { Alerte, CarteCatalogue, JoueurVue, LigneJournal } from './format';
import { connectRealtime, type EtatConnexion, type EvenementEquipe } from './realtime';
import type { Role, SessionEquipe } from './session';

export interface PartiePublique {
  id: string;
  nom: string;
  etat: string;
  inscriptionsOuvertes: boolean;
  restantMs: number;
  zones: { id: string; nom: string; type: string }[];
}

const MAX_FIL = 200;
/** Actions du journal qui changent la liste des joueurs (statut, jenny affichés dans la console). */
const CHANGE_JOUEURS = new Set(['inscription', 'statut', 'gel_sanction', 'annulation_gains', 'disqualification', 'abandon', 'correction_jenny', 'checkpoint', 'expertise']);

export function useEquipe(partieUrl: string | null) {
  const [session, setSession] = useState<SessionEquipe | null>(() => {
    // `?partie=X` ouvre X si ce membre s'y est déjà connecté sur cet appareil ; sinon « Mes parties ».
    const s = partieUrl ? (store.liste().find((x) => x.partieId === partieUrl) ?? null) : store.get();
    if (s) store.set(s);
    else store.clear();
    return s;
  });
  const [partie, setPartie] = useState<PartiePublique | null>(null);
  const [joueurs, setJoueurs] = useState<JoueurVue[]>([]);
  const [catalogue, setCatalogue] = useState<CarteCatalogue[]>([]);
  const [journal, setJournal] = useState<LigneJournal[]>([]);
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  /** J (joueurs actifs, RG-14) appliqué : lu à la connexion, puis évènement `j`. */
  const [j, setJ] = useState<number | null>(null);
  /** Alertes reçues en direct depuis la connexion (pastille « non lues »). */
  const [alertesRecues, setAlertesRecues] = useState(0);
  const [connexion, setConnexion] = useState<EtatConnexion>('hors_ligne');
  /** Incrémenté à chaque évènement reçu : les écrans s'en servent pour se recharger. */
  const [version, setVersion] = useState<Partial<Record<EvenementEquipe, number>>>({});
  const partieId = session?.partieId ?? partieUrl;

  // Changement de partie (page « Mes parties ») : rien de l'ancienne ne reste affiché.
  useEffect(() => {
    setPartie(null);
    setJoueurs([]);
    setCatalogue([]);
    setJournal([]);
    setAlertes([]);
    setJ(null);
    setAlertesRecues(0);
    setVersion({});
  }, [session?.partieId]);

  /** Retour à « Mes parties » : la partie reste retenue sur l'appareil. */
  const quitter = useCallback(() => {
    store.clear();
    setSession(null);
  }, []);
  /** Déconnexion de la partie ouverte : elle est oubliée sur cet appareil. */
  const deconnecter = useCallback(() => {
    const s = store.get();
    if (s) store.oublier(s.partieId);
    setSession(null);
  }, []);
  /** Rouvre une partie retenue (page « Mes parties »). */
  const ouvrir = useCallback((s: SessionEquipe) => {
    store.set(s);
    setSession(s);
  }, []);

  /** Jeton refusé (partie supprimée, secret changé) : retour à l'écran de connexion. */
  const garde = useCallback(
    async <T,>(p: Promise<T>): Promise<T | null> => {
      try {
        return await p;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) deconnecter();
        return null;
      }
    },
    [deconnecter],
  );

  const chargerPartie = useCallback(async () => {
    if (!partieId) return;
    const r = await garde(api.get<{ partie: PartiePublique }>(`/parties/${partieId}`));
    if (r) setPartie(r.partie);
  }, [partieId, garde]);

  const chargerJoueurs = useCallback(async () => {
    if (!session) return;
    const r = await garde(api.get<{ joueurs: JoueurVue[] }>(`/parties/${session.partieId}/joueurs`));
    if (r) setJoueurs(r.joueurs);
  }, [session, garde]);

  const chargerCatalogue = useCallback(async () => {
    if (!session) return;
    const r = await garde(api.get<{ cartes: CarteCatalogue[] }>(`/parties/${session.partieId}/cartes`));
    if (r) setCatalogue(r.cartes);
  }, [session, garde]);

  useEffect(() => void chargerPartie(), [chargerPartie]);

  useEffect(() => {
    if (!session) return;
    const base = `/parties/${session.partieId}`;
    void chargerJoueurs();
    void chargerCatalogue();
    void garde(api.get<{ lignes: LigneJournal[] }>(`${base}/journal?limite=100`)).then((r) => r && setJournal(r.lignes));
    void garde(api.get<{ alertes: Alerte[] }>(`${base}/alertes`)).then((r) => r && setAlertes(r.alertes));
    void garde(api.get<{ J: number }>(`${base}/parametres`)).then((r) => r && setJ(r.J));
  }, [session, chargerJoueurs, chargerCatalogue, garde]);

  // Rechargement groupé de la liste des joueurs (beaucoup de lignes de journal en rafale).
  const joueursEnAttente = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rechargerJoueursBientot = useCallback(() => {
    if (joueursEnAttente.current) return;
    joueursEnAttente.current = setTimeout(() => {
      joueursEnAttente.current = null;
      void chargerJoueurs();
    }, 1000);
  }, [chargerJoueurs]);

  useEffect(() => {
    if (!session) return;
    const t = connectRealtime(API_URL, session.token, {
      etat: setConnexion,
      evenement: (nom, data) => {
        setVersion((v) => ({ ...v, [nom]: (v[nom] ?? 0) + 1 }));
        if (nom === 'journal') {
          const l = data as LigneJournal;
          setJournal((j) => [l, ...j].slice(0, MAX_FIL));
          if (CHANGE_JOUEURS.has(l.action)) rechargerJoueursBientot();
        } else if (nom === 'alerte') {
          setAlertes((a) => [{ ...(data as Alerte), creeLe: new Date().toISOString() }, ...a].slice(0, MAX_FIL));
          setAlertesRecues((n) => n + 1);
        } else if (nom === 'j') {
          setJ((data as { applique: number }).applique);
        } else if (nom === 'partie') {
          void chargerPartie();
        } else if (nom === 'joueur_inscrit') {
          rechargerJoueursBientot();
        }
      },
    });
    return () => t.close();
  }, [session, chargerPartie, rechargerJoueursBientot]);

  const connecter = useCallback(async (id: string, code: string) => {
    const r = await api.post<{ id: string; role: Role; nom: string; token: string }>(`/parties/${id}/staff/connexion`, { code });
    const s: SessionEquipe = { partieId: id, id: r.id, nom: r.nom, role: r.role, token: r.token };
    store.set(s);
    setSession(s);
  }, []);

  const pseudos = useMemo(() => new Map(joueurs.map((j) => [j.id, j.pseudo])), [joueurs]);
  const nomActeur = useCallback(
    (type: LigneJournal['acteurType'], id: string | null) => {
      if (type === 'systeme') return 'Système';
      if (type === 'joueur') return (id && pseudos.get(id)) ?? 'Joueur';
      if (id === session?.id) return 'Moi';
      return type === 'gm' ? 'GM' : 'PNJ';
    },
    [pseudos, session],
  );

  return { session, partieId, partie, j, alertesRecues, joueurs, pseudos, catalogue, journal, alertes, connexion, version, connecter, ouvrir, quitter, deconnecter, chargerJoueurs, chargerPartie, chargerCatalogue, nomActeur };
}

export type Equipe = ReturnType<typeof useEquipe>;
