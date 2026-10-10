import { useEffect, useRef, useState } from 'react';
import { Accueil, useEvenements, type SousEcran } from './ecrans/Accueil';
import { Boutique } from './ecrans/Boutique';
import { Echanges } from './ecrans/Echanges';
import { Encheres } from './ecrans/Encheres';
import { Examen } from './ecrans/Examen';
import { Raid } from './ecrans/Raid';
import { Inscription, type Kit as KitRecu } from './ecrans/Inscription';
import { Kit } from './ecrans/Kit';
import { Licence } from './ecrans/Licence';
import { Livre } from './ecrans/Livre';
import { Nen } from './ecrans/Nen';
import { Chrono } from './ecrans/Chrono';
import { Scan } from './ecrans/Scan';
import { Sorts } from './ecrans/Sorts';
import { api, session } from './lib/client';
import { creerEveil, eveilDisponible, preferenceEveil } from './lib/eveil';
import { baliseDepuisUrl } from './lib/qr';
import type { Question } from './lib/quiz';
import { useJeu, type Moi } from './lib/useJeu';

/** Amendement 2026-10-10 : visite à distance (sort Retour) encore ouverte pour cette ville. */
const retourActif = (m: Moi, ville: 'masadora' | 'antokiba') => m.retour?.ville === ville && m.retour.resteMs - (Date.now() - m.recuA) > 0;

interface Questionnaires {
  examen: Question[];
  nen: Question[];
}

type Onglet = 'accueil' | 'scan' | 'livre' | 'sorts' | 'echanges';
const ONGLETS: { id: Onglet; nom: string }[] = [
  { id: 'accueil', nom: 'Accueil' },
  { id: 'scan', nom: 'Scanner' },
  { id: 'livre', nom: 'Book' },
  { id: 'sorts', nom: 'Sorts' },
  { id: 'echanges', nom: 'Échanges' },
];

