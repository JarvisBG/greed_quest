// L'île de démonstration de la vitrine : même dessin que la carte des joueurs (@gq/ui/ile), zones inventées.
import { ICONES_ZONE, dessinerIle, type Pt } from '@gq/ui/ile';
import { useMemo } from 'react';

type Type = 'masadora' | 'antokiba' | 'soufrabi' | 'sauvage';
const W = 640;
const centre = (pts: Pt[]): Pt => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
const H = 400;
const BRUT: { id: string; type: Type; nom: string; points: Pt[] }[] = [
  { id: 'masadora', type: 'masadora', nom: 'Masadora', points: [[112, 112], [252, 96], [262, 192], [122, 204]] },
  { id: 'foret', type: 'sauvage', nom: 'Forêt', points: [[252, 96], [400, 84], [410, 182], [262, 192]] },
  { id: 'antokiba', type: 'antokiba', nom: 'Antokiba', points: [[400, 84], [538, 104], [530, 198], [410, 182]] },
  { id: 'plaine', type: 'sauvage', nom: 'Plaine', points: [[122, 204], [262, 192], [272, 318], [134, 306]] },
  { id: 'soufrabi', type: 'soufrabi', nom: 'Soufrabi', points: [[262, 192], [410, 182], [402, 320], [272, 318]] },
  { id: 'marais', type: 'sauvage', nom: 'Marais', points: [[410, 182], [530, 198], [520, 300], [402, 320]] },
];
/** Zones resserrées vers leur centre : des bords communs donneraient des frontières en double. */
const ZONES = BRUT.map((z) => {
  const [cx, cy] = centre(z.points);
  return { ...z, points: z.points.map(([x, y]): Pt => [cx + (x - cx) * 0.84, cy + (y - cy) * 0.84]) };
});
/** Balises posées dans les zones de chasse : allumées (aplat d'encre) ou endormies (trait). */
const BALISES: { x: number; y: number; allumee: boolean }[] = [
  { x: 296, y: 120, allumee: true }, { x: 362, y: 158, allumee: false }, { x: 330, y: 166, allumee: true },
  { x: 166, y: 236, allumee: true }, { x: 214, y: 286, allumee: false }, { x: 160, y: 284, allumee: true },
  { x: 446, y: 222, allumee: true }, { x: 488, y: 270, allumee: true }, { x: 438, y: 288, allumee: false },
];

function Balise({ x, y, allumee }: { x: number; y: number; allumee: boolean }) {
  // Petit QR dessiné : trois repères d'angle et quelques modules.
  return (
    <g transform={`translate(${x - 8} ${y - 8})`} className={`balise${allumee ? ' allumee' : ''}`}>
      <rect width="16" height="16" rx="1.5" className="balise-fond" />
      <path d="M2.5 2.5h4v4h-4zM9.5 2.5h4v4h-4zM2.5 9.5h4v4h-4zM9.5 9.5h2v2h-2zM11.5 11.5h2v2h-2z" className="balise-qr" />
    </g>
  );
}

export function IleDemo() {
  const ile = useMemo(() => dessinerIle(ZONES, W, H), []);
  return (
    <svg className="ile" viewBox={`40 30 ${W - 80} ${H - 60}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label="Exemple de terrain : une île avec trois villes, trois zones de chasse et des balises QR">
      <defs>
        <filter id="plume" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves={2} seed={4} />
          <feDisplacementMap in="SourceGraphic" scale="3" />
        </filter>
        <filter id="lavis" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".045 .06" numOctaves={3} seed={9} result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 1.25" result="a" />
          <feComposite in="SourceGraphic" in2="a" operator="in" />
        </filter>
        <filter id="derive" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency=".013" numOctaves={2} seed={11} />
          <feDisplacementMap in="SourceGraphic" scale="28" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <clipPath id="ile-clip">
          <path d={ile.littoral} />
        </clipPath>
      </defs>
      <rect className="mer-fond" width={W} height={H} />
      {[30, 20, 11].map((w, i) => (
        <g key={w}>
          <path d={ile.littoral} className="cotes-ondes" strokeWidth={w} opacity={0.16 + i * 0.06} />
          <path d={ile.littoral} className="cotes-mer" strokeWidth={w - 1.6} />
        </g>
      ))}
      {ile.vagues.map(([x, y], i) => (
        <path key={i} className="vague" d={`M${(x - 9).toFixed(1)} ${y.toFixed(1)}q4.5 -4 9 0t9 0`} />
      ))}
      {ile.ilots.map(([x, y, s], i) => (
        <ellipse key={i} className="ilot" cx={x} cy={y} rx={s} ry={s * 0.7} filter="url(#plume)" />
      ))}
      <path className="terre" d={ile.littoral} />
      <g clipPath="url(#ile-clip)">
        <g filter="url(#derive)">
          {ZONES.map((z, i) => (
            <g key={z.id} opacity=".62" filter="url(#lavis)">
              <path d={ile.territoires[i]} fill={ile.lavis[i]} stroke={ile.lavis[i]} strokeWidth="1.2" />
            </g>
          ))}
          <path className="frontiere-ombre" d={ile.frontieres} />
          <path className="frontiere" d={ile.frontieres} />
        </g>
      </g>
      <path className="cote" d={ile.littoral} filter="url(#plume)" />
      {BALISES.map((b, i) => (
        <Balise key={i} {...b} />
      ))}
      {ZONES.map((z) => {
        const [x, y] = centre(z.points);
        const ville = z.type !== 'sauvage';
        return (
          <g key={z.id} transform={`translate(${x.toFixed(0)} ${(ville ? y - 8 : y - 30).toFixed(0)})`}>
            {ville && (
              <g className="ville">
                <circle r="14" className="ville-rond" />
                <path d={ICONES_ZONE[z.type]} className="ville-trait" />
              </g>
            )}
            <text className="zone-nom" y={ville ? 32 : 0} textAnchor="middle">
              {z.nom}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
