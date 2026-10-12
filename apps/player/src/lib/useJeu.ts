// État de l'app joueur : partie visée, session, profil, connexion temps réel, fil des évènements,
// suivi de position (RG-10.9) et scans, y compris la file hors ligne (RG-7.5).
import type { NenType, PositionInput, PouvoirSpe } from '@gq/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api';
import { api, API_URL, file, session } from './client';
import { libelleEvenement, resumeIssue } from './format';
import { positionActuelle } from './geo';
import { connectRealtime, type EtatConnexion } from './realtime';
import { rejouerFile, scanner, type IssueScan } from './scan';
import { messageFin, termine, type EvenementEchange, type VueEchange } from './echanges';
import { fusionnerLot, jeMene, texteAdjuge, texteClotureAutre, texteSurencheri, type Adjuge, type Cloture, type Lot } from './encheres';
import { ilYaRecu, issueRecu, texteSortRecu, type SortRecu } from './sorts';
import { texteAnnulee, texteEntree, type EtatArene, type EvArene, type IssueArene } from './arene';
import type { SuiviCible } from './accompagnement';
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
  /** Spécialisation : pouvoir secret (amendement 2026-10-10). */
  pouvoirSpe: PouvoirSpe | null;
  statut: string;
  examenFait: boolean;
  /**
   * Délais restants à la réception (`recuA`), en ms : sort offensif (RG-10.3), Transformation, gel ;
   * `pouvoir` = recharge du pouvoir de Nen (0 = disponible, null = aucun), `reserve` = tirage de Matérialisation
   * (amendement 2026-10-10).
   */
  delais: { offensif: number; transformation: number; gel: number; pouvoir: number | null; reserve: number | null; specialisation: number | null };
  /** Zetsu restant (ms) et Fortune armée. */
  specialisation: { zetsu: number; fortuneArmee: boolean };
  /** Page ⑩ : durées complètes des recharges (ms, RG-14), pour la jauge ; null = sans objet. */
  recharges: { pouvoir: number | null; transformation: number; reserve: number | null; specialisation: number | null; zetsu: number | null };
  /** Amendements 2026-10-10 : villes déjà visitées (Retour), visite à distance en cours, Accompagnement subi (ms restantes). */
  villesVisitees: string[];
  retour: { ville: 'masadora' | 'antokiba'; resteMs: number } | null;
  accompagne: number;
  recuA: number;
}

/** Annonce du jeu en boîte de dialogue (voix de Greed Island) : sort reçu, évènement, sanction, invitation. */
export interface Alerte {
  n: number;
  genre: 'sort' | 'evenement' | 'sanction' | 'info';
  qui: string;
  texte: string;
  voir?: 'echanges' | 'antokiba';
  /** Durée d'affichage (ms), plus longue pour une liste (rattrapage). */
  duree?: number;
}

