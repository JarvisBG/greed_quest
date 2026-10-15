// Page ⑱ : les dessins de la fin de partie et de l'abandon (prototype validé : docs/prototype/fin-partie.html) :
// tampons d'encre rouge (ta place, « ABANDON »), gong de bronze, trait de pinceau qui raye la licence.
// Les tampons utilisent le filtre `mas-encre` de FiltreEncre (à monter une fois dans la page).

const ROUGE = '#c0272d';

/** Filtre du trait de pinceau (bords irréguliers). */
export function FiltrePinceau() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <filter id="fp-pinceau" x="-5%" y="-20%" width="110%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.06 0.5" numOctaves={2} seed={7} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={7} />
        </filter>
        <radialGradient id="fp-bronze" cx="40%" cy="34%" r="72%">
          <stop offset="0" stopColor="#f3c98a" />
          <stop offset="0.3" stopColor="#c98a3c" />
          <stop offset="0.7" stopColor="#8a5420" />
          <stop offset="1" stopColor="#4a2a0e" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** Tampon rouge : « TA PLACE / 7e / SUR 23 », ou « TOI » seul. */
export function TamponPlace({ grand, petit = '', haut = '' }: { grand: string; petit?: string; haut?: string }) {
  const style = (px: number, espace: number) => ({ font: `400 ${px}px var(--f-titre)`, letterSpacing: `${espace}px` });
  return (
    <svg viewBox="-100 -58 200 116" aria-hidden="true">
      <g filter="url(#mas-encre)" fill="none" stroke={ROUGE}>
        <rect x="-94" y="-52" width="188" height="104" rx="8" strokeWidth="7" />
        <rect x="-84" y="-42" width="168" height="84" rx="3" strokeWidth="2" />
        {haut && (
          <text y="-22" textAnchor="middle" fill={ROUGE} stroke="none" style={style(15, 3)}>
            {haut}
          </text>
        )}
        <text y={haut ? 22 : 14} textAnchor="middle" fill={ROUGE} stroke="none" style={style(grand.length > 4 ? 40 : 54, -1)}>
          {grand}
        </text>
        {petit && (
          <text y="38" textAnchor="middle" fill={ROUGE} stroke="none" style={style(14, 2)}>
            {petit}
          </text>
        )}
      </g>
    </svg>
  );
}

/** Tampon long sur une ligne (« ABANDON »). */
export function TamponMot({ mot }: { mot: string }) {
  return (
    <svg viewBox="-100 -34 200 68" aria-hidden="true">
      <g filter="url(#mas-encre)" fill="none" stroke={ROUGE}>
        <rect x="-95" y="-29" width="190" height="58" rx="6" strokeWidth="6" />
        <rect x="-87" y="-21" width="174" height="42" rx="2" strokeWidth="1.8" />
        <text y="12" textAnchor="middle" fill={ROUGE} stroke="none" style={{ font: '400 31px var(--f-titre)', letterSpacing: '1px' }}>
          {mot}
        </text>
      </g>
    </svg>
  );
}

/** Le gong : portique d'encre, cordes, disque de bronze cerclé, bosse au centre. */
export function Gong() {
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <g stroke="#f6f6f2" strokeWidth="7" strokeLinecap="square" fill="none">
        <path d="M22 196V20M178 196V20M10 22h180" />
        <path d="M14 12h172" strokeWidth="5" />
      </g>
      <g className="fp-disque">
        <path d="M70 22 84 52M130 22 116 52" stroke="#f6f6f2" strokeWidth="3" />
        <circle className="fp-centre" cx="100" cy="112" r="64" fill="url(#fp-bronze)" stroke="#1a0f05" strokeWidth="4" />
        <circle cx="100" cy="112" r="54" fill="none" stroke="#4a2a0e" strokeWidth="2.5" opacity=".8" />
        <circle cx="100" cy="112" r="40" fill="none" stroke="#f3c98a" strokeWidth="1.5" opacity=".5" />
        <circle cx="100" cy="112" r="18" fill="#c98a3c" stroke="#4a2a0e" strokeWidth="3" />
        <path d="M91 104c3-4 10-5 14-1" stroke="#fbe2b6" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Ce qui raye la licence après l'abandon : trait de pinceau rouge et tampon. `trace` : le trait est déjà tiré. */
export function Rature({ trace = true }: { trace?: boolean }) {
  return (
    <>
      <svg className="fp-rature" viewBox="0 0 120 112" preserveAspectRatio="none" aria-hidden="true">
        <path
          className="fp-trait"
          d="M8 96 C 40 70, 70 46, 112 14"
          fill="none"
          stroke={ROUGE}
          strokeWidth="9"
          strokeLinecap="round"
          filter="url(#fp-pinceau)"
          pathLength={1}
          strokeDasharray="1"
          strokeDashoffset={trace ? 0 : 1}
        />
      </svg>
      <div className="fp-tampon-abandon" style={trace ? undefined : { opacity: 0 }}>
        <TamponMot mot="ABANDON" />
      </div>
    </>
  );
}
