// Page ⑮ : cinématique « VICTOIRE ! » de l'arène (prototype validé le 2026-10-12 : docs/prototype/arene.html).
// L'arène s'assombrit ; le bras de l'arbitre se lève (éclair, onde, secousse), « VICTOIRE ! » frappé ; trois sceaux
// A · S · SS apparaissent, la lumière passe de l'un à l'autre en ralentissant et s'arrête sur le rang gagné (SS :
// éclat doré) ; la carte jaillit du sceau de dos et se retourne. Le jeu le dit ; toucher la range dans l'onglet Book
// (« +1 »). Repli en jenny (A, S et SS épuisés, RG-8.3) : pas de sceau, le jeu dit ce qui est remis.
// Leçon du prototype : la carte est un élément neuf à chaque victoire (clé React), et ses animations sont lâchées
// une fois retournée, sinon Chromium peut garder l'image du dos.
import { Carte, Concentration, DosCarte } from '@gq/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { pasDeLumiere, RANGS_ARENE, texteVictoire, type IssueArene } from '../../lib/arene';
import { creerEffets } from '../scan/effets';

const EASE = 'cubic-bezier(.16,1,.3,1)';
type Phase = 'intro' | 'revele' | 'range';
const centre = (el: Element): [number, number] => {
  const b = el.getBoundingClientRect();
  return [b.left + b.width / 2, b.top + b.height / 2];
};
const vibrer = (p: number | number[]) => navigator.vibrate?.(p);
const delai = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
const COULEUR: Record<string, string> = { A: '#f2b48a', S: '#e9eef5', SS: '#ffd877' };

