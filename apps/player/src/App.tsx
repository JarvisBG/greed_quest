import { useEffect, useState } from 'react';
import { Examen } from './ecrans/Examen';
import { Inscription, type Kit as KitRecu } from './ecrans/Inscription';
import { Kit } from './ecrans/Kit';
import { Licence } from './ecrans/Licence';
import { Livre } from './ecrans/Livre';
import { Nen } from './ecrans/Nen';
import { Scan } from './ecrans/Scan';
import { api, session } from './lib/client';
import { formatDuree, libelleEtat, NENS } from './lib/format';
import { baliseDepuisUrl } from './lib/qr';
import type { Question } from './lib/quiz';
import { useJeu } from './lib/useJeu';

interface Questionnaires {
  examen: Question[];
  nen: Question[];
}

type Onglet = 'accueil' | 'scan' | 'livre' | 'licence';
const ONGLETS: { id: Onglet; nom: string }[] = [
  { id: 'accueil', nom: 'Accueil' },
  { id: 'scan', nom: 'Scanner' },
  { id: 'livre', nom: 'Livre' },
  { id: 'licence', nom: 'Licence' },
];

export function App() {
  const jeu = useJeu();
  const [kit, setKit] = useState<KitRecu | null>(null);
  const [quiz, setQuiz] = useState<Questionnaires | null>(null);
  const [examenOuvert, setExamenOuvert] = useState(false);
  const [, majReport] = useState(0);
  const [onglet, setOnglet] = useState<Onglet>('accueil');
  // Balise scannée avec l'appareil photo du téléphone : l'app s'ouvre sur `?balise=<id>`.
  const [baliseLien, setBaliseLien] = useState<string | null>(() => baliseDepuisUrl(location.search));

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
        {moi && <span className="jenny">{moi.jenny} J</span>}
        {jeu.phase === 'en_jeu' && <span className={`pastille ${jeu.connexion}`} title={jeu.connexion === 'en_ligne' ? 'Connecté' : 'Hors ligne'} />}
      </header>
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
            {ecran === 'accueil' && onglet === 'livre' && <Livre partieId={partie.id} version={jeu.version} />}
            {ecran === 'accueil' && onglet === 'licence' && jeu.licenceSecret && (
              <Licence partieId={partie.id} joueurId={moi.id} pseudo={moi.pseudo} secret={jeu.licenceSecret} />
            )}
            {ecran === 'accueil' && onglet === 'accueil' && (
              <>
                <div className="carte">
                  <h1>{moi.pseudo}</h1>
                  <p>
                    {partie.nom} · {libelleEtat(partie.etat)} · reste {formatDuree(partie.restantMs)}
                  </p>
                  {moi.nen && <p className="info">Nen : {NENS[moi.nen].nom}</p>}
                </div>
                {!moi.examenFait && (
                  <div className="carte">
                    <p>L’Examen Hunter t’attend : des jenny à gagner.</p>
                    <button className="secondaire" onClick={() => setExamenOuvert(true)}>
                      Passer l’Examen
                    </button>
                  </div>
                )}
                <section>
                  <h2>Notifications</h2>
                  {jeu.notifs.length === 0 && <p className="info">Rien pour l'instant.</p>}
                  <ul className="fil">
                    {jeu.notifs.map((n) => (
                      <li key={n.n}>{n.texte}</li>
                    ))}
                  </ul>
                </section>
              </>
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
                setOnglet(o.id);
              }}
            >
              {o.nom}
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
