// Page ⑬ : cinématique d'ouverture du paquet (prototype validé le 2026-10-12 : docs/prototype/masadora.html).
// Nuit bleue ; le paquet quitte la vitrine et vient au centre, tremble et s'éclaire ; une ligne de lumière court le
// long du serti, le haut saute ; rayons et étincelles ; trois cartes de dos montent du sachet, le sachet tombe ;
// éventail ; elles se retournent une à une ; le jeu nomme ce qui est sorti ; toucher les range dans l'onglet Sorts
// (« +3 »). Toucher pendant l'intro passe à la révélation.
import type { SpellType } from '@gq/shared';
import { Carte, Concentration, DosCarte } from '@gq/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { texteObtenu } from '../../lib/boutique';
import { numeroSort, SORTS } from '../../lib/format';
import { creerEffets } from '../scan/effets';
import { Paquet } from './Paquet';

const EASE = 'cubic-bezier(.16,1,.3,1)';
type Phase = 'intro' | 'revele' | 'range';
const centre = (el: Element): [number, number] => {
  const b = el.getBoundingClientRect();
  return [b.left + b.width / 2, b.top + b.height / 2];
};
const vibrer = (p: number | number[]) => navigator.vibrate?.(p);
const delai = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

interface Props {
  sorts: SpellType[];
  /** Le paquet de la vitrine : point de départ du vol. */
  depuis: DOMRect | null;
  onFini: () => void;
}

