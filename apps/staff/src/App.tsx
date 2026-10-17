// Console de l'équipe, organisée comme les pages GM d'Otaku Quest : menu latéral (une page par fonction), bandeau du
// haut (page, partie, état, chrono, « EN DIRECT », membre connecté). Le PNJ ne voit que ses pages (RG-3).
import { useEffect, useState } from 'react';
import { Alertes } from './ecrans/Alertes';
import { Arene } from './ecrans/Arene';
import { Checkpoints } from './ecrans/Checkpoints';
import { Connexion } from './ecrans/Connexion';
import { Encheres } from './ecrans/Encheres';
import { Clear } from './ecrans/gm/Clear';
import { Evenements } from './ecrans/gm/Evenements';
import { Joueur, type Cible } from './ecrans/Joueur';
import { Joueurs } from './ecrans/Joueurs';
import { Journal } from './ecrans/Journal';
import { Missions } from './ecrans/Missions';
import { Tableau } from './ecrans/Tableau';
import { formatDuree, libelleEtat } from './lib/format';
import { partieFromUrl } from './lib/session';
import { useEquipe } from './lib/useEquipe';

interface PageDef {
  id: string;
  titre: string;
  icone: string;
  gm?: boolean;
}
const PAGES: PageDef[] = [
  { id: 'dashboard', titre: 'Dashboard', icone: 'fa-gauge-high' },
  { id: 'joueurs', titre: 'Joueurs', icone: 'fa-users' },
  { id: 'licence', titre: 'Scanner une licence', icone: 'fa-qrcode' },
  { id: 'evenements', titre: 'Évènements', icone: 'fa-bolt', gm: true },
  { id: 'clear', titre: 'Clear', icone: 'fa-flag-checkered', gm: true },
  { id: 'checkpoints', titre: 'Checkpoints', icone: 'fa-location-dot' },
  { id: 'arene', titre: 'Arène', icone: 'fa-hand-fist' },
  { id: 'encheres', titre: 'Enchères', icone: 'fa-gavel' },
  { id: 'missions', titre: 'Missions', icone: 'fa-scroll' },
  { id: 'alertes', titre: 'Alertes', icone: 'fa-triangle-exclamation' },
  { id: 'journal', titre: 'Journal', icone: 'fa-list' },
];
/** Le chrono ne tourne que pendant le jeu (RG-4.4 : arrêté en pause). */
const CHRONO_TOURNE = new Set(['en_cours', 'phase_finale']);

export function App() {
  const partieUrl = partieFromUrl(location.search);
  const eq = useEquipe(partieUrl);
  const [page, setPage] = useState('dashboard');
  const [menu, setMenu] = useState(false);
  const [cible, setCible] = useState<Cible | null>(null);
  const [alertesVues, setAlertesVues] = useState(0);
  const nonLues = Math.max(0, eq.alertesRecues - alertesVues);
  useEffect(() => {
    if (page === 'alertes') setAlertesVues(eq.alertesRecues);
  }, [page, eq.alertesRecues]);

  // Chrono de la partie, décompté entre deux lectures.
  const [lu, setLu] = useState(Date.now());
  const [maintenant, setMaintenant] = useState(Date.now());
  useEffect(() => setLu(Date.now()), [eq.partie]);
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!eq.session) {
    return (
      <>
        <div className="bg-layer bg-glow" />
        <div className="bg-layer bg-grid" />
        <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Connexion partieUrl={partieUrl} connecter={eq.connecter} />
        </div>
      </>
    );
  }

  const gm = eq.session.role === 'gm';
  const pages = PAGES.filter((x) => gm || !x.gm);
  const courante = pages.find((x) => x.id === page) ?? pages[0]!;
  const aller = (id: string) => {
    setPage(id);
    setMenu(false);
  };
  const p = eq.partie;
  const restant = p ? (CHRONO_TOURNE.has(p.etat) ? p.restantMs - (maintenant - lu) : p.restantMs) : null;

  return (
    <>
      <div className="bg-layer bg-glow" />
      <div className="bg-layer bg-grid" />
      <div className="app-shell">
        <aside className={`sidebar${menu ? ' ouvert' : ''}`}>
          <div className="sidebar__brand">
            <i className="fa-solid fa-hexagon-nodes" aria-hidden="true" /> GREED QUEST
          </div>
          <div className="sidebar__tag">{gm ? 'Game Master' : 'PNJ'}</div>
          <nav className="sidebar__nav">
            {pages.map((x) => (
              <button key={x.id} type="button" className={`nav-item${x.id === courante.id ? ' active' : ''}`} onClick={() => aller(x.id)}>
                <i className={`fa-solid ${x.icone}`} aria-hidden="true" /> {x.titre}
                {x.id === 'alertes' && nonLues > 0 && <span className="badge">{nonLues}</span>}
              </button>
            ))}
          </nav>
          <button type="button" className="sidebar__foot nav-item" onClick={eq.deconnecter}>
            <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" /> Déconnexion
          </button>
        </aside>
        {menu && <div className="modal-overlay show" style={{ zIndex: 20 }} onClick={() => setMenu(false)} />}
        <main className="main">
          <header className="topbar">
            <div className="topbar__greet">
              <div className="eyebrow">{p?.nom ?? 'Greed Quest'}</div>
              <h1>{courante.titre}</h1>
            </div>
            <div className="topbar__actions">
              <button type="button" className="menu-btn" onClick={() => setMenu(true)}>
                <i className="fa-solid fa-bars" aria-hidden="true" /> Menu{nonLues > 0 ? ` (${nonLues})` : ''}
              </button>
              {p && (
                <div className="etat-chip">
                  {libelleEtat(p.etat)}
                  {restant !== null ? ` · ${formatDuree(restant)}` : ''}
                  {eq.j !== null ? ` · J ${eq.j}` : ''}
                </div>
              )}
              <div className={`live-chip${eq.connexion === 'en_ligne' ? '' : ' hors'}`}>
                <span className="dot" /> {eq.connexion === 'en_ligne' ? 'EN DIRECT' : 'HORS LIGNE'}
              </div>
              <div className="admin-chip">
                <span className="avatar">
                  <i className="fa-solid fa-user-shield" aria-hidden="true" />
                </span>
                {eq.session.nom}
              </div>
            </div>
          </header>
          {courante.id === 'dashboard' && <Tableau eq={eq} aller={aller} />}
          {courante.id === 'joueurs' && <Joueurs eq={eq} cible={cible} setCible={setCible} />}
          {courante.id === 'licence' && <Joueur eq={eq} cible={cible} setCible={setCible} />}
          {courante.id === 'evenements' && <Evenements eq={eq} />}
          {courante.id === 'clear' && <Clear eq={eq} />}
          {courante.id === 'checkpoints' && <Checkpoints eq={eq} />}
          {courante.id === 'arene' && <Arene eq={eq} />}
          {courante.id === 'encheres' && <Encheres eq={eq} />}
          {courante.id === 'missions' && <Missions eq={eq} />}
          {courante.id === 'alertes' && <Alertes eq={eq} viserJoueur={(c) => (setCible(c), aller('joueurs'))} />}
          {courante.id === 'journal' && <Journal eq={eq} />}
        </main>
      </div>
    </>
  );
}