export function App() {
  const jeu = useJeu();
  const [kit, setKit] = useState<KitRecu | null>(null);
  const [quiz, setQuiz] = useState<Questionnaires | null>(null);
  const [examenOuvert, setExamenOuvert] = useState(false);
  const [, majReport] = useState(0);
  const [onglet, setOnglet] = useState<Onglet>('accueil');
  /** Écran ouvert depuis l'accueil (licence, lieux, raid). */
  const [sous, setSous] = useState<SousEcran | null>(null);
  const evenements = useEvenements(jeu.partieId ?? '', jeu.version);
  // Balise scannée avec l'appareil photo du téléphone : l'app s'ouvre sur `?balise=<id>`.
  const [baliseLien, setBaliseLien] = useState<string | null>(() => baliseDepuisUrl(location.search));
  // Option « garder l'écran allumé » (facultative, consomme de la batterie).
  const eveil = useRef<ReturnType<typeof creerEveil> | null>(null);
  const [ecranAllume, setEcranAllume] = useState(preferenceEveil);
  useEffect(() => {
    if (jeu.phase !== 'en_jeu' || !eveilDisponible()) return;
    const e = creerEveil();
    e.demarrer();
    eveil.current = e;
    return () => e.arreter();
  }, [jeu.phase]);

  useEffect(() => {
    if (!jeu.partieId || quiz) return;
    api.get<Questionnaires>(`/parties/${jeu.partieId}/questionnaires`).then(setQuiz, () => undefined);
  }, [jeu.partieId, quiz]);

  const moi = jeu.moi;
  const partie = jeu.partie;
  // Parcours d'arrivée : kit → Examen (RG-5.3, peut attendre) → test de Nen (RG-5.4) → accueil.
  let ecran: 'kit' | 'examen' | 'nen' | 'accueil' = 'accueil';
  if (jeu.phase === 'en_jeu' && moi) {
    if (kit) ecran = 'kit';
    else if (!moi.examenFait && (examenOuvert || !session.examenReporte(moi.id))) ecran = 'examen';
    else if (moi.nen === null) ecran = 'nen';
  }
  useEffect(() => {
    if (ecran !== 'accueil' || !baliseLien) return;
    setOnglet('scan');
    const u = new URL(location.href);
    u.searchParams.delete('balise');
    history.replaceState(null, '', u);
  }, [ecran, baliseLien]);

  const finEtape = () => {
    setExamenOuvert(false);
    void jeu.rafraichir();
  };

  return (
    <div className="app">
      <header className="barre">
        <span className="titre">Greed Quest</span>
        {partie && jeu.phase === 'en_jeu' && <Chrono partie={partie} recueA={jeu.partieRecueA} />}
        {moi && <span className="jenny">{moi.jenny} J</span>}
        {jeu.phase === 'en_jeu' && <span className={`pastille ${jeu.connexion}`} title={jeu.connexion === 'en_ligne' ? 'Connecté' : 'Hors ligne'} />}
      </header>
      {jeu.alerte && (
        <div className="alerte" role="alert" key={jeu.alerte.n}>
          <span>{jeu.alerte.texte}</span>
          {jeu.alerte.voir && (
            <button
              className="lien"
              onClick={() => {
                setOnglet('echanges');
                jeu.fermerAlerte();
              }}
            >
              Voir
            </button>
          )}
          <button className="lien" onClick={jeu.fermerAlerte} aria-label="Fermer l’alerte">
            ✕
          </button>
        </div>
      )}
      <main>
        {jeu.phase === 'sans_partie' && <ChoixPartie onChoix={jeu.choisirPartie} />}
        {jeu.phase === 'chargement' && <p className="info">Chargement…</p>}
        {jeu.phase === 'erreur' && (
          <div className="carte">
            <p>{jeu.erreur}</p>
            <button onClick={() => void jeu.rafraichir()}>Réessayer</button>
          </div>
        )}
        {jeu.phase === 'non_inscrit' && partie && (
          <Inscription
            partie={partie}
            onInscrit={(s, k) => {
              setKit(k);
              jeu.ouvrirSession(s);
            }}
          />
        )}
        {jeu.phase === 'en_jeu' && partie && moi && (
          <>
            {ecran === 'kit' && kit && <Kit kit={kit} onSuite={() => setKit(null)} />}
            {ecran === 'examen' && quiz && (
              <Examen
                partieId={partie.id}
                questions={quiz.examen}
                onReporter={() => {
                  session.reporterExamen(moi.id);
                  setExamenOuvert(false);
                  majReport((n) => n + 1);
                }}
                onFini={finEtape}
              />
            )}
            {ecran === 'nen' && quiz && <Nen partieId={partie.id} questions={quiz.nen} onFini={finEtape} />}
            {(ecran === 'examen' || ecran === 'nen') && !quiz && <p className="info">Chargement…</p>}
            {ecran === 'accueil' && onglet === 'scan' && (
              <Scan
                scannerBalise={jeu.scannerBalise}
                enFile={jeu.enFile}
                gpsErreur={jeu.gpsErreur}
                baliseInitiale={baliseLien}
                key={baliseLien ?? 'camera'}
              />
            )}
            {ecran === 'accueil' && onglet === 'livre' && <Livre partieId={partie.id} version={jeu.version} apresAction={jeu.apresAction} />}
            {ecran === 'accueil' && onglet === 'sorts' && (
              <Sorts
                partieId={partie.id}
                moi={moi}
                version={jeu.version}
                positionAction={jeu.positionAction}
                apresAction={jeu.apresAction}
                suiviCible={jeu.suiviCible}
                ouvrirSuivi={jeu.ouvrirSuivi}
                positionConnue={jeu.positionConnue}
              />
            )}
            {ecran === 'accueil' && onglet === 'echanges' && (
              <Echanges
                partieId={partie.id}
                jenny={moi.jenny}
                version={jeu.version}
                echange={jeu.echange}
                setEchange={jeu.setEchange}
                finEchange={jeu.finEchange}
                fermerFinEchange={jeu.fermerFinEchange}
                positionAction={jeu.positionAction}
              />
            )}
            {ecran === 'accueil' && onglet === 'accueil' && sous === 'licence' && jeu.licenceSecret && (
              <>
                <button className="lien" onClick={() => setSous(null)}>
                  ‹ Retour
                </button>
                <Licence partieId={partie.id} joueurId={moi.id} pseudo={moi.pseudo} secret={jeu.licenceSecret} />
              </>
            )}
            {ecran === 'accueil' && onglet === 'accueil' && sous === 'boutique' && (
              <Boutique
                partieId={partie.id}
                jenny={moi.jenny}
                version={jeu.version}
                positionAction={jeu.positionAction}
                apresAction={jeu.apresAction}
                onRetour={() => setSous(null)}
                aDistance={retourActif(moi, 'masadora')}
              />
            )}
            {ecran === 'accueil' && onglet === 'accueil' && sous === 'encheres' && (
              <Encheres
                partieId={partie.id}
                jenny={moi.jenny}
                version={jeu.version}
                positionAction={jeu.positionAction}
                onRetour={() => setSous(null)}
                aDistance={retourActif(moi, 'antokiba')}
              />
            )}
            {ecran === 'accueil' && onglet === 'accueil' && sous === 'raid' && (
              <Raid
                partieId={partie.id}
                pv={evenements.liste.find((e) => e.type === 'raid')?.pv ?? 0}
                pvMax={evenements.liste.find((e) => e.type === 'raid')?.pvMax ?? 0}
                onRetour={() => setSous(null)}
              />
            )}
            {ecran === 'accueil' && onglet === 'accueil' && sous === null && (
              <Accueil
                partie={partie}
                moi={moi}
                evenements={evenements}
                notifs={jeu.notifs}
                ecranAllume={ecranAllume}
                onEcranAllume={(oui) => {
                  setEcranAllume(oui);
                  void eveil.current?.regler(oui);
                }}
                onExamen={() => setExamenOuvert(true)}
                onOuvrir={setSous}
              />
            )}
          </>
        )}
      </main>
      {jeu.phase === 'en_jeu' && ecran === 'accueil' && (
        <nav className="onglets">
          {ONGLETS.map((o) => (
            <button
              key={o.id}
              className={onglet === o.id ? 'actif' : ''}
              onClick={() => {
                if (o.id === 'scan') setBaliseLien(null);
                if (o.id === 'accueil') setSous(null);
                setOnglet(o.id);
              }}
            >
              {o.nom}
              {o.id === 'echanges' && jeu.echange && <span className="point" aria-label="échange en cours" />}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

function ChoixPartie({ onChoix }: { onChoix: (id: string) => void }) {
  const [id, setId] = useState('');
  return (
    <form
      className="carte"
      onSubmit={(e) => {
        e.preventDefault();
        if (id.trim()) onChoix(id.trim());
      }}
    >
      <h1>Rejoindre une partie</h1>
      <p className="info">Scanne le QR d'accueil affiché par l'organisation, ou saisis le code de la partie.</p>
      <input value={id} onChange={(e) => setId(e.target.value)} placeholder="Code de la partie" autoCapitalize="off" />
      <button type="submit">Continuer</button>
    </form>
  );
}
