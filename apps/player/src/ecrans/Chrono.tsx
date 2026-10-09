// RG-4 : temps restant de la partie, toujours visible dans la barre du haut.
import { useEffect, useState } from 'react';
import { formatChrono, restantAffiche } from '../lib/format';
import type { Partie } from '../lib/useJeu';

export function Chrono({ partie, recueA }: { partie: Partie; recueA: number }) {
  const [maintenant, setMaintenant] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = restantAffiche(partie.restantMs, recueA, partie.etat, maintenant);
  const finale = partie.etat === 'phase_finale' || (ms > 0 && ms <= 30 * 60_000 && partie.etat === 'en_cours');
  return (
    <span className={`chrono${finale ? ' finale' : ''}${partie.etat === 'pause' ? ' pause' : ''}`} title="Temps restant">
      {partie.etat === 'pause' ? 'Pause · ' : ''}
      {formatChrono(ms)}
    </span>
  );
}
