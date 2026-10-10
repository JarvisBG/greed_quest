// Dessin de la carte de l'île (prototype validé le 2026-10-10 : docs/prototype/carte-ile.html) : parchemin, zones
// à l'encre, trame selon le nombre de balises actives (RG-6.5), villes, évènements de zone, ta position (RG-10.12).
// Le même dessin sert à la petite carte de l'accueil et à la carte agrandie.
import type { Plan, TypeZone } from '../../lib/carte';

export interface EvenementZone {
  zoneId: string;
  texte: string;
}

const ICONES: Partial<Record<TypeZone, string>> = {
  masadora: 'M-7 -3h14l-1.5 10h-11z M-4 -3v-2a4 4 0 0 1 8 0v2',
  antokiba: 'M-7 6h8 M-5 2l7-7 4 4-7 7z M2 -3l5 5',
  soufrabi: 'M-7 6h14 M-6 6v-7l6-5 6 5v7 M-2 6v-5h4v5',
};

/** Trames et plume : `p` préfixe les identifiants (deux cartes peuvent être dans la page). */
export function DefsCarte({ p }: { p: string }) {
  return (
    <defs>
      <pattern id={`${p}t1`} width="12" height="12" patternUnits="userSpaceOnUse">
        <circle cx="6" cy="6" r="1" fill="#1b150c" opacity=".55" />
      </pattern>
      <pattern id={`${p}t2`} width="6" height="6" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="3" r="1.35" fill="#1b150c" opacity=".6" />
      </pattern>
      <pattern id={`${p}t3`} width="4.5" height="4.5" patternUnits="userSpaceOnUse">
        <circle cx="2.25" cy="2.25" r="1.75" fill="#1b150c" opacity=".78" />
      </pattern>
      <pattern id={`${p}hachure`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M0 0v7" stroke="#1b150c" strokeWidth="1" opacity=".22" />
      </pattern>
      <filter id={`${p}plume`} x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves={2} seed={4} />
        <feDisplacementMap in="SourceGraphic" scale="3.2" />
      </filter>
    </defs>
  );
}

export function DessinCarte({ plan, evenements, p }: { plan: Plan; evenements: readonly EvenementZone[]; p: string }) {
  return (
    <>
      <DefsCarte p={p} />
      <rect width={plan.largeur} height={plan.hauteur} fill={`url(#${p}hachure)`} opacity=".5" />
      {plan.zones.map((z) => {
        const ev = evenements.find((e) => e.zoneId === z.id);
        const ville = z.type !== 'sauvage';
        const pts = z.points.map((q) => q.join(',')).join(' ');
        const [cx, cy] = z.centre;
        const largeurCompte = z.balises >= 10 ? 26 : 20;
        const largeurEv = ev ? ev.texte.length * 5.6 + 12 : 0;
        return (
          <g key={z.id} className={`zone${ville ? ' zone-ville' : ''}${ev ? ' zone-ev' : ''}`}>
            <polygon className="zone-fond" points={pts} fill={z.niveau ? `url(#${p}t${z.niveau})` : 'none'} />
            <polygon className="zone-forme" points={pts} fill="none" filter={`url(#${p}plume)`} />
            <g transform={`translate(${cx} ${ville ? cy - 14 : cy - 6})`}>
              <g className="zone-label">
                {ICONES[z.type] && (
                  <g transform="translate(0 -14)">
                    <circle r="12" className="ville-rond" />
                    <path d={ICONES[z.type]} className="ville-trait" />
                  </g>
                )}
                <text className="zone-nom" textAnchor="middle" y={ville ? 12 : 0}>
                  {z.nom}
                </text>
                <g className={`zone-compte${z.balises ? '' : ' vide'}`} transform={`translate(0 ${ville ? 22 : 10})`}>
                  <rect x={-largeurCompte / 2} width={largeurCompte} height="18" />
                  <text textAnchor="middle" y="13.5">
                    {z.balises}
                  </text>
                </g>
              </g>
            </g>
            {ev && (
              <g className="ev-etiquette" transform={`translate(${cx - largeurEv / 2} ${z.haut + 6})`}>
                <rect width={largeurEv} height="17" />
                <text x="6" y="12.5">
                  {ev.texte}
                </text>
              </g>
            )}
          </g>
        );
      })}
      {plan.moi && (
        <g transform={`translate(${plan.moi.x} ${plan.moi.y})`}>
          <g className="moi">
            <circle className="moi-halo" r={plan.moi.r} />
            <circle className="moi-point" r="6" />
            <text className="moi-nom" x="10" y="4">
              Toi
            </text>
          </g>
        </g>
      )}
    </>
  );
}