/** Page ⑪ : repère du dernier sort reçu vu par l'app, par joueur (rattrapage au retour). */
const cleRepere = (joueurId: string) => `gq-sorts-recus-${joueurId}`;
function lireRepere(joueurId: string): number | null {
  try {
    const v = localStorage.getItem(cleRepere(joueurId));
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}
function noterRepere(joueurId: string, n: number | undefined) {
  if (n === undefined) return;
  try {
    if ((lireRepere(joueurId) ?? -1) < n) localStorage.setItem(cleRepere(joueurId), String(n));
  } catch {
    // stockage indisponible : le rattrapage repartira du repère du serveur
  }
}

/** Évènements annoncés en boîte de dialogue, en plus du fil des notifications. */
const ANNONCES: Partial<Record<string, { genre: Alerte['genre']; qui: string }>> = {
  evenement: { genre: 'evenement', qui: 'Évènement' },
  mission: { genre: 'evenement', qui: 'Mission' },
  sanction: { genre: 'sanction', qui: 'Sanction' },
  carte_maudite: { genre: 'sanction', qui: 'Malédiction' },
  malediction: { genre: 'sanction', qui: 'Malédiction' },
  perte: { genre: 'sort', qui: 'Perte' },
  clear: { genre: 'evenement', qui: 'Clear' },
  clear_refuse: { genre: 'sanction', qui: 'Clear refusé' },
  clear_confirme: { genre: 'evenement', qui: 'Clear' },
};

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
  /** Heure locale de réception de `partie` : le temps restant est décompté à partir d'elle. */
  const [partieRecueA, setPartieRecueA] = useState(0);
  /** Alerte urgente affichée en bandeau (sort reçu, RG-10.5). */
  const [alerte, setAlerte] = useState<Alerte | null>(null);
  /** Session d'échange en cours (RG-11.1 amendé) et message de fin de la dernière. */
  const [echange, setEchange] = useState<VueEchange | null>(null);
  /** Page ⑫ : échange conclu, rejoué en cinématique « TRADE ! » (parts telles qu'à la double validation). */
  const [echangeConclu, setEchangeConclu] = useState<VueEchange | null>(null);
  const echangeRef = useRef<VueEchange | null>(null);
  echangeRef.current = echange;
  /** Fin déjà traitée (l'évènement et la réponse à ma propre action arrivent tous les deux). */
  const finVue = useRef<string | null>(null);
  /** Je viens de refuser ou d'annuler : la phrase de fin le dit. */
  const finParMoi = useRef(false);
  const [moi, setMoi] = useState<Moi | null>(null);
  /** Accompagnement lancé par ce joueur : position de sa cible pendant 3 min (amendement 2026-10-10). */
  const [suiviCible, setSuiviCible] = useState<SuiviCible | null>(null);
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
  const ajouterJenny = useCallback((montant: number) => setMoi((m) => (m ? { ...m, jenny: m.jenny + montant } : m)), []);
  /** Page ⑪ : sorts reçus qui frappent, en attente de leur cinématique (joués un par un, au niveau de l'App). */
  const [sortsRecus, setSortsRecus] = useState<SortRecu[]>([]);
  /** Qui t'a gelé (Gel, Accompagnement), pour le bandeau ; inconnu après un rechargement. */
  const [gelePar, setGelePar] = useState<{ pseudo: string; accompagnement: boolean } | null>(null);
  /** RG-7.5 : tirages reçus au rejeu de la file, en attente de leur cinématique (l'app les joue un par un). */
  const [rejoues, setRejoues] = useState<Extract<IssueScan, { type: 'ok' }>[]>([]);
  /**
   * Page ⑭ (RG-11.4) : dernier état connu de chaque lot d'Antokiba (qui mène, ma meilleure offre), pour dire « Kirua a
   * surenchéri » hors de la page ; lots clos récemment (tampon ADJUGÉ / INVENDU sur la page) ; lots gagnés, en attente
   * de la cinématique « ADJUGÉ ! » ; pastille sur Antokiba à l'accueil.
   */
  const lots = useRef(new Map<string, Lot>());
  const surAntokiba = useRef(false);
  const [clotures, setClotures] = useState<Cloture[]>([]);
  const [adjuges, setAdjuges] = useState<Adjuge[]>([]);
  /** Page ⑮ : l'arène de Soufrabi lue côté joueur (combat en cours, prochaine tentative) et les issues à jouer. */
  const [arene, setArene] = useState<{ etat: EtatArene; recuA: number } | null>(null);
  const [issuesArene, setIssuesArene] = useState<IssueArene[]>([]);
  const [pastilleAntokiba, setPastilleAntokiba] = useState(0);

  const rafraichir = useCallback(async () => {
    if (!partieId) return;
    try {
      const p = await api.get<{ partie: Partie }>(`/parties/${partieId}`);
      setPartie(p.partie);
      setPartieRecueA(Date.now());
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
      type Recu = Pick<Moi, 'delais' | 'specialisation' | 'recharges' | 'villesVisitees' | 'retour' | 'accompagne'>;
      const m = await api.get<{ joueur: Omit<Moi, keyof Recu | 'recuA'>; licenceSecret: string } & Recu>(`/parties/${partieId}/moi`);
      setMoi({
        ...m.joueur,
        delais: m.delais,
        specialisation: m.specialisation,
        recharges: m.recharges,
        villesVisitees: m.villesVisitees ?? [],
        retour: m.retour ?? null,
        accompagne: m.accompagne ?? 0,
        recuA: Date.now(),
      });
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
        // Un tirage rejoué a sa cinématique ; le solde suit à la fin de celle-ci.
        if (r.issue.type === 'ok') {
          const ok = r.issue;
          setRejoues((l) => [...l, ok]);
          setVersion((v) => v + 1);
        }
        notifier(`Scan hors ligne : ${resumeIssue(r.issue)}`);
      }
    } finally {
      rejeuEnCours.current = false;
      setEnFile(file.aRejouer(sess.partieId, Date.now()).valides.length);
    }
  }, [sess, notifier]);

  /** Page ⑭ : état des lots à la connexion (qui mène), pour prévenir d'une surenchère hors de la page. */
  const lireEncheres = useCallback(async () => {
    if (!sess) return;
    try {
      const r = await api.get<{ encheres: Lot[] }>(`/parties/${sess.partieId}/encheres`);
      lots.current = new Map(r.encheres.map((l) => [l.id, fusionnerLot(undefined, l, sess.joueurId)]));
    } catch {
      // hors ligne : on relira au retour du réseau
    }
  }, [sess]);

  /** Page ⑪ (RG-10.5) : sorts reçus pendant que l'app était fermée ou hors ligne, en une seule boîte. */
  const rattraper = useCallback(async () => {
    if (!sess) return;
    const avant = lireRepere(sess.joueurId);
    try {
      const r = await api.get<{ repere: number; maintenant: number; recus: SortRecu[] }>(`/parties/${sess.partieId}/sorts-recus${avant === null ? '' : `?apres=${avant}`}`);
      noterRepere(sess.joueurId, Math.max(r.repere, ...r.recus.map((x) => x.n ?? 0)));
      if (avant === null || r.recus.length === 0) return;
      const lignes = r.recus.map((x) => `▸ ${texteSortRecu(x)} (${ilYaRecu(x.heureJeu, r.maintenant)})`);
      setAlerte({ n: Date.now(), genre: 'sort', qui: 'Pendant ton absence', texte: lignes.join('\n'), duree: 6000 + 3000 * lignes.length });
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      // hors ligne : on réessaiera au retour du réseau
    }
  }, [sess]);

  useEffect(() => {
    if (!sess) return;
    const t = connectRealtime(API_URL, sess.token, {
      etat: (e) => {
        setConnexion(e);
        if (e === 'en_ligne') {
          void rejouer();
          void rattraper();
          void lireEncheres();
        }
      },
      evenement: (nom, data) => {
        setVersion((v) => v + 1);
        if (nom === 'echange') {
          recevoirEchange(data as EvenementEchange);
          return;
        }
        if (nom === 'sort_recu') {
          // RG-10.5 : alerte immédiate à la cible. Page ⑪ : cinématique pour les sorts qui frappent, boîte sinon.
          const d = data as SortRecu;
          const texte = texteSortRecu(d);
          notifier(texte);
          noterRepere(sess.joueurId, d.n);
          if (d.resultat === 'reussi' && d.lanceur && (d.sort === 'gel' || d.sort === 'accompagnement')) setGelePar({ pseudo: d.lanceur, accompagnement: d.sort === 'accompagnement' });
          if (issueRecu(d) === 'boite') {
            setAlerte({ n: Date.now(), genre: 'sort', qui: 'Sort reçu', texte });
            navigator.vibrate?.([200, 100, 200]);
          } else setSortsRecus((l) => [...l, d]);
          void rafraichir();
          return;
        }
        if (nom === 'accompagnement') {
          // Position de la cible, à chaque déplacement : pas de notification.
          const d = data as Omit<SuiviCible, 'recuA' | 'resteMs'> & { jusqua?: number | null };
          setSuiviCible((prev) => ({ cibleId: d.cibleId, pseudo: d.pseudo, position: d.position, resteMs: prev?.cibleId === d.cibleId ? prev.resteMs - (Date.now() - prev.recuA) : 3 * 60_000, recuA: Date.now() }));
          return;
        }
        if (nom === 'enchere') {
          // Surenchère : l'écran se met à jour, sans notification ; hors de la page, on prévient celui qui menait.
          const l = data as Lot;
          const avant = lots.current.get(l.id);
          lots.current.set(l.id, fusionnerLot(avant, l, sess.joueurId));
          if (avant && jeMene(avant, sess.joueurId) && l.meilleureOffre && !jeMene(l, sess.joueurId) && !surAntokiba.current) {
            const texte = texteSurencheri(l.meilleureOffre.pseudo, l.meilleureOffre.montant, l.carte.nom, l.resteMs);
            notifier(texte);
            setPastilleAntokiba((n) => n + 1);
            setAlerte({ n: Date.now(), genre: 'info', qui: 'Antokiba', texte, voir: 'antokiba' });
            navigator.vibrate?.(80);
          }
          return;
        }
        if (nom === 'enchere_close') {
          // RG-11.4 / 11.5 : le lot quitte la salle ; celui qui avait enchéri sans gagner ne paie rien.
          const c = data as Cloture;
          const l = lots.current.get(c.id);
          lots.current.delete(c.id);
          setClotures((x) => [...x.filter((k) => k.id !== c.id), c].slice(-10));
          if (l && l.maOffre != null && c.joueurId !== sess.joueurId) {
            const texte = texteClotureAutre(c, l.carte.nom);
            notifier(texte);
            setAlerte({ n: Date.now(), genre: 'info', qui: 'Antokiba', texte });
            navigator.vibrate?.([60, 60, 60]);
          }
          return;
        }
        if (nom === 'enchere_gagnee') {
          // La cinématique « ADJUGÉ ! » débite la jenny et range la carte (seul le gagnant paie, RG-11.4).
          const a = data as Adjuge;
          notifier(texteAdjuge(a.lot.nom, a.prix));
          setAdjuges((x) => (x.some((k) => k.id === a.id) ? x : [...x, a]));
          return;
        }
        if (nom === 'arene') {
          // Page ⑮ : entrée (mise prise), annulation (mise rendue), puis victoire (cinématique) ou défaite (court moment).
          const a = data as EvArene;
          if (a.etat === 'en_cours') {
            notifier(texteEntree(a.mise));
            setAlerte({ n: Date.now(), genre: 'info', qui: 'Soufrabi', texte: texteEntree(a.mise) });
            navigator.vibrate?.([30, 40, 30]);
          } else if (a.etat === 'annulee') {
            notifier(texteAnnulee(a.mise, a.motif));
            setAlerte({ n: Date.now(), genre: 'info', qui: 'Soufrabi', texte: texteAnnulee(a.mise, a.motif) });
          } else {
            notifier(a.etat === 'gagnee' ? 'Victoire à l’arène de Soufrabi !' : 'Défaite à l’arène de Soufrabi.');
            setIssuesArene((x) => (x.some((k) => k.id === a.id) ? x : [...x, { ...a, recuA: Date.now() }]));
            // Le verdict remplace la boîte de l'entrée (« Que le combat commence ! ») encore ouverte.
            setAlerte((x) => (x?.qui === 'Soufrabi' ? null : x));
          }
          void chargerArene();
          void rafraichir();
          return;
        }
        // Mises à jour fréquentes (PV du raid) : l'écran se met à jour, sans notification.
        if (nom === 'raid') return;
        const texte = (data as { texte?: unknown } | null)?.texte;
        const message = typeof texte === 'string' ? texte : libelleEvenement(nom);
        notifier(message);
        const annonce = ANNONCES[nom];
        if (annonce) {
          setAlerte({ n: Date.now(), ...annonce, texte: message });
          navigator.vibrate?.(120);
        }
        if (nom === 'partie' || nom === 'sanction' || nom === 'degel') void rafraichir();
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

  /**
   * Page ⑫ : une session d'échange change (évènement `echange`, ou réponse à ma propre action). Conclue : la
   * cinématique « TRADE ! » la rejoue ; refusée, annulée, expirée : le jeu le dit dans sa boîte. Une invitation
   * reçue prend l'écran comme un appel (SessionEchange), sans autre alerte.
   */
  const recevoirEchange = (e: EvenementEchange) => {
    if (termine(e.etat)) {
      const cle = `${e.id}:${e.etat}`;
      if (finVue.current === cle) return;
      finVue.current = cle;
      const avant = echangeRef.current?.id === e.id ? echangeRef.current : null;
      const avec = 'avec' in e ? e.avec.pseudo : avant?.avec.pseudo ?? null;
      const texte = messageFin(e.etat, avec, { parMoi: finParMoi.current, avant: avant?.etat ?? null, invite: avant?.invite ?? false });
      finParMoi.current = false;
      setEchange(null);
      notifier(texte);
      if (e.etat === 'conclu' && 'maPart' in e) setEchangeConclu(e);
      else {
        setAlerte({ n: Date.now(), genre: 'info', qui: 'Échange', texte });
        navigator.vibrate?.([60, 60, 60]);
      }
      void rafraichir();
      return;
    }
    const vue = e as VueEchange;
    if (vue.etat === 'invitation' && vue.invite && echangeRef.current?.id !== vue.id) notifier(vue.vente ? `${vue.avec.pseudo} te vend une carte` : `${vue.avec.pseudo} te propose un échange`);
    setEchange({ ...vue, recuA: Date.now() });
  };

  /** Page ⑮ : état de l'arène pour ce joueur. */
  const chargerArene = async () => {
    const s = session.get();
    if (!s) return;
    try {
      const r = await api.get<EtatArene>(`/parties/${s.partieId}/arene/moi`);
      setArene({ etat: r, recuA: Date.now() });
    } catch {
      // Hors ligne : l'affiche garde ce qu'elle savait.
    }
  };
  useEffect(() => {
    if (sess) void chargerArene();
  }, [sess]);

  // Reprise d'un échange en cours (app rechargée).
  useEffect(() => {
    if (!sess) return;
    api.get<{ echange: VueEchange | null }>(`/parties/${sess.partieId}/echanges/courant`).then(
      (r) => setEchange(r.echange ? { ...r.echange, recuA: Date.now() } : null),
      () => undefined,
    );
  }, [sess]);

  // Accompagnement en cours (app rechargée) : position de la cible et temps restant.
  useEffect(() => {
    if (!sess) return;
    api.get<{ accompagnement: (Omit<SuiviCible, 'recuA'>) | null }>(`/parties/${sess.partieId}/accompagnement`).then(
      (r) => setSuiviCible(r.accompagnement ? { ...r.accompagnement, recuA: Date.now() } : null),
      () => undefined,
    );
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

  /**
   * Position jointe à une intention (sort, achat…), RG-10.9 / RG-7.6 : la dernière position GPS
   * si elle a moins de 30 s, sinon une nouvelle. `envoyer` la transmet aussi au serveur (liste à portée).
   */
  const positionAction = useCallback(async (envoyer = false): Promise<PositionInput> => {
    const p = suivi.current?.fraiche() ?? (await positionActuelle());
    if (envoyer && sess) {
      await api.post(`/parties/${sess.partieId}/position`, p);
      suivi.current?.marquerEnvoyee(p);
    }
    return p;
  }, [sess]);

  /** Après une action réussie : Livre et profil (jenny, délais) rechargés. */
  const apresAction = useCallback(() => {
    setVersion((v) => v + 1);
    void rafraichir();
  }, [rafraichir]);

  /** RG-7 : scan d'une balise, position jointe (RG-7.6 : sans position, pas de scan). */
  const scannerBalise = useCallback(
    async (baliseId: string, secondSouffle = false): Promise<IssueScan> => {
      if (!sess) return { type: 'refus', code: 'non_inscrit', message: 'Inscris-toi d’abord' };
      let position = suivi.current?.fraiche() ?? null;
      if (!position) {
        try {
          position = await positionActuelle();
        } catch (e) {
          return { type: 'refus', code: 'gps', message: e instanceof Error ? e.message : String(e) };
        }
      }
      const issue = await scanner(api, file, sess.partieId, baliseId, position, Date.now(), secondSouffle);
      // Le solde (`issue.jenny`) est posé par l'écran à la fin de la cinématique du tirage.
      if (issue.type === 'ok') {
        suivi.current?.marquerEnvoyee(position);
        setVersion((v) => v + 1);
      }
      if (issue.type === 'en_file') setEnFile((n) => n + 1);
      return issue;
    },
    [sess],
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

  /** Retour à l'entrée (partie disparue ou mauvais code) : oublie la partie et sa session. */
  const quitterPartie = useCallback(() => {
    session.clear();
    setPartieId(null);
    setSess(null);
    setErreur(null);
    setPhase('sans_partie');
    history.replaceState(null, '', location.pathname);
  }, []);

  /** Après l'inscription : garde le jeton ; le rafraîchissement charge le profil. */
  const ouvrirSession = useCallback((s: Session) => {
    session.set(s);
    setSess(s);
  }, []);

  return {
    partieId,
    partie,
    partieRecueA,
    alerte,
    fermerAlerte: () => setAlerte(null),
    sortRecu: sortsRecus[0] ?? null,
    gelePar,
    /** Refus en clair, sans requête (onglet Scanner pendant un gel) ; `qui` : la voix (« Masadora », page ⑬). */
    annoncer: (texte: string, qui = 'Greed Island') => setAlerte({ n: Date.now(), genre: 'sort', qui, texte }),
    finSortRecu: () => setSortsRecus((l) => l.slice(1)),
    echange,
    /** Page ⑫ : session à jour (réponse d'une action, ou évènement). */
    recevoirEchange,
    /** À appeler juste avant de refuser ou d'annuler soi-même. */
    finParMoi: () => {
      finParMoi.current = true;
    },
    echangeConclu,
    finEchangeConclu: () => setEchangeConclu(null),
    /** Page ⑭ : enchères d'Antokiba. */
    encheres: {
      /** Le joueur est sur la page : pas de boîte « a surenchéri », la pastille s'efface. */
      surPage: (oui: boolean) => {
        surAntokiba.current = oui;
        if (oui) setPastilleAntokiba(0);
      },
      /** Lot lu ou modifié par la page (GET, ma propre offre). */
      noter: (l: Lot) => lots.current.set(l.id, l),
      clotures,
      pastille: pastilleAntokiba,
      adjuge: adjuges[0] ?? null,
      finAdjuge: () => setAdjuges((x) => x.slice(1)),
    },
    /** Page ⑮ : arène de Soufrabi. */
    arene: {
      etat: arene,
      recharger: chargerArene,
      issue: issuesArene[0] ?? null,
      finIssue: () => setIssuesArene((x) => x.slice(1)),
    },
    positionAction,
    apresAction,
    moi,
    suiviCible,
    /** Après un Accompagnement réussi : la réponse de POST /sort ouvre le suivi. */
    ouvrirSuivi: (s: Omit<SuiviCible, 'recuA'>) => setSuiviCible({ ...s, recuA: Date.now() }),
    /** Dernière position GPS connue de ce téléphone (pour la direction de l'Accompagnement). */
    positionConnue: () => suivi.current?.fraiche() ?? null,
    /** Ta position pour la carte de l'île (moins de 2 min, RG-10.10). */
    positionCarte: () => suivi.current?.derniere() ?? null,
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
    quitterPartie,
    /** Solde annoncé par le serveur (bonus de l'Examen…) sans recharger tout le profil. */
    majJenny,
    /** Jenny gagnés un à un pendant la cinématique du tirage. */
    ajouterJenny,
    rejoues,
    /** Retire le premier tirage rejoué (sa cinématique commence). */
    prendreRejoue: () => setRejoues((l) => l.slice(1)),
    ouvrirSession,
    scannerBalise,
  };
}
