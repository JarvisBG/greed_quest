// Raid de la Brigade (RG-12) : remplace le plan tant qu'il dure, avec la barre de vie du boss et les coups en direct.
import { useEffect, useRef, useState } from 'react';
import { mmss } from '../lib/textes';
import type { Raid as R } from '../lib/useEcran';

function Boss() {
  return (
    <svg viewBox="0 0 200 220" aria-hidden="true">
      <path d="M8 220 L22 132 Q30 116 60 112 L140 112 Q170 116 178 132 L192 220 Z" fill="#2b2f37" stroke="#111" strokeWidth="4" strokeLinejoin="round" />
      <path d="M60 112 L84 170 M140 112 L116 170" stroke="#111" strokeWidth="3" fill="none" />
      <path d="M40 150 Q46 132 62 128 M160 150 Q154 132 138 128" stroke="#4a505c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="100" cy="138" r="13" fill="#1b1d22" stroke="#111" strokeWidth="3" />
      <path d="M94 131 V145 M94 131 H101 Q106 131 106 135 Q106 138 101 138 H94 M101 138 Q107 138 107 141.5 Q107 145 101 145 H94" stroke="#e0322b" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
      <rect x="28" y="160" width="112" height="28" rx="13" fill="#3a3f49" stroke="#111" strokeWidth="4" transform="rotate(-8 84 174)" />
      <rect x="60" y="164" width="112" height="28" rx="13" fill="#343943" stroke="#111" strokeWidth="4" transform="rotate(8 116 178)" />
      <circle cx="40" cy="176" r="15" fill="#c98b5e" stroke="#111" strokeWidth="4" />
      <circle cx="162" cy="181" r="15" fill="#b8784c" stroke="#111" strokeWidth="4" />
      <path d="M34 170 Q40 166 46 170 M156 175 Q162 171 168 175" stroke="#111" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M84 98 L86 116 L114 116 L116 98 Z" fill="#b8784c" stroke="#111" strokeWidth="4" strokeLinejoin="round" />
      <path d="M58 30 Q40 10 30 2 Q34 26 54 50 Z" fill="#e9e1cf" stroke="#111" strokeWidth="4" strokeLinejoin="round" />
      <path d="M142 30 Q160 10 170 2 Q166 26 146 50 Z" fill="#e9e1cf" stroke="#111" strokeWidth="4" strokeLinejoin="round" />
      <path d="M56 70 Q56 26 100 24 Q144 26 144 70 L140 96 Q122 108 100 108 Q78 108 60 96 Z" fill="#c98b5e" stroke="#111" strokeWidth="4" strokeLinejoin="round" />
      <path d="M54 66 Q54 22 100 20 Q146 22 146 66 L146 62 Q100 50 54 62 Z" fill="#2b2f37" stroke="#111" strokeWidth="4" strokeLinejoin="round" />
      <path d="M72 34 L80 44 M118 30 L124 40" stroke="#4a505c" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M56 66 L144 66 L144 86 Q100 80 56 86 Z" fill="#141519" stroke="#111" strokeWidth="4" strokeLinejoin="round" />
      <g className="yeux">
        <path d="M68 72 L92 76 L88 81 L70 78 Z" fill="#ff3b30" />
        <path d="M132 72 L108 76 L112 81 L130 78 Z" fill="#ff3b30" />
      </g>
      <g className="croix" stroke="#f1ece2" strokeWidth="3.5" strokeLinecap="round">
        <path d="M72 70 L86 82 M86 70 L72 82" />
        <path d="M114 70 L128 82 M128 70 L114 82" />
      </g>
      <path d="M118 88 L126 104" stroke="#8a5a36" strokeWidth="2.5" strokeLinecap="round" />
      <path className="moue" d="M84 96 Q100 92 116 96" stroke="#111" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Raid({ r, maintenant }: { r: R; maintenant: number }) {
  const boss = useRef<HTMLDivElement>(null);
  const [, setT] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setT((x) => x + 1), 1000);
    return () => clearInterval(i);
  }, []);
  // Chaque coup secoue le boss.
  const dernier = r.coups[0]?.n;
  useEffect(() => {
    const b = boss.current;
    if (!b || dernier === undefined) return;
    b.classList.remove('touche');
    void b.offsetWidth;
    b.classList.add('touche');
  }, [dernier]);
  const k = r.pvMax > 0 ? r.pv / r.pvMax : 0;
  return (
    <div className={`raid${r.montre ? ' on' : ''}${r.vaincu ? ' vaincu' : ''}`}>
      <div className="scene">
        <div className="boss" ref={boss}>
          <Boss />
        </div>
      </div>
      <div className="info">
        <div>
          <h2>Raid de la Brigade</h2>
          <div className="sous">Répondez aux questions des PNJ pour lui retirer des PV.</div>
        </div>
        <div className="pv">
          <div className="pv-barre">
            <u style={{ transform: `scaleX(${k})` }} />
            <i style={{ transform: `scaleX(${k})` }} />
          </div>
          <div className="pv-chiffres">
            <span>
              {r.pv.toLocaleString('fr-FR')} / {r.pvMax.toLocaleString('fr-FR')} PV
            </span>
            <span>{Math.round(k * 100)} %</span>
          </div>
        </div>
        <div className="coups">
          {r.coups.map((c) => (
            <span className="coup" key={c.n}>
              {c.pseudo} <b>−{c.degats}</b>
            </span>
          ))}
        </div>
        <div className="pied">
          <span>
            Temps <b>{mmss(r.finA - maintenant)}</b>
          </span>
          <span>
            Au combat <b>{r.frappeurs}</b>
          </span>
        </div>
      </div>
    </div>
  );
}
