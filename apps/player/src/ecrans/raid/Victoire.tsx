// Page ⑯ : victoire du raid, où que soit le joueur. Nuit rouge ; trois entailles, les yeux du boss s'éteignent en
// croix, il s'effondre dans la poussière ; « BRIGADE VAINCUE ! », « Tes coups : n ». Puis, pour qui a frappé, la nuit
// devient bleue et le paquet de la Brigade tombe du ciel et s'ouvre comme à Masadora (3 sorts, « +3 » sur Sorts).
// Sans coup porté : le jeu le dit simplement, pas de paquet. Toucher pendant l'intro la passe.
import { Concentration } from '@gq/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { enListe } from '../../lib/boutique';
import { texteVictoireSansCoup, type IssueRaid } from '../../lib/raid';
import { Ouverture } from '../masadora/Ouverture';
import { FiltreEncre } from '../masadora/Paquet';
import { creerEffets } from '../scan/effets';
import { VisuelBoss } from './Boss';

const EASE = 'cubic-bezier(.16,1,.3,1)';
const vibrer = (p: number | number[]) => navigator.vibrate?.(p);
const delai = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

type Phase = 'intro' | 'revele' | 'paquet';

export function Victoire({ issue, onFini }: { issue: Extract<IssueRaid, { type: 'victoire' }>; onFini: () => void }) {
  const { boss, coups, coupFinal, sorts } = issue;
  const calme = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches).current;
  const [phase, setPhase] = useState<Phase>('intro');
  const [boite, setBoite] = useState({ texte: '', indice: '' });
  const r = {
    racine: useRef<HTMLDivElement>(null),
    nuit: useRef<HTMLDivElement>(null),
    lignes: useRef<HTMLDivElement>(null),
    boss: useRef<HTMLDivElement>(null),
    cri: useRef<HTMLDivElement>(null),
    coups: useRef<HTMLDivElement>(null),
    flash: useRef<HTMLDivElement>(null),
    dialogue: useRef<HTMLDivElement>(null),
    toile: useRef<HTMLCanvasElement>(null),
  };
  const ctl = useRef({ saute: false, phase: 'intro' as Phase, revelA: 0, attentes: new Set<() => void>(), toucher: null as null | (() => void) });
  const rappel = useRef(onFini);
  rappel.current = onFini;

  const surToucher = useCallback(() => {
    const c = ctl.current;
    if (c.phase === 'paquet') return;
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
      if (ctl.current.phase !== 'paquet' && ['Enter', ' ', 'Escape'].includes(e.key)) {
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
    const fx = creerEffets(r.toile.current!, () => new DOMRect(-999, -999, 0, 0));
    const anims: Animation[] = [];
    // L'opacité finale est aussi posée en style (leçon des pages ⑧ et ⑪).
    const A = (cible: HTMLElement | null, k: Keyframe[], o: KeyframeAnimationOptions & { duration: number }) => {
      if (!cible) return null;
      const vite = calme || c.saute;
      const a = cible.animate(k, { fill: 'both', easing: EASE, ...o, duration: vite ? 1 : o.duration, delay: vite ? 0 : (o.delay ?? 0) });
      anims.push(a);
      const fin = k[k.length - 1]!;
      if (fin.opacity !== undefined) cible.style.opacity = String(fin.opacity);
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
    const vif = () => !calme && !c.saute;
    const taper = async (t: string) => {
      for (let n = 1; n <= t.length; n++) {
        if (!vivant) return;
        if (calme || c.saute) return setBoite((b) => ({ ...b, texte: t }));
        setBoite((b) => ({ ...b, texte: t.slice(0, n) }));
        await delai(22);
      }
    };
    const mettrePhase = (p: Phase) => {
      c.phase = p;
      setPhase(p);
    };

    void (async () => {
      const b2 = r.boss.current!;
      vibrer([40, 40, 40]);
      // 1. La nuit ; le boss est là, au centre.
      A(r.nuit.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
      A(b2, [{ opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1 }], { duration: 360 });
      await pause(420);
      if (!vivant) return;
      // 2. Trois entailles : le dernier coup.
      const bb = b2.getBoundingClientRect();
      for (const [fxx, fyy, ang] of [
        [0.5, 0.35, -0.6],
        [0.45, 0.5, 0.7],
        [0.5, 0.42, -0.1],
      ] as const) {
        if (!vif()) break;
        const x = bb.left + bb.width * fxx;
        const y = bb.top + bb.height * fyy;
        const t = document.createElement('i');
        t.className = 'rd-entaille';
        const long = bb.width * 1.1;
        Object.assign(t.style, { position: 'fixed', left: `${x - long / 2}px`, top: `${y}px`, width: `${long}px`, rotate: `${ang}rad`, scale: '1 1.3' });
        r.racine.current?.append(t);
        t.animate([{ clipPath: 'inset(0 100% 0 0)', opacity: 1 }, { clipPath: 'inset(0 0 0 0)', opacity: 1, offset: 0.18 }, { opacity: 1, offset: 0.3 }, { clipPath: 'inset(0 0 0 0)', opacity: 0 }], { duration: 520, fill: 'forwards' }).finished.finally(() => t.remove());
        fx.etincelles(x, y, 40, '#ff5a4a', 0.8);
        fx.etincelles(x, y, 16, '#ffffff', 0.7);
        A(r.flash.current, [{ opacity: 0.35 }, { opacity: 0 }], { duration: 160, easing: 'ease-out' });
        b2.animate([{ translate: '0 0' }, { translate: '-10px 4px' }, { translate: '8px 0' }, { translate: '0 0' }], { duration: 200, composite: 'add' });
        vibrer(50);
        await pause(240);
      }
      if (!vivant) return;
      // 3. Les yeux s'éteignent (en croix) ; l'affiche prend son tampon « VAINCU » ; il s'effondre dans la poussière.
      b2.classList.add('ko');
      if (boss.rendu === 'affiche') {
        vibrer(90);
        await pause(500);
      }
      await pause(380);
      const chute = A(
        b2,
        [
          { opacity: 1, transform: 'none' },
          { opacity: 1, transform: 'rotate(-6deg) translateY(2%)', offset: 0.3 },
          { opacity: 0, transform: 'rotate(12deg) translateY(40%) scaleY(.7)' },
        ],
        { duration: 900, easing: 'cubic-bezier(.5,0,.8,.5)' },
      );
      await pause(520);
      if (!vivant) return;
      if (vif()) {
        const sy = bb.bottom - bb.height * 0.1;
        for (let i = -2; i <= 2; i++) fx.etincelles(innerWidth / 2 + i * bb.width * 0.15, sy, 18, '#a89f94', 0.35);
        fx.onde(innerWidth / 2, sy, '#ffb08a', 1.6);
        r.racine.current?.animate([{ translate: '0 0' }, { translate: '0 8px' }, { translate: '0 -4px' }, { translate: '0 0' }], { duration: 300 });
      }
      vibrer([120, 60, 200]);
      // 4. « BRIGADE VAINCUE ! »
      A(r.cri.current, [{ opacity: 0, scale: 2.4 }, { opacity: 1, scale: 1 }], { duration: 320, easing: 'cubic-bezier(.3,1.5,.5,1)' });
      A(r.lignes.current, [{ opacity: 0, scale: 1.3 }, { opacity: 0.2, scale: 1 }], { duration: 400 });
      await fini(chute);
      if (!vivant) return;
      A(r.coups.current, [{ opacity: 0, translate: '0 10px' }, { opacity: 1, translate: '0 0' }], { duration: 300 });
      await pause(1300);
      if (!vivant) return;
      c.saute = false;
      if (coups > 0 && sorts.length > 0) {
        // 5. La récompense : la nuit rouge s'efface sous la nuit bleue du paquet.
        mettrePhase('paquet');
        A(r.cri.current, [{ opacity: 1 }, { opacity: 0, translate: '0 -20px' }], { duration: 300 });
        A(r.coups.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
        A(r.lignes.current, [{ opacity: 0.2 }, { opacity: 0 }], { duration: 300 });
        A(r.nuit.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 500, delay: 300 });
        return;
      }
      // Sans coup (ou paquet déjà rangé hors ligne) : le jeu le dit, toucher ferme.
      mettrePhase('revele');
      A(r.dialogue.current, [{ opacity: 0, translate: '-50% 20px' }, { opacity: 1, translate: '-50% 0' }], { duration: 300 });
      await taper(coups ? 'Ton paquet de 3 sorts est dans tes Sorts.' : texteVictoireSansCoup(boss));
      if (!vivant) return;
      setBoite((b) => ({ ...b, indice: 'Touche pour fermer' }));
      c.revelA = performance.now();
      await new Promise<void>((res) => {
        c.toucher = res;
      });
      c.saute = false;
      A(r.dialogue.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      A(r.cri.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      A(r.coups.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      await fini(A(r.nuit.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 400 }));
      if (vivant) rappel.current();
    })();

    return () => {
      vivant = false;
      anims.forEach((a) => a.cancel());
      fx.arreter();
    };
  }, []);

  const cri = boss.vaincu;
  return (
    <>
      <div ref={r.racine} className={`rd-victoire ${phase}`} role="alertdialog" aria-modal="true" aria-label={`${cri[0]} ${cri[1]}`} onPointerDown={surToucher}>
        <FiltreEncre />
        <div ref={r.nuit} className="nuit" />
        <div ref={r.lignes} className="lignes">
          <Concentration graine={29} />
        </div>
        <div ref={r.boss} className={`c-boss ${boss.rendu}`} aria-hidden="true">
          <VisuelBoss boss={boss} />
        </div>
        <div ref={r.cri} className="cri">
          <span className="l1" style={{ '--n': Math.max(7, cri[0].length) } as React.CSSProperties}>
            {cri[0]}
          </span>
          <span className="l2">{cri[1]}</span>
        </div>
        <div ref={r.coups} className="tes-coups">
          {coups ? `Tes coups : ${coups}${coupFinal ? ' · le coup final est le tien !' : ''}` : 'Tu n’as pas porté de coup.'}
        </div>
        <canvas ref={r.toile} className="rd-toile-cine" aria-hidden="true" />
        <div ref={r.flash} className="flash" />
        <div ref={r.dialogue} className="lancer-dialogue gi-dialogue rd-dialogue" role="status">
          <span className="a-qui">{boss.nom}</span>
          <p className="a-texte">{boite.texte}</p>
          <p className={`a-indice${boite.indice ? ' visible' : ''}`}>{boite.indice || ' '}</p>
        </div>
        {phase === 'intro' && (
          <span className="lancer-passer" aria-hidden="true">
            Touche pour passer
          </span>
        )}
      </div>
      {phase === 'paquet' && (
        <Ouverture
          sorts={sorts}
          depuis={new DOMRect(innerWidth / 2 - 50, -innerHeight * 0.55, 100, 160)}
          marque="BRIGADE"
          qui="Récompense du raid"
          texte={(noms) => `Récompense du raid : tu as obtenu ${enListe(noms)}.`}
          onFini={() => rappel.current()}
        />
      )}
    </>
  );
}
