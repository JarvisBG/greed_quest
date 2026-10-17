// Barre permanente (§ 4.1) : partie, état (RG-4), chrono, J, connexion, membre connecté.
import { useEffect, useMemo, useState } from 'react';
import { formatDuree, libelleEtat } from '../lib/format';
import type { Equipe } from '../lib/useEquipe';

/** Le chrono ne tourne que pendant le jeu (RG-4.4 : arrêté en pause). */
const CHRONO_TOURNE = new Set(['en_cours', 'phase_finale']);

export function Barre({ eq }: { eq: Equipe }) {
  const p = eq.partie;
  const lu = useMemo(() => Date.now(), [p]);
  const [maintenant, setMaintenant] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const restant = p ? (CHRONO_TOURNE.has(p.etat) ? p.restantMs - (maintenant - lu) : p.restantMs) : null;
  const s = eq.session!;
  const connexion = { en_ligne: 'En ligne', connexion: 'Connexion…', hors_ligne: 'Hors ligne' }[eq.connexion];

  return (
    <header className="barre">
      <span className="titre">{p?.nom ?? 'Greed Quest'}</span>
      <span className="moi">
        <strong>{s.nom}</strong> · {s.role === 'gm' ? 'GM' : 'PNJ'}
      </span>
      <span className="etat">
        {p && <span>{libelleEtat(p.etat)}{p.inscriptionsOuvertes && p.etat !== 'inscriptions' ? ' · inscriptions ouvertes' : ''}</span>}
        {restant !== null && <span className="chrono">{formatDuree(restant)}</span>}
        {eq.j !== null && <span>J = {eq.j}</span>}
        <span>
          <span className={`pastille ${eq.connexion}`} aria-hidden="true" /> {connexion}
        </span>
      </span>
      <button type="button" className="lien moi" onClick={eq.deconnecter}>
        Se déconnecter
      </button>
    </header>
  );
}
