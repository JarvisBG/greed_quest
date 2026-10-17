// Console de l'équipe (docs/PROMPT_INTERFACES.md § 4.1) : barre permanente, onglets selon le rôle reçu à la
// connexion. Le PNJ ne voit aucun bouton GM (le serveur refuserait de toute façon, RG-3).
import { useEffect, useState } from 'react';
import { Alertes } from './ecrans/Alertes';
import { Barre } from './ecrans/Barre';
import { Connexion } from './ecrans/Connexion';
import { Clear } from './ecrans/gm/Clear';
import { Evenements } from './ecrans/gm/Evenements';
import { Partie } from './ecrans/gm/Partie';
import { Joueur, type Cible } from './ecrans/Joueur';
import { Journal } from './ecrans/Journal';
import { Lieux } from './ecrans/Lieux';
import { partieFromUrl } from './lib/session';
import { useEquipe } from './lib/useEquipe';

type Onglet = 'licence' | 'lieux' | 'alertes' | 'journal' | 'partie' | 'evenements' | 'clear';

const ONGLETS: { id: Onglet; libelle: string }[] = [
  { id: 'licence', libelle: 'Licence' },
  { id: 'lieux', libelle: 'Lieux' },
  { id: 'alertes', libelle: 'Alertes' },
  { id: 'journal', libelle: 'Journal' },
];
/** Onglets du GM, en plus de ceux du PNJ (jamais montrés à un PNJ). */
const ONGLETS_GM: { id: Onglet; libelle: string }[] = [
  { id: 'partie', libelle: 'Partie' },
  { id: 'evenements', libelle: 'Évènements' },
  { id: 'clear', libelle: 'Clear' },
];

export function App() {
  const partieUrl = partieFromUrl(location.search);
  const eq = useEquipe(partieUrl);
  const [onglet, setOnglet] = useState<Onglet>(eq.session?.role === 'gm' ? 'partie' : 'licence');
  const [cible, setCible] = useState<Cible | null>(null);
  // Le GM arrive sur « Partie » (et la caméra de l'onglet Licence ne s'allume pas d'elle-même sur son ordinateur).
  const role = eq.session?.role;
  useEffect(() => {
    if (role) setOnglet(role === 'gm' ? 'partie' : 'licence');
  }, [role]);
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
        {(eq.session.role === 'gm' ? [...ONGLETS_GM, ...ONGLETS] : ONGLETS).map((o) => (
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
        {eq.session.role === 'gm' && onglet === 'partie' && <Partie eq={eq} />}
        {eq.session.role === 'gm' && onglet === 'evenements' && <Evenements eq={eq} />}
        {eq.session.role === 'gm' && onglet === 'clear' && <Clear eq={eq} />}
      </main>
    </div>
  );
}
