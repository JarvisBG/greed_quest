// Page ⑮ : la défaite à l'arène, un court moment sans humilier (prototype validé le 2026-10-12).
// Voile sombre, tampon « DÉFAITE » de travers, la mise s'effrite lettre par lettre (elle était déjà payée à
// l'entrée), « Reviens dans 14:57 » qui décompte. Environ 3 s, toucher pour fermer.
import { useEffect, useRef, useState } from 'react';
import { minSecArene, type IssueArene } from '../../lib/arene';

const vibrer = (p: number | number[]) => navigator.vibrate?.(p);

export function Defaite({ issue, onFini }: { issue: Extract<IssueArene, { etat: 'perdue' }>; onFini: () => void }) {
  const effrite = useRef<HTMLDivElement>(null);
  const [, tic] = useState(0);
  const fin = useRef(onFini);
  fin.current = onFini;
  useEffect(() => {
    const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;
    vibrer([60, 50, 60]);
    // La mise s'effrite, lettre par lettre.
    const lettres = [...(effrite.current?.children ?? [])] as HTMLElement[];
    if (calme) {
      if (effrite.current) effrite.current.style.opacity = '0.3';
    } else
      lettres.forEach((s, i) =>
        s.animate(
          [
            { translate: '0 0', rotate: '0deg', opacity: 1, filter: 'blur(0)' },
            { translate: `${(i - 2) * 6}px 46px`, rotate: `${(i % 2 ? 1 : -1) * (20 + i * 9)}deg`, opacity: 0, filter: 'blur(1.5px)' },
          ],
          { duration: 900, delay: 500 + i * 70, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' },
        ),
      );
    const t = setInterval(() => tic((n) => n + 1), 1000);
    const ferme = setTimeout(() => fin.current(), 3200);
    const clavier = (e: KeyboardEvent) => {
      if (['Enter', ' ', 'Escape'].includes(e.key)) {
        e.preventDefault();
        fin.current();
      }
    };
    addEventListener('keydown', clavier);
    return () => {
      clearInterval(t);
      clearTimeout(ferme);
      removeEventListener('keydown', clavier);
    };
  }, []);
  const reste = (issue.prochaineDansMs ?? 0) - (Date.now() - issue.recuA);
  return (
    <div className="ar-defaite" role="status" onClick={() => fin.current()}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter id="ar-encre" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={4} result="grain" />
            <feDisplacementMap in="SourceGraphic" in2="grain" scale={3.2} result="bord" />
            <feTurbulence type="fractalNoise" baseFrequency="0.22" numOctaves={2} seed={11} result="taches" />
            <feColorMatrix in="taches" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.3 2.2" result="masque" />
            <feComposite in="bord" in2="masque" operator="in" />
          </filter>
        </defs>
      </svg>
      <div className="tampon" aria-hidden="true">
        <svg viewBox="-80 -36 160 72">
          <g filter="url(#ar-encre)" fill="none" stroke="#e0463c">
            <rect x="-76" y="-32" width="152" height="64" rx="5" strokeWidth="5" />
            <rect x="-68" y="-25" width="136" height="50" rx="2" strokeWidth="1.5" />
            <text y="8" textAnchor="middle" fill="#e0463c" stroke="none" style={{ font: "400 24px 'Dela Gothic One', 'Arial Black', sans-serif", letterSpacing: '.5px' }}>
              DÉFAITE
            </text>
          </g>
        </svg>
      </div>
      <div className="effrite" ref={effrite} aria-label={`moins ${issue.mise} jenny`}>
        {[...`−${issue.mise} J`].map((ch, i) => (
          <span key={i}>{ch === ' ' ? ' ' : ch}</span>
        ))}
      </div>
      <p className="deja">Ta mise était déjà payée.</p>
      {reste > 0 && (
        <div className="revenir">
          <span>Reviens dans</span>
          <b>{minSecArene(reste)}</b>
        </div>
      )}
      <small>Touche pour fermer</small>
    </div>
  );
}
