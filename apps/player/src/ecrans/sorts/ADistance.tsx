// Page ⑨ (prototype validé le 2026-10-12 : docs/prototype/sorts-information.html) : bandeau de la ville ouverte à
// distance par le sort Retour (amendement du 2026-10-10), avec le temps qui reste. Posé au-dessus de la boutique de
// Masadora et des enchères d'Antokiba.
import { useEffect, useState } from 'react';
import { minSec } from './FicheSort';

export function ADistance({ resteMs, recuA }: { resteMs: number; recuA: number }) {
  const [, setTic] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTic((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const reste = Math.max(0, resteMs - Math.max(0, Date.now() - recuA));
  if (reste <= 0) return null;
  return (
    <p className="a-distance" role="status">
      À distance, grâce à Retour <b aria-label={`Temps restant : ${minSec(reste)}`}>{minSec(reste)}</b>
    </p>
  );
}
