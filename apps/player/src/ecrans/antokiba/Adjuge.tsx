// Page ⑭ : cinématique « ADJUGÉ ! » du gagnant d'une enchère (prototype validé : docs/prototype/antokiba.html).
// La salle s'éteint, le projecteur tombe sur le lot posé sur son socle ; le marteau du commissaire-priseur se lève
// puis s'abat (onde, étincelles, secousse, éclair, vibration), « ADJUGÉ ! » frappé ; la carte s'élève, s'embrase et
// fait un tour sur elle-même, le prix payé dessous. Le jeu le dit ; la jenny n'est débitée qu'ici (seul le gagnant
// paie, RG-11.4). Toucher range la carte dans l'onglet Book (« +1 »). Toucher pendant l'intro passe à la révélation.
import { Carte, CarteNoire, Concentration } from '@gq/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { texteAdjuge, type Adjuge as AdjugeData } from '../../lib/encheres';
import { creerEffets } from '../scan/effets';

const EASE = 'cubic-bezier(.16,1,.3,1)';
type Phase = 'intro' | 'revele' | 'range';
const centre = (el: Element): [number, number] => {
  const b = el.getBoundingClientRect();
  return [b.left + b.width / 2, b.top + b.height / 2];
};
const vibrer = (p: number | number[]) => navigator.vibrate?.(p);
const delai = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

/** Le marteau : tête de bois cerclée de laiton, manche, vu de profil. */
function Marteau() {
  return (
    <svg viewBox="0 0 220 220" aria-hidden="true">
      <defs>
        <linearGradient id="adj-bois" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c58450" />
          <stop offset=".45" stopColor="#8a4e27" />
          <stop offset="1" stopColor="#4a2611" />
        </linearGradient>
        <linearGradient id="adj-laiton" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe7a6" />
          <stop offset=".5" stopColor="#c99a2a" />
          <stop offset="1" stopColor="#7a5a12" />
        </linearGradient>
      </defs>
      <rect x="86" y="70" width="16" height="140" rx="6" fill="url(#adj-bois)" stroke="#1a0d06" strokeWidth="3" transform="rotate(-45 94 140)" />
      <g transform="rotate(-45 110 70)">
        <rect x="40" y="38" width="140" height="64" rx="14" fill="url(#adj-bois)" stroke="#1a0d06" strokeWidth="4" />
        <rect x="58" y="36" width="14" height="68" rx="3" fill="url(#adj-laiton)" stroke="#1a0d06" strokeWidth="2.5" />
        <rect x="148" y="36" width="14" height="68" rx="3" fill="url(#adj-laiton)" stroke="#1a0d06" strokeWidth="2.5" />
      </g>
    </svg>
  );
}

/** « −35 J » sous la jenny de la barre (même bulle que Masadora). */
function flotte(texte: string) {
  const j = document.querySelector('.barre .jenny');
  if (!j) return;
  const f = document.createElement('span');
  f.className = 'mas-flotte perte';
  f.textContent = texte;
  j.append(f);
  f.animate([{ opacity: 0, translate: '0 -6px' }, { opacity: 1, translate: '0 4px', offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0, translate: '0 10px' }], { duration: 1700, easing: 'ease-out' }).finished.finally(() => f.remove());
}

interface Props {
  adjuge: AdjugeData;
  /** Appelé au moment où le jeu dit « Adjugé ! » : la jenny de la barre baisse. */
  onDebit: (jenny: number) => void;
  onFini: () => void;
}

