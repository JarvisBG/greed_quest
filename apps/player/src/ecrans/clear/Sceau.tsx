// Page ⑰ : le sceau de cire doré du Clear (« CLEAR · DÉCLARÉ » autour, l'emblème du Book au centre) et le tampon
// doré du récapitulatif des lots (prototype validé : docs/prototype/clear.html).
import { useId } from 'react';

const CIRE = '#5a3d08';

export function Sceau({ bas = 'DÉCLARÉ', className }: { bas?: string; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className={className} viewBox="-60 -60 120 120" aria-hidden="true">
      <defs>
        <radialGradient id={`cire-${id}`} cx="38%" cy="32%" r="70%">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset="0.35" stopColor="#f2cd6a" />
          <stop offset="0.75" stopColor="#b8861f" />
          <stop offset="1" stopColor="#7a5510" />
        </radialGradient>
        <path id={`h-${id}`} d="M-33 0 A33 33 0 0 1 33 0" fill="none" />
        <path id={`b-${id}`} d="M-33 0 A33 33 0 0 0 33 0" fill="none" />
      </defs>
      <path
        d="M0 -56 C14 -58 22 -48 34 -46 C46 -42 46 -30 54 -20 C60 -8 52 4 56 16 C58 30 46 36 40 46 C30 56 18 52 6 58 C-8 62 -16 52 -28 50 C-42 46 -44 34 -52 24 C-60 12 -52 0 -56 -12 C-58 -26 -46 -32 -40 -44 C-30 -54 -14 -54 0 -56 Z"
        fill={`url(#cire-${id})`}
        stroke={CIRE}
        strokeWidth="2"
      />
      <circle r="40" fill="none" stroke="#7a5510" strokeWidth="2.5" />
      <circle r="27" fill="none" stroke="#7a5510" strokeWidth="1.5" />
      <text fill={CIRE} className="cl-sceau-h">
        <textPath href={`#h-${id}`} startOffset="50%" textAnchor="middle">
          CLEAR
        </textPath>
      </text>
      <text fill={CIRE} dy="9" className="cl-sceau-b">
        <textPath href={`#b-${id}`} startOffset="50%" textAnchor="middle">
          {bas}
        </textPath>
      </text>
      <g transform="translate(-14 -14) scale(.28)" stroke={CIRE} fill="none">
        <path d="M36 38c0-6 4-10 10-10h8M36 38v24c0 6 4 10 10 10h8V52h-8" strokeWidth="7" />
        <path d="M64 28v44" strokeWidth="7" />
      </g>
    </svg>
  );
}

/** Tampon doré à l'encre (filtre `mas-encre` de FiltreEncre) : deux lignes, la première en grand. */
export function TamponOr({ lignes }: { lignes: [string, string] }) {
  return (
    <svg viewBox="-90 -36 180 72" aria-hidden="true">
      <g filter="url(#mas-encre)" fill="none" stroke="#b8861f">
        <rect x="-86" y="-32" width="172" height="64" rx="5" strokeWidth="5" />
        <rect x="-78" y="-25" width="156" height="50" rx="2" strokeWidth="1.5" />
        {lignes.map((m, i) => (
          <text
            key={i}
            y={-4 + i * 20}
            textAnchor="middle"
            fill="#b8861f"
            stroke="none"
            className={i ? 'cl-tampon-2' : 'cl-tampon-1'}
            // Un long nom (pseudo, partie) est resserré pour rester dans le cadre.
            {...(m.length > (i ? 20 : 9) ? { textLength: 146, lengthAdjust: 'spacingAndGlyphs' } : {})}
          >
            {m}
          </text>
        ))}
      </g>
    </svg>
  );
}
