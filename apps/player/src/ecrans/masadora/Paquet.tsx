// Page ⑬ : le paquet de Masadora (sachet métallisé marine et or, sertis en dents de scie) et les tampons d'encre
// de la boutique (« KRACH −50 % », « VENDU 20 J », « CONTREFAÇON »). Prototype : docs/prototype/masadora.html.
import { EmblemeDos } from '@gq/ui';
import { forwardRef } from 'react';

export const Paquet = forwardRef<HTMLDivElement>(function Paquet(_, ref) {
  return (
    <div ref={ref} className="mas-paquet" aria-hidden="true">
      <div className="serti haut" />
      <div className="corps">
        <span className="marque">MASADORA</span>
        <span className="embleme">
          <EmblemeDos />
        </span>
        <span className="nombre">
          <b>×3</b>
          <span>cartes de sort</span>
        </span>
      </div>
      <div className="serti bas" />
    </div>
  );
});

/** Filtre « encre » des tampons : bord mangé et manques. À poser une fois dans la page. */
export function FiltreEncre() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <filter id="mas-encre" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={4} result="grain" />
          <feDisplacementMap in="SourceGraphic" in2="grain" scale={3.2} result="bord" />
          <feTurbulence type="fractalNoise" baseFrequency="0.22" numOctaves={2} seed={11} result="taches" />
          <feColorMatrix in="taches" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.3 2.2" result="masque" />
          <feComposite in="bord" in2="masque" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}

export function Tampon({ mots, taille = 17 }: { mots: string[]; taille?: number }) {
  return (
    <svg viewBox="-80 -36 160 72" aria-hidden="true">
      <g filter="url(#mas-encre)" fill="none" stroke="#e0463c">
        <rect x="-76" y="-32" width="152" height="64" rx="5" strokeWidth="5" />
        <rect x="-68" y="-25" width="136" height="50" rx="2" strokeWidth="1.5" />
        {mots.map((m, i) => (
          <text
            key={m}
            y={mots.length === 1 ? 7 : -4 + i * 20}
            textAnchor="middle"
            fill="#e0463c"
            stroke="none"
            style={{ font: `400 ${i ? 14 : taille}px 'Dela Gothic One', 'Arial Black', sans-serif`, letterSpacing: '.5px' }}
          >
            {m}
          </text>
        ))}
      </g>
    </svg>
  );
}
