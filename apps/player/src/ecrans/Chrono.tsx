// RG-4 : temps restant de la partie, toujours visible dans la barre du haut (rouge en phase finale, « Terminée » à la fin).
import { useEffect, useState } from 'react';
import { formatChrono, restantAffiche } from '../lib/format';
import type { Partie } from '../lib/useJeu';

export function Chrono({ partie, recueA }: { partie: Partie; recueA: number }) {
  const [maintenant, setMaintenant] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // Page ⑱ : la partie est finie, le chrono s'arrête et le dit.
  if (partie.etat === 'terminee')
    return (
      <span className="chrono fini" role="timer" aria-label="Partie terminée">
        Terminée
      </span>
    );
  const ms = restantAffiche(partie.restantMs, recueA, partie.etat, maintenant);
  const finale = partie.etat === 'phase_finale' || (ms > 0 && ms <= 30 * 60_000 && partie.etat === 'en_cours');
  return (
    <span className={`chrono${finale ? ' finale' : ''}`} role="timer" aria-label={`Temps restant ${formatChrono(ms)}${partie.etat === 'pause' ? ', partie en pause' : ''}`}>
      {partie.etat === 'pause' && <span className="pause">Pause</span>}
      {formatChrono(ms)}
    </span>
  );
}
