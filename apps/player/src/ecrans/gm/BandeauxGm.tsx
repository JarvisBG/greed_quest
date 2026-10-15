// Bandeaux des cartes de Maître du jeu, sous la barre, sur toutes les pages (comme le bandeau de gel) :
// « Intouchable » (Jugement de Jarvis, noir et or), « Figé » (Jugement subi, givré), « Book scellé » (Sceau d'Ange, rouge).
import { useEffect, useState } from 'react';
import { etatsGmRestants } from '../../lib/cartesGm';
import type { Moi } from '../../lib/useJeu';
import { minSec } from '../sorts/FicheSort';

export function BandeauxGm({ moi }: { moi: Moi | null }) {
  const [, setTic] = useState(0);
  const r = moi ? etatsGmRestants(moi, Date.now()) : null;
  const actif = !!r && (r.fige > 0 || r.scelle > 0 || r.intouchable > 0);
  useEffect(() => {
    if (!actif) return;
    const t = setInterval(() => setTic((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [actif]);
  if (!r || !actif) return null;
  return (
    <div aria-live="polite">
      {r.scelle > 0 && (
        <div className="bandeau-gm scelle" role="status">
          <span>Book scellé par Ange</span>
          <b>{minSec(r.scelle)}</b>
        </div>
      )}
      {r.fige > 0 && (
        <div className="bandeau-gm fige" role="status">
          <span>Figé par le Jugement de Jarvis</span>
          <b>{minSec(r.fige)}</b>
        </div>
      )}
      {r.intouchable > 0 && (
        <div className="bandeau-gm intouchable" role="status">
          <span>Intouchable · Jugement de Jarvis</span>
          <b>{minSec(r.intouchable)}</b>
        </div>
      )}
    </div>
  );
}