/** Le bras de l'arbitre : manche rayée noir et blanc, poing serré, levé vers le ciel. */
function Bras() {
  return (
    <svg viewBox="0 0 100 300" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <defs>
        <pattern id="ar-rayures" width="100" height="26" patternUnits="userSpaceOnUse">
          <rect width="100" height="13" fill="#111" />
          <rect y="13" width="100" height="13" fill="#f3ead2" />
        </pattern>
        <linearGradient id="ar-peau" x1="0" x2="1">
          <stop offset="0" stopColor="#c98b5e" />
          <stop offset=".5" stopColor="#eab489" />
          <stop offset="1" stopColor="#b8784c" />
        </linearGradient>
      </defs>
      <path d="M30 300 L34 118 Q50 108 66 118 L70 300 Z" fill="url(#ar-rayures)" stroke="#111" strokeWidth="4" />
      <path d="M36 122 L38 86 Q50 80 62 86 L64 122 Q50 128 36 122 Z" fill="url(#ar-peau)" stroke="#111" strokeWidth="4" />
      <rect x="24" y="30" width="52" height="60" rx="16" fill="url(#ar-peau)" stroke="#111" strokeWidth="4" />
      <path d="M37 30 V52 M50 30 V52 M63 30 V52" stroke="#111" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 60 Q16 58 18 72 Q22 84 34 80" fill="url(#ar-peau)" stroke="#111" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  );
}

interface Props {
  issue: Extract<IssueArene, { etat: 'gagnee' }>;
  onFini: () => void;
}

export function Victoire({ issue, onFini }: Props) {
  const calme = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches).current;
  const gain = issue.gain;
  const carte = gain.kind === 'carte' ? gain : null;
  const [phase, setPhase] = useState<Phase>('intro');
  const [face, setFace] = useState(false);
  const [boite, setBoite] = useState({ texte: '', indice: '' });
  const [lumiere, setLumiere] = useState<{ allume: number | null; gagne: number | null }>({ allume: null, gagne: null });
  const r = {
    racine: useRef<HTMLDivElement>(null),
    nuit: useRef<HTMLDivElement>(null),
    lignes: useRef<HTMLDivElement>(null),
    toile: useRef<HTMLCanvasElement>(null),
    bras: useRef<HTMLDivElement>(null),
    cri: useRef<HTMLDivElement>(null),
    carte: useRef<HTMLDivElement>(null),
    tourne: useRef<HTMLDivElement>(null),
    sceaux: useRef<HTMLDivElement>(null),
    flash: useRef<HTMLDivElement>(null),
    dialogue: useRef<HTMLDivElement>(null),
  };
  const ctl = useRef({ saute: false, phase: 'intro' as Phase, revelA: 0, attentes: new Set<() => void>(), toucher: null as null | (() => void) });
  const rappel = useRef({ onFini });
  rappel.current = { onFini };

  const surToucher = useCallback(() => {
    const c = ctl.current;
    if (c.phase === 'intro') {
      if (c.saute) return;
      c.saute = true;
      [...c.attentes].forEach((f) => f());
    } else if (c.phase === 'revele' && c.toucher && performance.now() - c.revelA > 350) {
      const t = c.toucher;
      c.toucher = null;
      t();
    } else if (c.phase === 'revele' && !c.toucher) c.saute = true;
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
    // L'état final est aussi posé en style (leçon des pages ⑧ et ⑪ : certains téléphones le perdaient).
    const A = (cible: Element | null, k: Keyframe[], o: KeyframeAnimationOptions & { duration: number }) => {
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
    const sceaux = () => [...(el.sceaux?.querySelectorAll<HTMLElement>('.sc') ?? [])];

    void (async () => {
      vibrer([30, 40, 30]);
      // 1. L'arène s'assombrit.
      A(el.nuit, [{ opacity: 0 }, { opacity: 1 }], { duration: 320 });
      await pause(300);
      if (!vivant) return;
      // 2. Le bras de l'arbitre se lève…
      A(el.bras, [{ opacity: 1, transform: 'translateY(40%) rotate(-62deg)' }, { opacity: 1, transform: 'translateY(0) rotate(0deg)' }], { duration: 560, easing: 'cubic-bezier(.3,1.35,.5,1)' });
      await pause(520);
      if (!vivant) return;
      // 3. … « VICTOIRE ! » : éclair, onde, secousse.
      const b = el.bras!.getBoundingClientRect();
      const px = b.left + b.width / 2;
      const py = b.top + b.height * 0.18;
      A(el.flash, [{ opacity: 0.75 }, { opacity: 0 }], { duration: 320, easing: 'ease-out' });
      effet(() => {
        fx.onde(px, py, '#ffe2b8', 1.2);
        fx.etincelles(px, py, 60, '#ffd877', 0.9);
        fx.etincelles(px, py, 24, '#ffffff', 0.7);
        try {
          el.racine?.animate([{ translate: '0 0' }, { translate: '-6px 4px' }, { translate: '5px -3px' }, { translate: '-2px 2px' }, { translate: '0 0' }], { duration: 240 });
        } catch {
          // La secousse est un bonus.
        }
      });
      vibrer(120);
      A(el.cri, [{ opacity: 0, scale: 2.4 }, { opacity: 1, scale: 1 }], { duration: 300, easing: 'cubic-bezier(.3,1.5,.5,1)' });
      A(el.lignes, [{ opacity: 0, scale: 1.3 }, { opacity: 0.22, scale: 1 }], { duration: 400 });
      await pause(900);
      if (!vivant) return;
      // 4. Le bras redescend ; les trois sceaux A · S · SS apparaissent (une carte seulement).
      A(el.bras, [{ opacity: 1, transform: 'translateY(0) rotate(0deg)' }, { opacity: 0, transform: 'translateY(60%) rotate(-20deg)' }], { duration: 420, easing: 'cubic-bezier(.5,0,.8,.4)' });
      if (carte) {
        sceaux().forEach((s, i) => A(s, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: 120 + i * 90, easing: 'cubic-bezier(.3,1.6,.5,1)' }));
        await pause(520);
        // 5. Suspense : la lumière passe d'un sceau à l'autre en ralentissant, puis s'arrête sur le rang gagné.
        const cible = Math.max(0, RANGS_ARENE.indexOf(carte.rang));
        const pas = pasDeLumiere(carte.rang);
        for (let k = 0; k <= pas; k++) {
          if (c.saute || !vivant) break;
          setLumiere({ allume: k % 3, gagne: null });
          vibrer(8);
          await pause(70 + Math.pow(k / pas, 2.2) * 360);
        }
        if (!vivant) return;
        setLumiere({ allume: null, gagne: cible });
        const sc = sceaux()[cible];
        const [sx, sy] = sc ? centre(sc) : [innerWidth / 2, innerHeight * 0.7];
        vibrer(carte.rang === 'SS' ? [80, 40, 160] : 90);
        effet(() => {
          fx.onde(sx, sy, COULEUR[carte.rang] ?? '#ffd877', carte.rang === 'SS' ? 1.8 : 1);
          fx.etincelles(sx, sy, carte.rang === 'SS' ? 150 : carte.rang === 'S' ? 80 : 50, COULEUR[carte.rang] ?? '#ffd877', carte.rang === 'SS' ? 1.2 : 0.9);
          if (carte.rang === 'SS') fx.etincelles(sx, sy, 60, '#ffffff', 1.1);
        });
        if (carte.rang === 'SS') A(el.flash, [{ opacity: 0.85 }, { opacity: 0 }], { duration: 600, easing: 'ease-out' });
        await pause(380);
        if (!vivant) return;
        // 6. La carte jaillit du sceau (de dos), monte au centre et se retourne.
        const [cx, cy] = centre(el.carte!);
        const jaillit = A(el.carte, [{ opacity: 0, transform: `translate(${sx - cx}px, ${sy - cy}px) scale(.25)` }, { opacity: 1, transform: 'none' }], { duration: 560, easing: 'cubic-bezier(.2,1.2,.4,1)' });
        await fini(jaillit);
        await pause(160);
        const r1 = A(el.tourne, [{ transform: 'perspective(1100px) rotateY(0)' }, { transform: 'perspective(1100px) rotateY(90deg)' }], { duration: 220, easing: 'cubic-bezier(.5,0,1,1)' });
        await fini(r1);
        if (!vivant) return;
        setFace(true);
        const r2 = A(el.tourne, [{ transform: 'perspective(1100px) rotateY(-90deg)' }, { transform: 'perspective(1100px) rotateY(0)' }], { duration: 320, easing: 'cubic-bezier(0,0,.3,1.3)' });
        // La carte revient à plat : ses animations sont lâchées (sinon l'image du dos peut rester).
        void fini(r2).then(() => [jaillit, r1, r2].forEach((a) => a?.cancel()));
        if (el.carte) el.carte.style.opacity = '1';
        effet(() => fx.etincelles(cx, cy, carte.rang === 'SS' ? 90 : 40, COULEUR[carte.rang] ?? '#ffd877', 0.8));
        vibrer(40);
        await pause(500);
      } else await pause(300);
      if (!vivant) return;
      // 7. Le jeu dit ce qui s'est passé.
      c.saute = false;
      c.revelA = performance.now();
      mettrePhase('revele');
      A(el.dialogue, [{ opacity: 0, translate: '-50% 20px' }, { opacity: 1, translate: '-50% 0' }], { duration: 300 });
      await taper(texteVictoire(gain));
      if (!vivant) return;
      setBoite((x) => ({ ...x, indice: carte ? 'Touche pour ranger dans ton Book' : 'Touche pour fermer' }));
      c.revelA = performance.now();
      await toucher();
      // 8. La carte file dans l'onglet Book : « +1 ».
      c.saute = false;
      mettrePhase('range');
      const onglet = document.querySelector('.onglets [data-onglet="livre"]');
      const [bx, by] = onglet ? centre(onglet) : [innerWidth / 2, innerHeight];
      for (const e of [el.dialogue, el.cri]) A(e, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      sceaux().forEach((s) => A(s, [{ opacity: 1 }, { opacity: 0 }], { duration: 220 }));
      let vol: Animation | null = null;
      if (carte && el.carte) {
        const [x, y] = centre(el.carte);
        vol = A(el.carte, [{ transform: 'none', opacity: 1 }, { transform: `translate(${bx - x}px,${by - y}px) scale(.16) rotate(-14deg)`, opacity: 0.2 }], { duration: 560, easing: 'cubic-bezier(.55,0,.75,.3)' });
      }
      A(el.nuit, [{ opacity: 1 }, { opacity: 0 }], { duration: 520, delay: 200 });
      A(el.lignes, [{ opacity: 0.22 }, { opacity: 0 }], { duration: 300 });
      await fini(vol);
      if (el.carte) el.carte.style.opacity = '0';
      if (carte && onglet && !calme) {
        const ob = onglet.getBoundingClientRect();
        const plus = document.createElement('span');
        plus.className = 'tirage-plus-un';
        plus.textContent = '+1';
        plus.style.left = `${ob.left + ob.width / 2}px`;
        plus.style.top = `${ob.top - 34}px`;
        document.body.append(plus);
        plus
          .animate([{ opacity: 0, transform: 'translate(-50%, 8px)' }, { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1600, fill: 'forwards' })
          .finished.finally(() => plus.remove());
        vibrer(30);
      }
      await pause(320);
      if (vivant) rappel.current.onFini();
    })();

    return () => {
      vivant = false;
      anims.forEach((a) => a.cancel());
      fx.arreter();
    };
  }, []);

  return (
    <div ref={r.racine} className={`lancer ar-victoire ${phase}`} role="alertdialog" aria-modal="true" aria-label="Victoire à l’arène" onPointerDown={surToucher}>
      <div ref={r.nuit} className="lancer-nuit ar-nuit" />
      <div ref={r.lignes} className="lancer-lignes ar-lignes">
        <Concentration graine={29} />
      </div>
      <canvas ref={r.toile} className="lancer-toile" aria-hidden="true" />
      <div ref={r.bras} className="ar-bras">
        <Bras />
      </div>
      <div ref={r.cri} className="ar-cri" aria-hidden="true">
        VICTOIRE !
      </div>
      {carte && (
        <div ref={r.carte} className={`ar-carte${face ? ` brille-${carte.rang}` : ''}`} aria-hidden="true">
          <div ref={r.tourne}>{face ? <Carte genre="designee" numero={carte.numero} nom={carte.nom} rang={carte.rang} limite={carte.limite} texte={carte.texte} /> : <DosCarte />}</div>
        </div>
      )}
      {carte && (
        <div ref={r.sceaux} className="ar-sceaux" aria-hidden="true">
          {RANGS_ARENE.map((rg, i) => (
            <i key={rg} className={`sc r-${rg}${lumiere.allume === i ? ' allume' : ''}${lumiere.gagne === i ? ' gagne' : ''}${lumiere.gagne !== null && lumiere.gagne !== i ? ' eteint' : ''}`}>
              {rg}
            </i>
          ))}
        </div>
      )}
      <div ref={r.flash} className={`lancer-flash${carte?.rang === 'SS' ? ' ar-or' : ''}`} />
      <div ref={r.dialogue} className="lancer-dialogue gi-dialogue ar-dialogue" role="status">
        <span className="a-qui">Soufrabi</span>
        <p className="a-texte">{boite.texte}</p>
        <p className={`a-indice${boite.indice ? ' visible' : ''}`}>{boite.indice || ' '}</p>
      </div>
      <span className="lancer-passer" aria-hidden="true">
        Touche pour passer
      </span>
    </div>
  );
}
