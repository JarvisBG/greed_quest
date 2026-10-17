// Console de l'équipe (docs/PROMPT_INTERFACES.md § 4.1) : barre permanente, onglets selon le rôle reçu à la
// connexion. Le PNJ ne voit aucun bouton GM (le serveur refuserait de toute façon, RG-3).
import { useEffect, useState } from 'react';
import { Alertes } from './ecrans/Alertes';
import { Barre } from './ecrans/Barre';
import { Connexion } from './ecrans/Connexion';
import { Joueur, type Cible } from './ecrans/Joueur';
import { Journal } from './ecrans/Journal';
import { Lieux } from './ecrans/Lieux';
import { partieFromUrl } from './lib/session';
import { useEquipe } from './lib/useEquipe';

type Onglet = 'licence' | 'lieux' | 'alertes' | 'journal';

const ONGLETS: { id: Onglet; libelle: string }[] = [
  { id: 'licence', libelle: 'Licence' },
  { id: 'lieux', libelle: 'Lieux' },
  { id: 'alertes', libelle: 'Alertes' },
  { id: 'journal', libelle: 'Journal' },
];

export function App() {
  const partieUrl = partieFromUrl(location.search);
  const eq = useEquipe(partieUrl);
  const [onglet, setOnglet] = useState<Onglet>('licence');
  const [cible, setCible] = useState<Cible | null>(null);
  // Alertes non lues : arrivées depuis la dernière visite de l'onglet.
  const [alertesVues, setAlertesVues] = useState(0);
  const nonLues = Math.max(0, eq.alertesRecues - alertesVues);
  useEffect(() => {
    if (onglet === 'alertes') setAlertesVues(eq.alertesRecues);
  }, [onglet, eq.alertesRecues]);

  if (!eq.session) {
    return (
      <div className="app">
        <main className="pile" style={{ paddingTop: 24 }}>
          <Connexion partieUrl={partieUrl} connecter={eq.connecter} />
        </main>
      </div>
    );
  }

  const viserJoueur = (c: Cible) => {
    setCible(c);
    setOnglet('licence');
  };

  return (
    <div className={`app${eq.session.role === 'gm' ? ' large' : ''}`}>
      <Barre eq={eq} />
      <nav className="onglets" aria-label="Écrans de la console">
        {ONGLETS.map((o) => (
          <button key={o.id} type="button" className={onglet === o.id ? 'actif' : ''} aria-current={onglet === o.id ? 'page' : undefined} onClick={() => setOnglet(o.id)}>
            {o.libelle}
            {o.id === 'alertes' && nonLues > 0 && <span className="badge">{nonLues}</span>}
          </button>
        ))}
      </nav>
      <main>
        {onglet === 'licence' && <Joueur eq={eq} cible={cible} setCible={setCible} />}
        {onglet === 'lieux' && <Lieux eq={eq} />}
        {onglet === 'alertes' && <Alertes eq={eq} viserJoueur={viserJoueur} />}
        {onglet === 'journal' && <Journal eq={eq} />}
      </main>
    </div>
  );
}
