// RG-5.4 : hexagone du Nen en couleur, dans l'ordre de l'anime (Renforcement en haut, puis sens des aiguilles d'une montre).
// Les arêtes se tracent, les médaillons apparaissent, celui du joueur grossit et envoie deux ondes (styles : .hexa-nen).
import type { NenType } from '@gq/shared';
import { NENS } from '../../lib/format';

export const ORDRE_NEN: readonly NenType[] = ['renforcement', 'transformation', 'materialisation', 'specialisation', 'manipulation', 'emission'];
const R = 118;

function sommet(i: number): [number, number] {
  const a = -Math.PI / 2 + (i * Math.PI) / 3;
  return [Math.round(Math.cos(a) * R * 10) / 10, Math.round(Math.sin(a) * R * 10) / 10];
}

export function HexagoneNen({ type }: { type: NenType }) {
  const sommets = ORDRE_NEN.map((_, i) => sommet(i));
  const coul = (t: NenType) => `var(--nen-${t})`;
  return (
    <svg className="hexa-nen" viewBox="-180 -168 360 346" role="img" aria-label={`Hexagone du Nen : ${NENS[type].nom}`}>
      <defs>
        <radialGradient id="hexa-fond">
          <stop offset="0" stopColor={coul(type)} stopOpacity="0.45" />
          <stop offset="1" stopColor={coul(type)} stopOpacity="0.04" />
        </radialGradient>
        <filter id="hexa-flou" x="-1" y="-1" width="3" height="3">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        {ORDRE_NEN.map((t, i) => {
          const [x1, y1] = sommets[i]!;
          const [x2, y2] = sommets[(i + 1) % 6]!;
          return (
            <linearGradient key={t} id={`hexa-arete-${i}`} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
              <stop offset="0" stopColor={coul(t)} />
              <stop offset="1" stopColor={coul(ORDRE_NEN[(i + 1) % 6]!)} />
            </linearGradient>
          );
        })}
        {ORDRE_NEN.map((t) => (
          <radialGradient key={t} id={`hexa-medaille-${t}`} cx="0.38" cy="0.32" r="0.75">
            <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="0.28" stopColor={coul(t)} />
            <stop offset="1" stopColor={coul(t)} stopOpacity="0.55" />
          </radialGradient>
        ))}
      </defs>
      <path className="fond" d={`M${sommets.map((p) => p.join(' ')).join('L')}Z`} />
      <text className="centre" textAnchor="middle" y="32">
        念
      </text>
      {sommets.map(([x, y], i) => (
        <line key={i} className="rayon" x1="0" y1="0" x2={x} y2={y} />
      ))}
      {ORDRE_NEN.map((t, i) => {
        const [x1, y1] = sommets[i]!;
        const [x2, y2] = sommets[(i + 1) % 6]!;
        return <path key={t} className="arete" stroke={`url(#hexa-arete-${i})`} d={`M${x1} ${y1}L${x2} ${y2}`} style={{ animationDelay: `${0.1 + i * 0.08}s` }} />;
      })}
      {ORDRE_NEN.map((t, i) => {
        const [x, y] = sommets[i]!;
        const moi = t === type;
        const n = NENS[t];
        return (
          <g key={t} transform={`translate(${x} ${y})`}>
            <g className={`medaille ${moi ? 'moi' : 'autre'}`} style={{ animationDelay: moi ? '0.85s' : `${0.35 + i * 0.07}s, 1.5s` }}>
              {moi && (
                <>
                  <circle className="onde" r="31" />
                  <circle className="onde o2" r="31" />
                  <circle r="40" fill={coul(t)} opacity="0.28" filter="url(#hexa-flou)" />
                </>
              )}
              <circle className="disque" r="29" fill={`url(#hexa-medaille-${t})`} />
              <text className={`k${n.court.length > 2 ? ' long' : ''}`} textAnchor="middle" y="6">
                {n.court}
              </text>
              <text className="n" textAnchor="middle" y="46">
                {n.nom}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