export function Ouverture({ sorts, depuis, onFini }: Props) {
  const calme = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches).current;
  const [phase, setPhase] = useState<Phase>('intro');
  const [boite, setBoite] = useState({ texte: '', indice: '' });
  const r = {
    nuit: useRef<HTMLDivElement>(null),
    lignes: useRef<HTMLDivElement>(null),
    rayons: useRef<HTMLDivElement>(null),
    toile: useRef<HTMLCanvasElement>(null),
    scene: useRef<HTMLDivElement>(null),
    cp: useRef<HTMLDivElement>(null),
    paquet: useRef<HTMLDivElement>(null),
    dechirure: useRef<HTMLSpanElement>(null),
    flash: useRef<HTMLDivElement>(null),
    dialogue: useRef<HTMLDivElement>(null),
  };
  const ctl = useRef({ saute: false, phase: 'intro' as Phase, revelA: 0, attentes: new Set<() => void>(), toucher: null as null | (() => void) });
  const rappel = useRef(onFini);
  rappel.current = onFini;

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
    const etincelles = (x: number, y: number, n: number, col: string, f: number) => {
      if (!calme && !c.saute) fx.etincelles(x, y, n, col, f);
    };

    void (async () => {
      const cartes = [...(el.scene?.querySelectorAll<HTMLElement>('.mo-carte') ?? [])];
      vibrer([30, 40, 60]);
      // Géométrie : le paquet de la vitrine → le centre de la scène.
      const sb = el.scene!.getBoundingClientRect();
      const pw = el.paquet?.getBoundingClientRect().width || 196;
      const ph = (pw * 100) / 63;
      const vb = depuis ?? new DOMRect(sb.left - pw / 2, sb.top - ph / 2, pw, ph);
      const k0 = vb.width / pw;
      const dx0 = vb.left + vb.width / 2 - sb.left;
      const dy0 = vb.top + vb.height / 2 - sb.top;
      el.rayons?.style.setProperty('top', `${sb.top - ph * 0.41}px`);

      // 1. La nuit tombe ; le paquet quitte la vitrine et vient au centre.
      A(el.nuit, [{ opacity: 0 }, { opacity: 1 }], { duration: 320 });
      A(el.lignes, [{ opacity: 0, scale: 1.3 }, { opacity: 0.2, scale: 1 }], { duration: 500 });
      A(
        el.cp,
        [
          { opacity: 1, transform: `translate(${dx0}px,${dy0}px) scale(${k0})` },
          { opacity: 1, transform: 'translate(0,0) scale(1.08) rotate(-3deg)', offset: 0.75 },
          { opacity: 1, transform: 'translate(0,0) scale(1)' },
        ],
        { duration: 620, easing: 'cubic-bezier(.3,0,.2,1)' },
      );
      await pause(640);
      if (!vivant) return;
      // 2. Il tremble, la lumière monte dedans.
      el.cp?.classList.add('embrase');
      const [px, py] = el.cp ? centre(el.cp) : [innerWidth / 2, innerHeight / 2];
      A(
        el.paquet,
        [{ translate: '0 0' }, { translate: '-4px 0', rotate: '-2deg' }, { translate: '4px 0', rotate: '2deg' }, { translate: '-3px 0', rotate: '-1deg' }, { translate: '3px 0', rotate: '1deg' }, { translate: '0 0', rotate: '0deg' }],
        { duration: 420, easing: 'linear' },
      );
      vibrer([20, 30, 20, 30, 20]);
      etincelles(px, py, 24, '#8fb2ff', 0.4);
      await pause(460);
      // 3. La déchirure court le long du serti, le haut du sachet saute.
      A(el.dechirure, [{ opacity: 1, scale: '0 1' }, { opacity: 1, scale: '1 1' }], { duration: 300, easing: 'cubic-bezier(.5,0,.5,1)' });
      await pause(300);
      A(el.paquet?.querySelector('.serti.haut'), [{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${pw * 0.7}px,${-ph * 0.5}px) rotate(38deg)`, opacity: 0 }], {
        duration: 620,
        easing: 'cubic-bezier(.2,.6,.4,1)',
      });
      A(el.dechirure, [{ opacity: 1 }, { opacity: 0 }], { duration: 260 });
      A(el.flash, [{ opacity: 0.6 }, { opacity: 0 }], { duration: 300, easing: 'ease-out' });
      const yOuv = py - ph * 0.42;
      if (!calme && !c.saute) fx.onde(px, yOuv, '#cfe0ff', 1.1);
      etincelles(px, yOuv, 70, '#ffffff', 0.9);
      etincelles(px, yOuv, 40, '#8fb2ff', 0.8);
      A(el.rayons, [{ opacity: 0, rotate: '0deg', scale: 0.4 }, { opacity: 0.9, rotate: '12deg', scale: 1 }], { duration: 700 });
      vibrer(80);
      // 4. Trois cartes montent du sachet, de dos ; le sachet tombe.
      const cb = cartes[0]?.getBoundingClientRect();
      const ch = cb?.height || 160;
      const cw = cb?.width || 116;
      const yDedans = ch * 0.1;
      const yHors = -ph * 0.62;
      cartes.forEach((x, i) =>
        A(x, [{ opacity: 1, transform: `translate(0,${yDedans}px)` }, { opacity: 1, transform: `translate(${(i - 1) * 14}px,${yHors}px) rotate(${(i - 1) * 6}deg)` }], {
          duration: 520,
          delay: 120 + i * 110,
          easing: 'cubic-bezier(.2,.9,.3,1)',
        }),
      );
      await pause(740);
      A(el.cp, [{ opacity: 1, transform: 'translate(0,0)' }, { opacity: 0, transform: `translate(0,${innerHeight * 0.45}px) rotate(8deg)` }], { duration: 560, easing: 'cubic-bezier(.55,0,.8,.4)' });
      // 5. Elles s'ouvrent en éventail au centre.
      const pas = Math.min(cw * 0.76, (innerWidth - 24 - cw) / 2);
      const yEv = -ch * 0.15;
      cartes.forEach((x, i) =>
        A(
          x,
          [
            { opacity: 1, transform: `translate(${(i - 1) * 14}px,${yHors}px) rotate(${(i - 1) * 6}deg)` },
            { opacity: 1, transform: `translate(${(i - 1) * pas}px,${yEv + Math.abs(i - 1) * 14}px) rotate(${(i - 1) * 7}deg)` },
          ],
          { duration: 560, easing: 'cubic-bezier(.3,1.3,.5,1)' },
        ),
      );
      A(el.rayons, [{ opacity: 0.9, rotate: '12deg' }, { opacity: 0.45, rotate: '40deg' }], { duration: 2400, easing: 'linear' });
      await pause(560);
      if (!vivant) return;
      // 6. Elles se retournent une à une.
      for (const x of cartes) {
        A(x.querySelector('.lancer-retourne'), [{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(0deg)' }], { duration: 520, easing: 'cubic-bezier(.3,1.3,.5,1)' });
        await pause(260);
        etincelles(...centre(x), 26, '#cfe0ff', 0.5);
        vibrer(25);
        await pause(200);
      }
      if (c.saute) anims.forEach((a) => a.finish());
      if (!vivant) return;
      // 7. Le jeu nomme ce qui est sorti.
      c.saute = false;
      c.revelA = performance.now();
      mettrePhase('revele');
      A(el.dialogue, [{ opacity: 0, translate: '-50% 20px' }, { opacity: 1, translate: '-50% 0' }], { duration: 300 });
      await taper(texteObtenu(sorts.map((s) => SORTS[s].nom)));
      if (!vivant) return;
      setBoite((b) => ({ ...b, indice: 'Touche pour ranger dans tes sorts' }));
      c.revelA = performance.now();
      await toucher();
      // 8. Les cartes filent vers l'onglet Sorts ; « +3 ».
      c.saute = false;
      mettrePhase('range');
      const onglet = document.querySelector('.onglets [data-onglet="sorts"]');
      const [bx, by] = onglet ? centre(onglet) : [innerWidth / 2, innerHeight];
      A(el.dialogue, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      A(el.rayons, [{ opacity: 0.45 }, { opacity: 0 }], { duration: 300 });
      const vols = cartes.map((x, i) => {
        const [x0, y0] = centre(x);
        return A(x, [{ translate: '0 0', scale: 1, opacity: 1 }, { translate: `${bx - x0}px ${by - y0}px`, scale: 0.16, opacity: 0.2 }], { duration: 560, delay: i * 80, easing: 'cubic-bezier(.55,0,.75,.3)' });
      });
      A(el.nuit, [{ opacity: 1 }, { opacity: 0 }], { duration: 520, delay: 220 });
      A(el.lignes, [{ opacity: 0.2 }, { opacity: 0 }], { duration: 300 });
      await Promise.all(vols.map(fini));
      cartes.forEach((x) => (x.style.opacity = '0'));
      if (onglet && !calme) {
        const b = onglet.getBoundingClientRect();
        const plus = document.createElement('span');
        plus.className = 'tirage-plus-un';
        plus.textContent = `+${sorts.length}`;
        plus.style.left = `${b.left + b.width / 2}px`;
        plus.style.top = `${b.top - 34}px`;
        document.body.append(plus);
        plus
          .animate([{ opacity: 0, transform: 'translate(-50%, 8px)' }, { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1600, fill: 'forwards' })
          .finished.finally(() => plus.remove());
      }
      vibrer(30);
      await pause(320);
      if (vivant) rappel.current();
    })();

    return () => {
      vivant = false;
      anims.forEach((a) => a.cancel());
      fx.arreter();
    };
  }, []);

  return (
    <div className={`lancer mas-ouverture ${phase}`} role="alertdialog" aria-modal="true" aria-label="Ouverture du paquet" onPointerDown={surToucher}>
      <div ref={r.nuit} className="lancer-nuit mo-nuit" />
      <div ref={r.lignes} className="lancer-lignes">
        <Concentration graine={23} />
      </div>
      <div ref={r.rayons} className="mo-rayons" />
      <canvas ref={r.toile} className="lancer-toile" aria-hidden="true" />
      <div ref={r.scene} className="mo-scene" aria-hidden="true">
        <div ref={r.cp} className="mo-paquet">
          <Paquet ref={r.paquet} />
          <span ref={r.dechirure} className="mo-dechirure" />
        </div>
        {sorts.map((s, i) => (
          <div key={i} className="mo-carte" style={{ zIndex: i === 1 ? 1 : 0 }}>
            <div className="lancer-retourne" style={{ transform: 'rotateY(180deg)' }}>
              <Carte genre="sort" numero={numeroSort(SORTS[s].numero)} nom={SORTS[s].nom} texte={SORTS[s].effet} />
              <DosCarte />
            </div>
          </div>
        ))}
      </div>
      <div ref={r.flash} className="lancer-flash" />
      <div ref={r.dialogue} className="lancer-dialogue gi-dialogue mo-dialogue" role="status">
        <span className="a-qui">Paquet ouvert</span>
        <p className="a-texte">{boite.texte}</p>
        <p className={`a-indice${boite.indice ? ' visible' : ''}`}>{boite.indice || ' '}</p>
      </div>
      <span className="lancer-passer" aria-hidden="true">
        Touche pour passer
      </span>
    </div>
  );
}
