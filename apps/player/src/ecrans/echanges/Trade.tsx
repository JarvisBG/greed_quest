// Page ⑫ : cinématique « TRADE ! » de l'échange conclu (prototype validé le 2026-10-12 : docs/prototype/echanges.html).
// La nuit tombe sur la table scellée ; « TRADE ! » ; les deux parts s'embrasent et se ramassent en comètes : la tienne
// monte (or), la sienne descend (bleue) ; elles se croisent au milieu dans un éclair ; ses cartes arrivent de dos,
// se retournent ; le jeu dit ce qui a bougé ; toucher les range dans l'onglet Book (« +n »). Toucher pour passer.
import { Carte, Concentration, DosCarte } from '@gq/ui';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { listePart, vueDePiece, type Part, type VueEchange } from '../../lib/echanges';
import { creerEffets } from '../scan/effets';
import { Pieces } from './SessionEchange';

const EASE = 'cubic-bezier(.16,1,.3,1)';
type Phase = 'intro' | 'revele' | 'range';
const centre = (el: Element): [number, number] => {
  const b = el.getBoundingClientRect();
  return [b.left + b.width / 2, b.top + b.height / 2];
};
const vibrer = (p: number | number[]) => navigator.vibrate?.(p);
const delai = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

/** Une part en éventail, telle qu'elle flotte au-dessus de la table (5 cartes au plus, puis la pile de jenny). */
function Eventail({ part, cote }: { part: Part; cote: 'lui' | 'moi' }) {
  const items = part.cartes.slice(0, 5).map((c) => ({ cle: c.itemId, el: <Carte {...vueDePiece(c)} /> }));
  if (part.jenny)
    items.push({
      cle: 'jenny',
      el: (
        <div className="jeton">
          <Pieces jenny={part.jenny} />
          {part.jenny} J
        </div>
      ),
    });
  const n = Math.min(items.length, 6);
  return (
    <>
      {items.map((x, i) => {
        const k = i - (n - 1) / 2;
        return (
          <div key={x.cle} style={{ rotate: `${(cote === 'lui' ? 180 : 0) + k * 9}deg`, translate: `0 ${Math.abs(k) * 6 * (cote === 'lui' ? -1 : 1)}px` } as CSSProperties}>
            {x.el}
          </div>
        );
      })}
    </>
  );
}

interface Props {
  echange: VueEchange;
  /** La nuit couvre l'écran : la table peut disparaître. */
  onNuit: () => void;
  onFini: () => void;
}

