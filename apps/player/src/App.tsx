import { useState } from 'react';
import { formatDuree, libelleEtat, libelleEvenement } from './lib/format';
import { useJeu } from './lib/useJeu';

export function App() {
  const jeu = useJeu();
  return (
    <div className="app">
      <header className="barre">
        <span className="titre">Greed Quest</span>
        {jeu.moi && <span className="jenny">{jeu.moi.jenny} J</span>}
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
        {jeu.phase === 'non_inscrit' && jeu.partie && (
          <div className="carte">
            <h1>{jeu.partie.nom}</h1>
            <p>{libelleEtat(jeu.partie.etat)}</p>
            <p className="info">{jeu.partie.inscriptionsOuvertes ? 'Inscription : écran à venir (tâche 3.2).' : 'Les inscriptions sont fermées.'}</p>
          </div>
        )}
        {jeu.phase === 'en_jeu' && jeu.partie && jeu.moi && (
          <>
            <div className="carte">
              <h1>{jeu.moi.pseudo}</h1>
              <p>
                {jeu.partie.nom} · {libelleEtat(jeu.partie.etat)} · reste {formatDuree(jeu.partie.restantMs)}
              </p>
            </div>
            <section>
              <h2>Notifications</h2>
              {jeu.notifs.length === 0 && <p className="info">Rien pour l'instant.</p>}
              <ul className="fil">
                {jeu.notifs.map((n) => (
                  <li key={n.n}>{libelleEvenement(n.nom)}</li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
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
