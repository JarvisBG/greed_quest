// Page ⑨ (prototype validé par Sivraj le 2026-10-12 : docs/prototype/sorts-information.html) : la carte de l'île
// déroulée dans la nuit du lancer. Trace : la zone s'allume, des pas d'encre la traversent (« il y a 3 min »).
// Guide : la zone s'allume (la colonne de lumière est dessinée par Lancer). Accompagnement : la cible épinglée,
// prise dans le givre, reliée à toi (position exacte au seul lanceur, amendement du 2026-10-10). Retour : la ville.
import { forwardRef } from 'react';
import type { Plan } from '../../lib/carte';
import { DessinCarte } from '../carte/CarteIle';

export interface VueIle {
  /** Zone qui s'allume. */
  zoneId: string | null;
  trace: { pas: { x: number; y: number; angle: number; cote: 1 | -1 }[]; etiquette: [number, number]; texte: string | null } | null;
  cible: { x: number; y: number; pseudo: string } | null;
}

// Une empreinte de pied (pointe vers le haut) : la plante et trois orteils.
const PAS = 'M0-5.5c2.4 0 3.4 2.4 3 5.2-.3 2-.3 3.2.1 4.8.5 2.2-.5 3.8-2.6 3.8S-2.9 6.7-2.4 4.5c.4-1.6.3-2.8 0-4.8C-3.3-3.1-2.4-5.5 0-5.5zM-2.5-8.5a1.15 1.15 0 1 0 .01 0zM0-9.7a1.25 1.25 0 1 0 .01 0zM2.4-8.7a1.1 1.1 0 1 0 .01 0z';
// Givre autour de la cible gelée : six branches à barbes.
export const GIVRE_CIBLE = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i - Math.PI / 2;
  const P = (r: number, da = 0) => `${(Math.cos(a + da) * r).toFixed(1)} ${(Math.sin(a + da) * r).toFixed(1)}`;
  return `M${P(9)}L${P(22)}M${P(15)}L${P(19.5, 0.32)}M${P(15)}L${P(19.5, -0.32)}`;
});

/** La cible d'Accompagnement : point d'encre, anneau et givre, son pseudo. */
export function MarqueCible({ pseudo, givre = true }: { pseudo: string; givre?: boolean }) {
  return (
    <>
      <circle className="cible-anneau" r="17" />
      {givre && (
        <g className="cible-givre">
          {GIVRE_CIBLE.map((d) => (
            <path key={d} pathLength={1} d={d} />
          ))}
        </g>
      )}
      <circle className="cible-point" r="6.5" />
      <text className="cible-nom" x="12" y="-10">
        {pseudo}
      </text>
    </>
  );
}

export const IleNuit = forwardRef<HTMLDivElement, { plan: Plan; vue: VueIle | null }>(function IleNuit({ plan, vue }, ref) {
  const zone = vue?.zoneId ? plan.zones.find((z) => z.id === vue.zoneId) : undefined;
  const pts = zone?.points.map((q) => q.join(',')).join(' ');
  const t = vue?.trace;
  const largeurEtiquette = t?.texte ? t.texte.length * 6.6 + 14 : 0;
  return (
    <div ref={ref} className="lancer-ile" style={{ aspectRatio: `${plan.largeur} / ${plan.hauteur}`, ['--ratio' as string]: (plan.largeur / plan.hauteur).toFixed(4) }} aria-hidden="true">
      <div className="lancer-ile-feuille">
        <svg viewBox={`0 0 ${plan.largeur} ${plan.hauteur}`}>
          <DessinCarte plan={plan} evenements={[]} p="ln" comptes={false} />
          {pts && (
            <g className="ile-zone">
              <polygon className="zone-halo" points={pts} />
              <polygon className="zone-eclat" points={pts} />
            </g>
          )}
          {t?.pas.map((p, i) => (
            <g key={i} className="pas" transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.angle.toFixed(0)}) scale(${p.cote} 1) scale(1.9)`}>
              <path d={PAS} />
            </g>
          ))}
          {t?.texte && (
            <g className="pas-etiquette" transform={`translate(${Math.min(Math.max(4, t.etiquette[0]), plan.largeur - largeurEtiquette - 4).toFixed(1)} ${Math.min(t.etiquette[1], plan.hauteur - 24).toFixed(1)})`}>
              <rect width={largeurEtiquette.toFixed(0)} height="20" />
              <text x="7" y="14">
                {t.texte}
              </text>
            </g>
          )}
          {vue?.cible && plan.moi && (
            <g className="ile-lien">
              <line className="lien-fond" x1={plan.moi.x} y1={plan.moi.y} x2={vue.cible.x} y2={vue.cible.y} />
              <line className="lien-suivi" x1={plan.moi.x} y1={plan.moi.y} x2={vue.cible.x} y2={vue.cible.y} />
            </g>
          )}
          {vue?.cible && (
            <g className="cible" transform={`translate(${vue.cible.x.toFixed(1)} ${vue.cible.y.toFixed(1)})`}>
              <MarqueCible pseudo={vue.cible.pseudo} />
            </g>
          )}
        </svg>
      </div>
      <div className="lancer-ile-rouleau g" />
      <div className="lancer-ile-rouleau d" />
    </div>
  );
});
