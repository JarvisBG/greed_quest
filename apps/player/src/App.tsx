import { Annonce } from '@gq/ui';
import { useEffect, useRef, useState } from 'react';
import { Accueil, useEvenements, type SousEcran } from './ecrans/Accueil';
import { Boutique } from './ecrans/Boutique';
import { Chrono } from './ecrans/Chrono';
import { Echanges } from './ecrans/Echanges';
import { Encheres } from './ecrans/Encheres';
import { Entree } from './ecrans/Entree';
import { Examen } from './ecrans/Examen';
import { IconeAccueil, IconeBook, IconeEchanges, IconeScanner, IconeSorts } from './ecrans/Icones';
import { Inscription, type Kit as KitRecu } from './ecrans/Inscription';
import { Kit } from './ecrans/Kit';
import { Licence } from './ecrans/Licence';
import { Livre } from './ecrans/Livre';
import { Nen } from './ecrans/Nen';
import { Raid } from './ecrans/Raid';
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
  /** RG-5.4 : question secrète de Wing pour le Spécialiste. */
  specialisation: Question;
}

type Onglet = 'accueil' | 'scan' | 'livre' | 'sorts' | 'echanges';
const ONGLETS: { id: Onglet; nom: string; icone: () => React.JSX.Element }[] = [
  { id: 'accueil', nom: 'Accueil', icone: IconeAccueil },
  { id: 'scan', nom: 'Scanner', icone: IconeScanner },
  { id: 'livre', nom: 'Book', icone: IconeBook },
  { id: 'sorts', nom: 'Sorts', icone: IconeSorts },
  { id: 'echanges', nom: 'Échanges', icone: IconeEchanges },
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
    // Un Spécialiste sans pouvoir (page rechargée avant la question secrète) y revient.
    else if (moi.nen === null || (moi.nen === 'specialisation' && moi.pouvoirSpe === null)) ecran = 'nen';
  }
  useEffect(() => {
    if (ecran !== 'accueil' || !baliseLien) return;
    setOnglet('scan');
    const u = new URL(location.href);
    u.searchParams.delete('balise');
    history.replaceState(null, '', u);
  }, [ecran, baliseLien]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [onglet, sous, ecran]);

  const finEtape = () => {
    setExamenOuvert(false);
    void jeu.rafraichir();
  };
  const enJeu = jeu.phase === 'en_jeu' && partie && moi;

  return (
    <div className="app">
      {jeu.phase !== 'sans_partie' && (
      <header className="barre">
        {enJeu ? (
          <>
            <Chrono partie={partie} recueA={jeu.partieRecueA} />
            <span className="liaison">
              <i className={`gi-pastille ${jeu.connexion}`} aria-hidden="true" />
              {jeu.connexion === 'en_ligne' ? 'En ligne' : jeu.connexion === 'connexion' ? 'Connexion…' : 'Hors ligne'}
            </span>
            <span className="jenny" aria-label={`${moi.jenny} jenny`}>
              {moi.jenny}
              <small>J</small>
            </span>
          </>
        ) : (
          <span className="marque">Greed Island</span>
        )}
      </header>
      )}

      {jeu.alerte && (
        <Annonce
          cle={jeu.alerte.n}
          genre={jeu.alerte.genre}
          qui={jeu.alerte.qui}
          texte={jeu.alerte.texte}
          onFermer={jeu.fermerAlerte}
          {...(jeu.alerte.voir
            ? {
                action: (
                  <button
                    onClick={() => {
                      setOnglet('echanges');
                      jeu.fermerAlerte();
                    }}
                  >
                    Voir
                  </button>
                ),
              }
            : {})}
        />
      )}

      <main>
        {jeu.phase === 'sans_partie' && <Entree onChoix={jeu.choisirPartie} />}
        {jeu.phase === 'chargement' && (
          <div className="planche">
            <p className="doux">Chargement…</p>
          </div>
        )}
        {jeu.phase === 'erreur' && (
          <div className="planche">
            <section className="gi-case">
              <p className="erreur">{jeu.erreur}</p>
              <button className="gi-btn-encre" onClick={() => void jeu.rafraichir()}>
                Réessayer
              </button>
              <button className="gi-lien" onClick={jeu.quitterPartie}>
                Rejoindre une autre partie
              </button>
            </section>
          </div>
        )}
        {jeu.phase === 'non_inscrit' && partie && (
          <Inscription
            partie={partie}
            onAutrePartie={jeu.quitterPartie}
            onInscrit={(s, k) => {
              setKit(k);
              jeu.ouvrirSession(s);
            }}
          />
        )}
        {enJeu && (
          <>
            {ecran === 'kit' && kit && <Kit kit={kit} onSuite={() => setKit(null)} />}
            {ecran === 'examen' && quiz && (
              <Examen
                partieId={partie.id}
                questions={quiz.examen}
                onBonus={(bonus) => jeu.majJenny(moi.jenny + bonus)}
                onReporter={() => {
                  session.reporterExamen(moi.id);
                  setExamenOuvert(false);
                  majReport((n) => n + 1);
                }}
                onFini={finEtape}
              />
            )}
            {ecran === 'nen' && quiz && <Nen partieId={partie.id} nenConnu={moi.nen} questions={quiz.nen} secrete={quiz.specialisation} onFini={finEtape} />}
            {(ecran === 'examen' || ecran === 'nen') && !quiz && (
              <div className="planche">
                <p className="doux">Chargement…</p>
              </div>
            )}
            {ecran === 'accueil' && onglet === 'scan' && (
              <Scan
                partieId={partie.id}
                scannerBalise={jeu.scannerBalise}
                enFile={jeu.enFile}
                gpsErreur={jeu.gpsErreur}
                baliseInitiale={baliseLien}
                key={baliseLien ?? 'camera'}
              />
            )}
            {ecran === 'accueil' && onglet === 'livre' && <Livre partieId={partie.id} version={jeu.version} apresAction={jeu.apresAction} positionAction={jeu.positionAction} />}
            {ecran === 'accueil' && onglet === 'sorts' && (
              <div className="ancien">
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
              </div>
            )}
            {ecran === 'accueil' && onglet === 'echanges' && (
              <div className="ancien">
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
              </div>
            )}
            {ecran === 'accueil' && onglet === 'accueil' && sous === 'licence' && jeu.licenceSecret && (
              <Licence partieId={partie.id} joueurId={moi.id} pseudo={moi.pseudo} nen={moi.nen} secret={jeu.licenceSecret} onRetour={() => setSous(null)} />
            )}
            {ecran === 'accueil' && onglet === 'accueil' && sous === 'boutique' && (
              <div className="ancien">
                <Boutique
                  partieId={partie.id}
                  jenny={moi.jenny}
                  version={jeu.version}
                  positionAction={jeu.positionAction}
                  apresAction={jeu.apresAction}
                  onRetour={() => setSous(null)}
                  aDistance={retourActif(moi, 'masadora')}
                />
              </div>
            )}
            {ecran === 'accueil' && onglet === 'accueil' && sous === 'encheres' && (
              <div className="ancien">
                <Encheres
                  partieId={partie.id}
                  jenny={moi.jenny}
                  version={jeu.version}
                  positionAction={jeu.positionAction}
                  onRetour={() => setSous(null)}
                  aDistance={retourActif(moi, 'antokiba')}
                />
              </div>
            )}
            {ecran === 'accueil' && onglet === 'accueil' && sous === 'raid' && (
              <div className="ancien">
                <Raid
                  partieId={partie.id}
                  pv={evenements.liste.find((e) => e.type === 'raid')?.pv ?? 0}
                  pvMax={evenements.liste.find((e) => e.type === 'raid')?.pvMax ?? 0}
                  onRetour={() => setSous(null)}
                />
              </div>
            )}
            {ecran === 'accueil' && onglet === 'accueil' && sous === null && (
              <Accueil
                partie={partie}
                moi={moi}
                version={jeu.version}
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
        <nav className="onglets" aria-label="Navigation">
          {ONGLETS.map((o) => (
            <button
              key={o.id}
              data-onglet={o.id}
              aria-current={onglet === o.id ? 'page' : undefined}
              onClick={() => {
                if (o.id === 'scan') setBaliseLien(null);
                if (o.id === 'accueil') setSous(null);
                setOnglet(o.id);
              }}
            >
              <o.icone />
              {o.nom}
              {o.id === 'echanges' && jeu.echange && <span className="point" aria-label="échange en cours" />}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
