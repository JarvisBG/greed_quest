// Invocation du Book, à CHAQUE ouverture (décision de Sivraj du 2026-10-10, prototype docs/prototype/book-invocation.html) :
// la planche bascule dans la nuit, « BOOK ! », un cercle d'or s'ouvre et une spirale de lumière s'enroule,
// le Book se dessine en or puis prend sa matière dans un flash, s'ouvre et ses pages défilent. ≈ 3,2 s ; toucher pour passer.
import { Concentration, EmblemeBook } from '@gq/ui';
import { useEffect, useMemo, useRef } from 'react';
import { creerLumiere } from './particules';

export interface PocheApercu {
  numero: string;
  rang: string;
}

const EASE = 'cubic-bezier(.16,1,.3,1)';

export function Invocation({ poches, onFini }: { poches: (PocheApercu | null)[]; onFini: () => void }) {
  const racine = useRef<HTMLDivElement>(null);
  const toile = useRef<HTMLCanvasElement>(null);
  const fini = useRef(false);
  const arret = useRef<() => void>(() => undefined);

  useEffect(() => {
    const inv = racine.current;
    const cv = toile.current;
    if (!inv || !cv) return;
    const $ = (s: string) => inv.querySelector<HTMLElement>(s)!;
    const $$ = (s: string) => [...inv.querySelectorAll<HTMLElement | SVGElement>(s)];
    const lumiere = creerLumiere(cv);
    const anims: Animation[] = [];
    const minuteurs: number[] = [];
    const A = (el: Element, k: Keyframe[], o: KeyframeAnimationOptions) => {
      const a = el.animate(k, { fill: 'forwards', easing: EASE, ...o });
      anims.push(a);
      return a;
    };
    const plus = (ms: number, f: () => void) => minuteurs.push(window.setTimeout(f, ms));
    const finir = () => {
      if (fini.current) return;
      fini.current = true;
      minuteurs.forEach(clearTimeout);
      // Leçon du scanner : toute animation « forwards » est annulée en fin de séquence.
      anims.forEach((a) => a.cancel());
      lumiere.arreter();
      onFini();
    };
    arret.current = finir;
    navigator.vibrate?.([20, 60, 30]);

    const livre = $('.inv-livre');
    const couv = $('.inv-couv');
    const face = $('.inv-face');
    const page = $('.inv-page');
    const contour = $('.inv-contour');
    const feuilles = $$('.inv-feuille');

    // 1. La nuit tombe, lignes de vitesse, cri « BOOK ! » (courbes par étape, easing global linéaire).
    A($('.inv-nuit'), [{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: 'ease-out' });
    A($('.inv-lignes'), [{ opacity: 0, transform: 'scale(1.3)', easing: EASE }, { opacity: 0.85, transform: 'scale(1)', offset: 0.3, easing: 'ease-in' }, { opacity: 0, transform: 'scale(.95)' }], { duration: 1100, easing: 'linear' });
    A(
      $('.inv-cri'),
      [
        { opacity: 0, transform: 'rotate(-8deg) scale(.3)', filter: 'blur(6px)', easing: EASE },
        { opacity: 1, transform: 'rotate(-8deg) scale(1.08)', filter: 'blur(0)', offset: 0.22, easing: 'ease-out' },
        { opacity: 1, transform: 'rotate(-8deg) scale(1)', offset: 0.7, easing: 'ease-in' },
        { opacity: 0, transform: 'rotate(-8deg) scale(1.05) translateY(-20px)' },
      ],
      { duration: 1300, easing: 'linear' },
    );

    // 2. Cercle d'or et spirale de lumière.
    lumiere.spirale(200);
    A(
      $('.inv-cercle'),
      [
        { opacity: 0, transform: 'scale(.4) rotate(-40deg)', easing: EASE },
        { opacity: 1, transform: 'scale(1) rotate(0deg)', offset: 0.45 },
        { opacity: 0.9, transform: 'scale(1.04) rotate(18deg)', offset: 0.85, easing: 'ease-in' },
        { opacity: 0, transform: 'scale(1.25) rotate(26deg)' },
      ],
      { duration: 2100, delay: 150, easing: 'linear' },
    );
    $$('.inv-anneau').forEach((g, i) => A(g, [{ transform: 'rotate(0deg)' }, { transform: `rotate(${(i % 2 ? -1 : 1) * (60 + i * 40)}deg)` }], { duration: 2400, easing: 'linear' }));

    // 3. Le Book se dessine en lumière, puis prend sa matière (flash).
    livre.style.opacity = '0';
    plus(950, () => {
      livre.style.opacity = '';
      A(livre, [{ transform: 'translateY(30px) scale(.85) rotateX(16deg)' }, { transform: 'translateY(0) scale(1) rotateX(6deg)' }], { duration: 900 });
      [face, page, ...feuilles].forEach((el) => A(el, [{ opacity: 0 }, { opacity: 0 }], { duration: 650 }));
      $$('.inv-contour path, .inv-contour circle').forEach((p, i) =>
        A(p, [{ strokeDasharray: '1', strokeDashoffset: 1 }, { strokeDasharray: '1', strokeDashoffset: 0 }], { duration: 620, delay: i * 90, easing: 'ease-in-out' }),
      );
    });
    plus(1650, () => {
      A($('.inv-flash'), [{ opacity: 0.85 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
      [face, page, ...feuilles].forEach((el) => A(el, [{ opacity: 0, filter: 'brightness(2.4) sepia(1)' }, { opacity: 1, filter: 'brightness(1) sepia(0)' }], { duration: 520, easing: 'ease-out' }));
      A(contour, [{ opacity: 1 }, { opacity: 0 }], { duration: 700, easing: 'ease-out' });
      lumiere.eclat(100);
      A(livre, [{ transform: 'translateY(0) scale(1) rotateX(6deg)' }, { transform: 'translateY(-10px) scale(1.02) rotateX(4deg)' }, { transform: 'translateY(0) scale(1) rotateX(5deg)' }], { duration: 900, easing: 'ease-in-out' });
    });

    // 4. La couverture s'ouvre, les pages défilent, le Book se pose ouvert ; la nuit se lève sur la page du Book.
    plus(2150, () => {
      A(livre, [{ transform: 'translateX(0) rotateX(5deg)' }, { transform: 'translateX(calc(var(--l) * 0.5)) rotateX(2deg)' }], { duration: 900 });
      A(couv, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }], { duration: 760, easing: 'cubic-bezier(.45,.05,.2,1)' });
      feuilles.forEach((f, i) => A(f, [{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${-178 + i * 1.5}deg)` }], { duration: 420, delay: 260 + i * 85, easing: 'cubic-bezier(.5,0,.3,1)' }));
    });
    plus(2970, () => {
      A(inv, [{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: 'ease-in' });
    });
    plus(3250, finir);

    return () => {
      minuteurs.forEach(clearTimeout);
      anims.forEach((a) => a.cancel());
      lumiere.arreter();
    };
  }, []);

  return (
    <div className="invocation" ref={racine} onClick={() => arret.current()} role="presentation">
      <div className="inv-nuit" />
      <div className="inv-lignes">
        <Concentration graine={11} />
      </div>
      <canvas className="inv-toile" ref={toile} />
      <Cercle />
      <div className="inv-scene">
        <div className="inv-livre">
          <div className="inv-page">
            {poches.map((p, i) => (p ? <span key={i} className="inv-poche pleine" data-n={p.numero} data-r={p.rang} /> : <span key={i} className="inv-poche" />))}
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="inv-feuille" />
          ))}
          <div className="inv-couv">
            <div className="inv-face">
              <EmblemeBook />
              <strong>BOOK</strong>
            </div>
            <div className="inv-dos" />
          </div>
          <svg className="inv-contour" viewBox="0 0 100 135" preserveAspectRatio="none" aria-hidden="true">
            <path pathLength="1" d="M3 2H92Q98 2 98 8V127Q98 133 92 133H3Z" />
            <path pathLength="1" d="M10 9H90V126H10Z" strokeWidth="1.2" />
            <circle pathLength="1" cx="50" cy="52" r="20" />
          </svg>
        </div>
      </div>
      <div className="inv-cri" aria-hidden="true">
        BOOK !
      </div>
      <div className="inv-flash" />
      <span className="inv-passer">Touche pour passer</span>
    </div>
  );
}

/** Cercle d'invocation : anneaux, graduations, losanges, double triangle. */
function Cercle() {
  const graduations = useMemo(
    () =>
      Array.from({ length: 72 }, (_, i) => {
        const a = (i / 72) * Math.PI * 2;
        const l = i % 6 === 0 ? 7 : 3;
        return `M${(Math.cos(a) * 86).toFixed(2)} ${(Math.sin(a) * 86).toFixed(2)}L${(Math.cos(a) * (86 - l)).toFixed(2)} ${(Math.sin(a) * (86 - l)).toFixed(2)}`;
      }).join(''),
    [],
  );
  const losanges = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        const x = Math.cos(a) * 68;
        const y = Math.sin(a) * 68;
        return `M${x.toFixed(2)} ${(y - 6).toFixed(2)}L${(x + 4).toFixed(2)} ${y.toFixed(2)}L${x.toFixed(2)} ${(y + 6).toFixed(2)}L${(x - 4).toFixed(2)} ${y.toFixed(2)}Z`;
      }).join(''),
    [],
  );
  return (
    <svg className="inv-cercle" viewBox="-100 -100 200 200" aria-hidden="true">
      <g className="inv-anneau">
        <circle r="92" strokeWidth="1.6" />
        <circle r="86" strokeWidth="0.8" />
        <path d={graduations} strokeWidth="0.8" />
      </g>
      <g className="inv-anneau">
        <circle r="68" strokeWidth="1.2" strokeDasharray="2 4" />
        <path d={losanges} strokeWidth="1" />
      </g>
      <g className="inv-anneau">
        <path d="M0 -58L50.2 29L-50.2 29Z" strokeWidth="0.9" />
        <path d="M0 58L50.2 -29L-50.2 -29Z" strokeWidth="0.9" />
        <circle r="58" strokeWidth="0.7" />
      </g>
    </svg>
  );
}
