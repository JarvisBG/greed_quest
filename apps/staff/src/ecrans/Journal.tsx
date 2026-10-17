// Journal (RG-3.1) : toutes les actions (acteur, action, résultat, motif), en direct, filtrables par joueur,
// par acteur et par type.
import { useMemo, useState } from 'react';
import { heure, libelleAction, libelleLigne, type LigneJournal } from '../lib/format';
import type { Equipe } from '../lib/useEquipe';

type Acteur = 'tous' | LigneJournal['acteurType'];
const ACTEURS: { id: Acteur; libelle: string }[] = [
  { id: 'tous', libelle: 'Tous' },
  { id: 'joueur', libelle: 'Joueurs' },
  { id: 'pnj', libelle: 'PNJ' },
  { id: 'gm', libelle: 'GM' },
  { id: 'systeme', libelle: 'Système' },
];

export function Journal({ eq }: { eq: Equipe }) {
  const [acteur, setActeur] = useState<Acteur>('tous');
  const [action, setAction] = useState('');
  const [joueur, setJoueur] = useState('');
  const actions = useMemo(() => [...new Set(eq.journal.map((l) => l.action))].sort((a, b) => libelleAction(a).localeCompare(libelleAction(b))), [eq.journal]);
  const lignes = eq.journal.filter(
    (l) => (acteur === 'tous' || l.acteurType === acteur) && (!action || l.action === action) && (!joueur || concerne(l, joueur)),
  );

  return (
    <section className="pile">
      <h1>Journal</h1>
      <div className="segments" role="group" aria-label="Acteur">
        {ACTEURS.map((a) => (
          <button key={a.id} type="button" className={`secondaire ${acteur === a.id ? 'choisi' : ''}`} onClick={() => setActeur(a.id)}>
            {a.libelle}
          </button>
        ))}
      </div>
      <div className="segments">
        <label>
          Type
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">Tous les types</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {libelleAction(a)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Joueur
          <select value={joueur} onChange={(e) => setJoueur(e.target.value)}>
            <option value="">Tous les joueurs</option>
            {eq.joueurs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.pseudo}
              </option>
            ))}
          </select>
        </label>
      </div>
      {lignes.length === 0 && <p className="info">Aucune ligne.</p>}
      <ul className="fil">
        {lignes.map((l) => (
          <li key={l.id}>
            <span className="quand">{heure(l.creeLe)}</span> <span className="detail">{libelleLigne(l, eq.nomActeur, eq.pseudos)}</span>
          </li>
        ))}
      </ul>
      <p className="info">Les {eq.journal.length} dernières lignes, mises à jour en direct.</p>
    </section>
  );
}

/** La ligne concerne ce joueur : il en est l'acteur ou il est nommé dans les détails. */
function concerne(l: LigneJournal, joueurId: string): boolean {
  if (l.acteurType === 'joueur' && l.acteurId === joueurId) return true;
  return !!l.details && JSON.stringify(l.details).includes(joueurId);
}
