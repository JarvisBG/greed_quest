// Page ⑩ (décision de Sivraj du 2026-10-12) : pendant Zetsu, un bandeau sous la barre du haut, sur toutes les pages,
// imprimé en trame comme ce qui est éteint, avec le décompte ; il disparaît à la fin (amendement 2026-10-10).
import { useEffect, useState } from 'react';
import type { Moi } from '../../lib/useJeu';
import { minSec } from './FicheSort';

export function BandeauZetsu({ moi }: { moi: Moi }) {
  const [maintenant, setMaintenant] = useState(Date.now());
  const reste = moi.specialisation.zetsu - Math.max(0, maintenant - moi.recuA);
  useEffect(() => {
    if (moi.specialisation.zetsu <= 0) return;
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, [moi.specialisation.zetsu, moi.recuA]);
  if (reste <= 0) return null;
  return (
    <div className="zetsu-bandeau" role="status">
      <span className="mot" aria-hidden="true">
        ZETSU
      </span>
      <span className="dit">
        Tu es invisible
        <small>Un sort offensif ou un échange le rompt</small>
      </span>
      <span className="temps" aria-label={`encore ${minSec(reste)}`}>
        {minSec(reste)}
      </span>
    </div>
  );
}
