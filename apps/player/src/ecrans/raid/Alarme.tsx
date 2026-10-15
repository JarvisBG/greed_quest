// Page ⑯ : l'alarme du raid, où que soit le joueur. Nuit rouge, deux faisceaux de sirène qui tournent, bords qui
// battent, vibration longue ; la silhouette du boss monte, ses yeux s'allument ; « RAID / DE LA BRIGADE ! » frappé ;
// puis la boîte du jeu : PV, temps pour l'abattre, « Au combat ! » ou « Plus tard » (le bandeau reste sous la barre).
// Toucher pendant l'intro la passe.
import { Concentration } from '@gq/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { mmss, tempsRestant, type Boss, type VueRaid } from '../../lib/raid';
import { creerEffets } from '../scan/effets';
import { ChefBrigade, VisuelBoss } from './Boss';

const EASE = 'cubic-bezier(.16,1,.3,1)';
const vibrer = (p: number | number[]) => navigator.vibrate?.(p);
const centre = (el: Element): [number, number] => {
  const b = el.getBoundingClientRect();
  return [b.left + b.width / 2, b.top + b.height / 2];
};

interface Props {
  boss: Boss;
  vue: VueRaid | null;
  onCombat: () => void;
  onPlusTard: () => void;
}

export function Alarme({ boss, vue, onCombat, onPlusTard }: Props) {
  const calme = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches).current;
  const [choix, setChoix] = useState(false);
  const [sortie, setSortie] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  const r = {
    nuit: useRef<HTMLDivElement>(null),
    sirene: useRef<HTMLDivElement>(null),
    bords: useRef<HTMLDivElement>(null),
    lignes: useRef<HTMLDivElement>(null),
    ombre: useRef<HTMLDivElement>(null),
    yeux: useRef<HTMLDivElement>(null),
    cri: useRef<HTMLDivElement>(null),
    infos: useRef<HTMLDivElement>(null),
    toile: useRef<HTMLCanvasElement>(null),
    combat: useRef<HTMLButtonElement>(null),
  };
  const ctl = useRef({ saute: false, attentes: new Set<() => void>() });

  const passer = useCallback(() => {
    const c = ctl.current;
    if (c.saute) return;
    c.saute = true;
    [...c.attentes].forEach((f) => f());
  }, []);

  useEffect(() => {
    let vivant = true;
    const c = ctl.current;
    const fx = creerEffets(r.toile.current!, () => new DOMRect(-999, -999, 0, 0));
    const anims: Animation[] = [];
    // L'opacité finale est aussi posée en style (leçon des pages ⑧ et ⑪ : sur certains téléphones, le `fill` ne tient pas).
    const A = (cible: HTMLElement | null, k: Keyframe[], o: KeyframeAnimationOptions & { duration: number }) => {
      if (!cible) return;
      const vite = calme || c.saute;
      anims.push(cible.animate(k, { fill: 'both', easing: EASE, ...o, duration: vite ? 1 : o.duration, delay: vite ? 0 : (o.delay ?? 0) }));
      const fin = k[k.length - 1]!;
      if (fin.opacity !== undefined) cible.style.opacity = String(fin.opacity);
    };
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

    void (async () => {
      // 1. La nuit rouge, la sirène, les bords qui battent.
      vibrer([200, 100, 200, 100, 400]);
      A(r.nuit.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
      A(r.sirene.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
      A(r.bords.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
      await pause(700);
      if (!vivant) return;
      // 2. La silhouette du boss monte du bas ; ses yeux s'allument.
      A(r.ombre.current, [{ opacity: 1, transform: 'translateY(45%) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 900, easing: 'cubic-bezier(.2,.8,.3,1)' });
      A(r.yeux.current, [{ opacity: 0, transform: 'translateY(45%) scale(.9)' }, { opacity: 0, transform: 'none', offset: 0.7 }, { opacity: 1, transform: 'none' }], { duration: 1100, easing: 'cubic-bezier(.2,.8,.3,1)' });
      await pause(1100);
      if (!vivant) return;
      // 3. « RAID DE LA BRIGADE ! » frappé.
      A(r.cri.current, [{ opacity: 0, scale: 2.6 }, { opacity: 1, scale: 1 }], { duration: 320, easing: 'cubic-bezier(.3,1.5,.5,1)' });
      A(r.lignes.current, [{ opacity: 0, scale: 1.3 }, { opacity: 0.18, scale: 1 }], { duration: 400 });
      await pause(220);
      if (!vivant) return;
      if (!calme && !c.saute && r.cri.current) {
        const [cx, cy] = centre(r.cri.current);
        fx.onde(cx, cy, '#ff5a4a', 1.3);
        fx.etincelles(cx, cy, 70, '#ff5a4a', 1);
        fx.etincelles(cx, cy, 30, '#ffffff', 0.8);
        racine.current?.animate([{ translate: '0 0' }, { translate: '-8px 5px' }, { translate: '6px -4px' }, { translate: '-3px 2px' }, { translate: '0 0' }], { duration: 260 });
      }
      vibrer(140);
      await pause(700);
      if (!vivant) return;
      // 4. Ce qu'il faut savoir, et « Au combat ! ».
      A(r.infos.current, [{ opacity: 0, translate: '-50% 24px' }, { opacity: 1, translate: '-50% 0' }], { duration: 320 });
      setChoix(true);
      r.combat.current?.focus({ preventScroll: true });
    })();
    return () => {
      vivant = false;
      anims.forEach((a) => a.cancel());
      fx.arreter();
    };
  }, []);

  const fermer = (suite: () => void) => {
    if (sortie) return;
    setSortie(true);
    const a = racine.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: calme ? 1 : 260, fill: 'forwards' });
    if (a) void a.finished.finally(suite);
    else suite();
  };

  const pvMax = vue?.pvMax ?? 0;
  const temps = vue ? mmss(tempsRestant(vue, Date.now())) : '10:00';
  const l2 = boss.cri;
  return (
    <div
      ref={racine}
      className={`rd-alarme ${boss.rendu}${choix ? '' : ' intro'}`}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="rd-al-titre"
      onPointerDown={(e) => {
        if (!choix && !(e.target as Element).closest('button')) passer();
      }}
    >
      <div ref={r.nuit} className="nuit" />
      <div ref={r.sirene} className="sirene" />
      <div ref={r.lignes} className="lignes">
        <Concentration graine={23} />
      </div>
      <div ref={r.ombre} className="ombre" aria-hidden="true">
        <VisuelBoss boss={boss} />
      </div>
      <div ref={r.yeux} className="yeux-seuls" aria-hidden="true">
        {boss.rendu === 'dessin' && <ChefBrigade />}
      </div>
      <div ref={r.bords} className="bords" />
      <div ref={r.cri} className="cri">
        <span className="l1" id="rd-al-titre">
          RAID
        </span>
        <span className="l2" style={{ '--n': Math.max(15, l2.length) } as React.CSSProperties}>
          {l2}
        </span>
      </div>
      <canvas ref={r.toile} className="rd-toile-cine" aria-hidden="true" />
      <div ref={r.infos} className="infos gi-dialogue" style={{ pointerEvents: choix ? undefined : 'none' }}>
        <span className="a-qui">{boss.nom}</span>
        <p className="a-texte">
          {boss.rendu === 'dessin' ? `${boss.entree} : ` : `${boss.entree} ${boss.nom} débarque : `}
          <b>{pvMax} PV</b>, <b>{temps}</b> pour l’abattre. Chaque bonne réponse le frappe.
        </p>
        <button ref={r.combat} className="au-combat" onClick={() => fermer(onCombat)}>
          Au combat !
        </button>
        <button className="plus-tard" onClick={() => fermer(onPlusTard)}>
          Plus tard
        </button>
      </div>
      <span className="passer" aria-hidden="true">
        Touche pour passer
      </span>
    </div>
  );
}