export function Adjuge({ adjuge, onDebit, onFini }: Props) {
  const calme = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches).current;
  const [phase, setPhase] = useState<Phase>('intro');
  const [boite, setBoite] = useState({ texte: '', indice: '' });
  const r = {
    racine: useRef<HTMLDivElement>(null),
    nuit: useRef<HTMLDivElement>(null),
    lignes: useRef<HTMLDivElement>(null),
    projecteur: useRef<HTMLDivElement>(null),
    toile: useRef<HTMLCanvasElement>(null),
    socle: useRef<HTMLDivElement>(null),
    lot: useRef<HTMLDivElement>(null),
    tourne: useRef<HTMLDivElement>(null),
    marteau: useRef<HTMLDivElement>(null),
    cri: useRef<HTMLDivElement>(null),
    prix: useRef<HTMLDivElement>(null),
    flash: useRef<HTMLDivElement>(null),
    dialogue: useRef<HTMLDivElement>(null),
  };
  const ctl = useRef({ saute: false, phase: 'intro' as Phase, revelA: 0, attentes: new Set<() => void>(), toucher: null as null | (() => void) });
  const rappel = useRef({ onFini, onDebit });
  rappel.current = { onFini, onDebit };

  const surToucher = useCallback(() => {
    const c = ctl.current;
    if (c.phase === 'range') return;
    if (c.phase === 'revele' && c.toucher && performance.now() - c.revelA > 350) {
      const t = c.toucher;
      c.toucher = null;
      t();
      return;
    }
    if (c.saute) return;
    c.saute = true;
    [...c.attentes].forEach((f) => f());
  }, []);

  useEffect(() => {
    const clavier = (e: KeyboardEvent) => {
      if (['Enter', ' ', 'Escape'].includes(e.key)) {
        e.preventDefault();
        surToucher();
      }
    };
    addEventListener('keydown', clavier);
    return () => removeEventListener('keydown', clavier);
  }, [surToucher]);

  useEffect(() => {
    let vivant = true;
    const c = ctl.current;
    const el = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.current])) as { [K in keyof typeof r]: NonNullable<(typeof r)[K]['current']> | null };
    const fx = creerEffets(el.toile!, () => new DOMRect(-999, -999, 0, 0));
    const anims: Animation[] = [];
    // L'état final de chaque animation est aussi posé en style (leçon des pages ⑧ et ⑪ : certains téléphones le perdaient).
    const A = (cible: Element | null | undefined, k: Keyframe[], o: KeyframeAnimationOptions & { duration: number }) => {
      if (!cible) return null;
      const vite = calme || c.saute;
      const a = cible.animate(k, { fill: 'both', easing: EASE, ...o, duration: vite ? 1 : o.duration, delay: vite ? 0 : (o.delay ?? 0) });
      anims.push(a);
      const fin = k[k.length - 1]!;
      if (fin.opacity !== undefined && cible instanceof HTMLElement) cible.style.opacity = String(fin.opacity);
      return a;
    };
    const fini = (a: Animation | null) => (a ? a.finished.then(() => undefined, () => undefined) : Promise.resolve());
    const pause = (ms: number) =>
      new Promise<void>((res) => {
        if (c.saute || calme || !vivant) return res();
        const f = () => {
          clearTimeout(t);
          c.attentes.delete(f);
          res();
        };
        const t = setTimeout(f, ms);
        c.attentes.add(f);
      });
    const toucher = () =>
      new Promise<void>((res) => {
        c.toucher = res;
      });
    const mettrePhase = (p: Phase) => {
      c.phase = p;
      setPhase(p);
    };
    const taper = async (t: string) => {
      for (let n = 1; n <= t.length; n++) {
        if (!vivant) return;
        if (calme || c.saute) return setBoite((b) => ({ ...b, texte: t }));
        setBoite((b) => ({ ...b, texte: t.slice(0, n) }));
        await delai(22);
      }
    };
    const effet = (f: () => void) => {
      if (!calme && !c.saute) f();
    };

    void (async () => {
      vibrer([30, 40, 30]);
      // 1. La salle s'éteint ; le projecteur tombe sur le lot posé sur son socle.
      A(el.nuit, [{ opacity: 0 }, { opacity: 1 }], { duration: 320 });
      A(el.projecteur, [{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: 200 });
      A(el.socle, [{ opacity: 0, translate: '-50% 20px' }, { opacity: 1, translate: '-50% 0' }], { duration: 420, delay: 160 });
      A(el.lot, [{ opacity: 0, transform: 'translateY(30px) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 160 });
      await pause(700);
      if (!vivant) return;
      // 2. Le marteau se lève au-dessus du lot…
      const lot = el.lot!;
      const [cx, cy] = centre(lot);
      const mw = el.marteau?.offsetWidth ?? 200;
      const pose = (deg: number) => `translate(${cx - mw * 0.88 + mw * 0.52}px, ${cy - mw * 0.88 - 34}px) rotate(${deg}deg)`;
      A(el.marteau, [{ opacity: 0, transform: pose(-70) }, { opacity: 1, transform: pose(-42) }], { duration: 420, easing: 'cubic-bezier(.2,.8,.3,1)' });
      await pause(520);
      // 3. … et s'abat : onde, secousse, éclair, « ADJUGÉ ! ».
      A(el.marteau, [{ transform: pose(-42) }, { transform: pose(12) }], { duration: 140, easing: 'cubic-bezier(.6,0,1,.6)' });
      await pause(140);
      if (!vivant) return;
      A(el.marteau, [{ transform: pose(12) }, { transform: pose(2) }], { duration: 260, easing: 'cubic-bezier(.3,1.6,.5,1)' });
      A(el.flash, [{ opacity: 0.8 }, { opacity: 0 }], { duration: 320, easing: 'ease-out' });
      const yImpact = cy + lot.offsetHeight / 2;
      effet(() => {
        fx.onde(cx, yImpact, '#ffe2b8', 1.2);
        fx.etincelles(cx, yImpact, 70, '#ffd877', 0.9);
        fx.etincelles(cx, yImpact, 30, '#ffffff', 0.7);
        el.racine?.animate([{ translate: '0 0' }, { translate: '-6px 4px' }, { translate: '5px -3px' }, { translate: '-2px 2px' }, { translate: '0 0' }], { duration: 240 });
      });
      vibrer(120);
      A(el.cri, [{ opacity: 0, scale: 2.4 }, { opacity: 1, scale: 1 }], { duration: 300, easing: 'cubic-bezier(.3,1.5,.5,1)' });
      A(el.lignes, [{ opacity: 0, scale: 1.3 }, { opacity: 0.22, scale: 1 }], { duration: 400 });
      await pause(700);
      if (!vivant) return;
      // 4. Le marteau se retire ; la carte s'élève, s'embrase et tourne une fois sur elle-même ; le prix payé.
      A(el.marteau, [{ opacity: 1, transform: pose(2) }, { opacity: 0, transform: pose(-60) }], { duration: 380 });
      lot.classList.add('embrase');
      A(el.tourne, [{ transform: 'rotateY(0)' }, { transform: 'rotateY(360deg)' }], { duration: 900, easing: 'cubic-bezier(.45,0,.2,1)' });
      A(lot, [{ opacity: 1, transform: 'none' }, { opacity: 1, transform: 'translateY(-14px) scale(1.06)' }], { duration: 900 });
      A(el.prix, [{ opacity: 0, translate: '-50% 14px' }, { opacity: 1, translate: '-50% 0' }], { duration: 420, delay: 600 });
      await pause(1100);
      if (c.saute) anims.forEach((a) => a.finish());
      if (!vivant) return;
      // 5. Le jeu dit ce qui s'est passé ; la jenny ne part que maintenant.
      c.saute = false;
      c.revelA = performance.now();
      mettrePhase('revele');
      rappel.current.onDebit(adjuge.jenny);
      flotte(`−${adjuge.prix} J`);
      A(el.dialogue, [{ opacity: 0, translate: '-50% 20px' }, { opacity: 1, translate: '-50% 0' }], { duration: 300 });
      await taper(texteAdjuge(adjuge.lot.nom, adjuge.prix));
      if (!vivant) return;
      setBoite((b) => ({ ...b, indice: 'Touche pour ranger dans ton Book' }));
      c.revelA = performance.now();
      await toucher();
      // 6. La carte file dans l'onglet Book : « +1 ».
      c.saute = false;
      mettrePhase('range');
      const onglet = document.querySelector('.onglets [data-onglet="livre"]');
      const [bx, by] = onglet ? centre(onglet) : [innerWidth / 2, innerHeight];
      const [x, y] = centre(lot);
      for (const e of [el.dialogue, el.prix, el.cri]) A(e, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      A(el.socle, [{ opacity: 1 }, { opacity: 0 }], { duration: 240 });
      const vol = A(lot, [{ transform: 'translateY(-14px) scale(1.06)', opacity: 1 }, { transform: `translate(${bx - x}px,${by - y}px) scale(.16) rotate(-14deg)`, opacity: 0.2 }], {
        duration: 560,
        easing: 'cubic-bezier(.55,0,.75,.3)',
      });
      A(el.nuit, [{ opacity: 1 }, { opacity: 0 }], { duration: 520, delay: 200 });
      A(el.projecteur, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
      A(el.lignes, [{ opacity: 0.22 }, { opacity: 0 }], { duration: 300 });
      await fini(vol);
      lot.style.opacity = '0';
      if (onglet && !calme) {
        const b = onglet.getBoundingClientRect();
        const plus = document.createElement('span');
        plus.className = 'tirage-plus-un';
        plus.textContent = '+1';
        plus.style.left = `${b.left + b.width / 2}px`;
        plus.style.top = `${b.top - 34}px`;
        document.body.append(plus);
        plus
          .animate([{ opacity: 0, transform: 'translate(-50%, 8px)' }, { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1600, fill: 'forwards' })
          .finished.finally(() => plus.remove());
      }
      vibrer(30);
      await pause(320);
      if (vivant) rappel.current.onFini();
    })();

    return () => {
      vivant = false;
      anims.forEach((a) => a.cancel());
      fx.arreter();
    };
  }, []);

  const carte = adjuge.lot;
  return (
    <div ref={r.racine} className={`lancer adjuge ${phase}`} role="alertdialog" aria-modal="true" aria-label="Adjugé" onPointerDown={surToucher}>
      <div ref={r.nuit} className="lancer-nuit adj-nuit" />
      <div ref={r.lignes} className="lancer-lignes adj-lignes">
        <Concentration graine={29} />
      </div>
      <div ref={r.projecteur} className="adj-projecteur" />
      <canvas ref={r.toile} className="lancer-toile" aria-hidden="true" />
      <div ref={r.socle} className="adj-socle" />
      <div ref={r.lot} className="adj-lot" aria-hidden="true">
        <div ref={r.tourne} className="adj-tourne">
          {carte.gm ? <CarteNoire gm={carte.gm} /> : <Carte genre="designee" numero={carte.numero} nom={carte.nom} rang={carte.rang} limite={carte.limite} texte={carte.texte} />}
        </div>
      </div>
      <div ref={r.marteau} className="adj-marteau">
        <Marteau />
      </div>
      <div ref={r.cri} className="adj-cri" aria-hidden="true">
        ADJUGÉ !
      </div>
      <div ref={r.prix} className="adj-prix" aria-hidden="true">
        {adjuge.prix} J
      </div>
      <div ref={r.flash} className="lancer-flash" />
      <div ref={r.dialogue} className="lancer-dialogue gi-dialogue adj-dialogue" role="status">
        <span className="a-qui">Antokiba</span>
        <p className="a-texte">{boite.texte}</p>
        <p className={`a-indice${boite.indice ? ' visible' : ''}`}>{boite.indice || ' '}</p>
      </div>
      <span className="lancer-passer" aria-hidden="true">
        Touche pour passer
      </span>
    </div>
  );
}
