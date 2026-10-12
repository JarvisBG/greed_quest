// Page ⑨ : suivi d'Accompagnement (prototype validé par Sivraj le 2026-10-12 : docs/prototype/sorts-information.html).
// Écran clair, lu en marchant au soleil : décompte du gel en gros chiffres, carte de l'île cadrée sur toi et la cible
// (sa position exacte en direct, au seul lanceur, pendant 3 min : amendement du 2026-10-10, dérogation à RG-10.12),
// distance et direction. À la fin, la carte passe en gris et la cible disparaît.
import { useEffect, useMemo, useRef, useState } from 'react';
import { reperage, resteSuivi, type SuiviCible } from '../../lib/accompagnement';
import { cadrageSuivi, construirePlan, resteCadre, type ZoneRecue } from '../../lib/carte';
import { minSec } from './FicheSort';
import { DessinCarte } from '../carte/CarteIle';
import { MarqueCible } from './IleNuit';

interface Props {
  suivi: SuiviCible;
  carte: { zones: ZoneRecue[]; balisesParZone: Record<string, number> } | null;
  maPosition: () => { lat: number; lng: number; precisionM: number } | null;
  onFermer: () => void;
}

export function SuiviAccompagnement({ suivi, carte, maPosition, onFermer }: Props) {
  // Le tic ne fait que redessiner : l'heure est lue à chaque rendu (une position reçue entre deux tics recale `recuA`).
  const [, setTic] = useState(0);
  const maintenant = Date.now();
  const retour = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    retour.current?.focus({ preventScroll: true });
    const t = setInterval(() => setTic((n) => n + 1), 1000);
    const clavier = (e: KeyboardEvent) => e.key === 'Escape' && onFermer();
    addEventListener('keydown', clavier);
    return () => {
      clearInterval(t);
      removeEventListener('keydown', clavier);
    };
  }, [onFermer]);

  const reste = resteSuivi(suivi, maintenant);
  const fini = reste <= 0;
  const moi = maPosition();
  const cleMoi = moi ? `${moi.lat.toFixed(5)},${moi.lng.toFixed(5)}` : '';
  const plan = useMemo(() => (carte ? construirePlan(carte.zones, carte.balisesParZone, moi) : null), [carte, cleMoi]); // eslint-disable-line react-hooks/exhaustive-deps
  const cible = plan && suivi.position && !fini ? plan.projeter(suivi.position) : null;
  const a: [number, number] | null = plan?.moi ? [plan.moi.x, plan.moi.y] : null;

  // La vue ne bouge que si l'un de vous deux approche du bord.
  const vue = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  if (plan) {
    const pts = [a, cible].filter((p): p is [number, number] => p !== null);
    if (pts.length && (!vue.current || !resteCadre(vue.current, ...pts))) vue.current = cadrageSuivi(pts[0]!, pts[1] ?? pts[0]!);
    if (!vue.current) vue.current = { x: 0, y: 0, w: plan.largeur, h: plan.hauteur };
  }
  const v = vue.current;

  return (
    <>
      <div className="suivi-ecran" role="dialog" aria-modal="true" aria-labelledby="suivi-titre">
        <div className="suivi-corps">
          <button ref={retour} className="sorts-fermer" onClick={onFermer}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 5-7 7 7 7" />
            </svg>
            Sorts
          </button>
          <div className={`suivi-gele${fini ? ' fini' : ''}`}>
            <p id="suivi-titre" className="suivi-qui">
              {fini ? `${suivi.pseudo} n’est plus gelé` : `${suivi.pseudo} est gelé`}
              <small>{fini ? 'Le suivi est terminé' : 'Ni scan, ni sort, ni échange'}</small>
            </p>
            <span className="suivi-chrono" aria-label={`Temps restant : ${minSec(reste)}`}>
              {minSec(reste)}
            </span>
          </div>
          {plan && v && plan.zones.length > 0 && (
            <div className={`suivi-carte${fini ? ' fini' : ''}`}>
              <svg viewBox={`${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.w.toFixed(1)} ${v.h.toFixed(1)}`} role="img" aria-label={fini ? 'Carte de l’île' : `Carte : ta position et celle de ${suivi.pseudo}`}>
                <DessinCarte plan={plan} evenements={[]} p="su" comptes={false} />
                {cible && a && (
                  <>
                    <line className="lien-fond" x1={a[0]} y1={a[1]} x2={cible[0]} y2={cible[1]} />
                    <line className="lien-suivi" x1={a[0]} y1={a[1]} x2={cible[0]} y2={cible[1]} />
                  </>
                )}
                {cible && (
                  <g className="cible" style={{ transform: `translate(${cible[0]}px, ${cible[1]}px)` }}>
                    <MarqueCible pseudo={suivi.pseudo} />
                  </g>
                )}
              </svg>
            </div>
          )}
          <p className="suivi-reperage" aria-live="polite">
            {fini ? 'Sa position n’est plus montrée.' : reperage(moi, suivi)}
          </p>
          {!fini && <p className="suivi-note">Sa position se met à jour en direct. Toi seul la vois.</p>}
        </div>
      </div>
      <div className="sorts-pied suivi-pied">
        <button className="gi-btn-encre sorts-agir" onClick={onFermer}>
          Fermer la carte
        </button>
      </div>
    </>
  );
}