export function Trade({ echange, onNuit, onFini }: Props) {
  const calme = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches).current;
  const donne = echange.maPart;
  const recu = echange.sonPart;
  const [phase, setPhase] = useState<Phase>('intro');
  const [boite, setBoite] = useState({ texte: '', indice: '' });
  const r = {
    nuit: useRef<HTMLDivElement>(null),
    lignes: useRef<HTMLDivElement>(null),
    toile: useRef<HTMLCanvasElement>(null),
    evLui: useRef<HTMLDivElement>(null),
    evMoi: useRef<HTMLDivElement>(null),
    recues: useRef<HTMLDivElement>(null),
    gain: useRef<HTMLDivElement>(null),
    cri: useRef<HTMLDivElement>(null),
    oMoi: useRef<HTMLDivElement>(null),
    oLui: useRef<HTMLDivElement>(null),
    flash: useRef<HTMLDivElement>(null),
    dialogue: useRef<HTMLDivElement>(null),
  };
  const ctl = useRef({ saute: false, phase: 'intro' as Phase, revelA: 0, attentes: new Set<() => void>(), toucher: null as null | (() => void) });
  const rappels = useRef({ onNuit, onFini });
  rappels.current = { onNuit, onFini };

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
    } else if (c.phase === 'revele' && !c.toucher) {
      // Pendant que le texte s'écrit : l'afficher d'un coup.
      c.saute = true;
    }
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
    const A = (cible: Element | null, k: Keyframe[], o: KeyframeAnimationOptions & { duration: number }) => {
      if (!cible) return null;
      const a = cible.animate(k, { fill: 'both', easing: EASE, ...o, duration: calme ? 1 : o.duration });
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

    void (async () => {
      vibrer([30, 40, 80]);
      // 1. La nuit tombe sur la table ; les deux parts flottent face à face.
      A(el.nuit, [{ opacity: 0 }, { opacity: 1 }], { duration: 320 });
      A(el.lignes, [{ opacity: 0, scale: 1.3 }, { opacity: 0.22, scale: 1 }], { duration: 500 });
      A(el.evLui, [{ opacity: 0, translate: '-50% -40px' }, { opacity: 1, translate: '-50% 0' }], { duration: 480 });
      A(el.evMoi, [{ opacity: 0, translate: '-50% 40px' }, { opacity: 1, translate: '-50% 0' }], { duration: 480 });
      await pause(380);
      if (!vivant) return;
      rappels.current.onNuit();
      // 2. « TRADE ! »
      A(el.cri, [{ opacity: 0, scale: 2.4, rotate: '-8deg' }, { opacity: 1, scale: 1, rotate: '-4deg' }], { duration: 300, easing: 'cubic-bezier(.3,1.5,.5,1)' });
      await pause(260);
      vibrer(60);
      await pause(560);
      A(el.cri, [{ opacity: 1 }, { opacity: 0, scale: 1.15 }], { duration: 260 });
      // 3. Les deux parts s'embrasent.
      el.evMoi?.classList.add('embrase');
      el.evLui?.classList.add('embrase');
      if (!calme && el.evMoi && el.evLui) {
        fx.etincelles(...centre(el.evMoi), 40, '#ffd877', 0.6);
        fx.etincelles(...centre(el.evLui), 40, '#cfe0ff', 0.6);
      }
      await pause(520);
      // 4. Elles se ramassent en comètes : la tienne monte (or), la sienne descend (bleue).
      const [mx, my] = el.evMoi ? centre(el.evMoi) : [innerWidth / 2, innerHeight * 0.8];
      const [lx, ly] = el.evLui ? centre(el.evLui) : [innerWidth / 2, innerHeight * 0.2];
      const cx = innerWidth / 2;
      const cy = innerHeight / 2;
      A(el.evMoi, [{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.2 }], { duration: 260, easing: 'ease-in' });
      A(el.evLui, [{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.2 }], { duration: 260, easing: 'ease-in' });
      A(el.oMoi, [{ opacity: 0, transform: `translate(${mx}px,${my}px) scale(.3)` }, { opacity: 1, transform: `translate(${mx}px,${my}px) scale(1)` }], { duration: 240 });
      A(el.oLui, [{ opacity: 0, transform: `translate(${lx}px,${ly}px) scale(.3)` }, { opacity: 1, transform: `translate(${lx}px,${ly}px) scale(1)` }], { duration: 240 });
      await pause(240);
      if (!c.saute && !calme && el.oMoi && el.oLui) {
        fx.trainees([
          { point: () => centre(el.oMoi!), couleurs: ['#ffd877', '#ffffff', '#ffb347'] },
          { point: () => centre(el.oLui!), couleurs: ['#8fb2ff', '#ffffff', '#cfe0ff'] },
        ]);
      }
      // Trajectoires en S : elles se frôlent au centre.
      const d = 900;
      const vol = (o: Element | null, x0: number, y0: number, x1: number, y1: number, dx: number) =>
        A(
          o,
          [
            { transform: `translate(${x0}px,${y0}px) scale(1)` },
            { transform: `translate(${cx + dx}px,${(y0 + cy) / 2}px) scale(1.05)`, offset: 0.3 },
            { transform: `translate(${cx}px,${cy}px) scale(1.25)`, offset: 0.5 },
            { transform: `translate(${cx - dx}px,${(y1 + cy) / 2}px) scale(1.05)`, offset: 0.7 },
            { transform: `translate(${x1}px,${y1}px) scale(1)` },
          ],
          { duration: d, easing: 'cubic-bezier(.45,0,.55,1)' },
        );
      vol(el.oMoi, mx, my, lx, ly - 30, -60);
      vol(el.oLui, lx, ly, cx, innerHeight * 0.44, 60);
      // 5. Le croisement : éclair au centre.
      await pause(d / 2);
      A(el.flash, [{ opacity: 0.85 }, { opacity: 0 }], { duration: 360, easing: 'ease-out' });
      if (!calme) {
        fx.onde(cx, cy, '#ffe9b0', 1.3);
        fx.etincelles(cx, cy, 90, '#ffffff', 1);
        fx.etincelles(cx, cy, 50, '#ffd877', 0.8);
      }
      vibrer(90);
      await pause(d / 2);
      fx.trainees([]);
      // 6. Ta comète disparaît chez lui ; la sienne éclate devant toi : ses cartes arrivent de dos.
      A(el.oMoi, [{ opacity: 1 }, { opacity: 0, scale: 2 }], { duration: 260 });
      A(el.oLui, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      if (!calme) fx.etincelles(cx, innerHeight * 0.44, 50, '#cfe0ff', 0.7);
      const lesRecues = [...(el.recues?.querySelectorAll<HTMLElement>('.recue') ?? [])];
      lesRecues.forEach((x, i) => {
        A(x, [{ opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1 }], { duration: 380, delay: i * 90, easing: 'cubic-bezier(.3,1.4,.5,1)' });
        A(x.querySelector('.lancer-retourne'), [{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(180deg)', offset: 0.35 }, { transform: 'rotateY(0deg)' }], { duration: 1000, delay: 250 + i * 160 });
      });
      if (el.gain) A(el.gain, [{ opacity: 0, translate: '0 16px' }, { opacity: 1, translate: '0 0' }], { duration: 420, delay: 600 + lesRecues.length * 160 });
      if (!c.saute) await pause(900 + lesRecues.length * 160);
      else anims.forEach((a) => a.finish());
      if (!vivant) return;
      // 7. Le jeu dit ce qui a bougé.
      c.saute = false;
      c.revelA = performance.now();
      mettrePhase('revele');
      A(el.dialogue, [{ opacity: 0, translate: '-50% 20px' }, { opacity: 1, translate: '-50% 0' }], { duration: 300 });
      await taper(`Tu as reçu ${listePart(recu)}. Tu as donné ${listePart(donne)}.`);
      if (!vivant) return;
      setBoite((b) => ({ ...b, indice: recu.cartes.length ? 'Touche pour ranger dans ton Book' : 'Touche pour fermer' }));
      c.revelA = performance.now();
      await toucher();
      // 8. Les cartes filent vers l'onglet Book ; « +n ».
      mettrePhase('range');
      const livre = document.querySelector('.onglets [data-onglet="livre"]');
      const [bx, by] = livre ? centre(livre) : [innerWidth / 2, innerHeight];
      A(el.dialogue, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      if (el.gain) A(el.gain, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      const vols = lesRecues.map((x, i) => {
        const [x0, y0] = centre(x);
        return A(x, [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${bx - x0}px,${by - y0}px) scale(.18) rotate(${i % 2 ? 14 : -14}deg)`, opacity: 0.2 }], { duration: 560, delay: i * 70, easing: 'cubic-bezier(.55,0,.75,.3)' });
      });
      A(el.nuit, [{ opacity: 1 }, { opacity: 0 }], { duration: 520, delay: 200 });
      A(el.lignes, [{ opacity: 0.22 }, { opacity: 0 }], { duration: 300 });
      await Promise.all(vols.map(fini));
      if (recu.cartes.length && livre && !calme) {
        const b = livre.getBoundingClientRect();
        const plus = document.createElement('span');
        plus.className = 'ech-plus';
        plus.textContent = `+${recu.cartes.length}`;
        plus.style.left = `${b.left + b.width / 2}px`;
        plus.style.top = `${b.top - 34}px`;
        document.body.append(plus);
        plus
          .animate([{ opacity: 0, transform: 'translate(-50%, 8px)' }, { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1600, fill: 'forwards' })
          .finished.finally(() => plus.remove());
        vibrer(30);
      }
      await pause(320);
      if (vivant) rappels.current.onFini();
    })();

    return () => {
      vivant = false;
      anims.forEach((a) => a.cancel());
      fx.arreter();
    };
  }, []);

  return (
    <div className={`lancer ech-trade ${phase}`} role="alertdialog" aria-modal="true" aria-label="Échange conclu" onPointerDown={surToucher}>
      <div ref={r.nuit} className="lancer-nuit ech-trade-nuit" />
      <div ref={r.lignes} className="lancer-lignes ech-trade-lignes">
        <Concentration graine={31} />
      </div>
      <canvas ref={r.toile} className="lancer-toile" aria-hidden="true" />
      <div ref={r.evLui} className="eventail lui-ev" aria-hidden="true">
        <Eventail part={recu} cote="lui" />
      </div>
      <div ref={r.evMoi} className="eventail moi-ev" aria-hidden="true">
        <Eventail part={donne} cote="moi" />
      </div>
      <div ref={r.recues} className="recues">
        {recu.cartes.slice(0, 6).map((x) => (
          <div key={x.itemId} className="recue">
            <div className="lancer-retourne">
              <Carte {...vueDePiece(x)} />
              <DosCarte />
            </div>
          </div>
        ))}
        {recu.jenny > 0 && (
          <div ref={r.gain} className="gain">
            +{recu.jenny} J
          </div>
        )}
      </div>
      <div ref={r.cri} className="cri" aria-hidden="true">
        TRADE !
      </div>
      <div ref={r.oMoi} className="lancer-orbe chaude" aria-hidden="true" />
      <div ref={r.oLui} className="lancer-orbe" aria-hidden="true" />
      <div ref={r.flash} className="lancer-flash" />
      <div ref={r.dialogue} className="lancer-dialogue gi-dialogue ech-trade-dialogue" role="status">
        <span className="a-qui">Échange conclu</span>
        <p className="a-texte">{boite.texte}</p>
        <p className={`a-indice${boite.indice ? ' visible' : ''}`}>{boite.indice || ' '}</p>
      </div>
      <span className="lancer-passer" aria-hidden="true">
        Touche pour passer
      </span>
    </div>
  );
}
