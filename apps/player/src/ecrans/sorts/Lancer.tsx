// Cinématique du lancer (page ⑧ ; prototype validé par Sivraj le 2026-10-11 : docs/prototype/sorts-lancer.html).
// La nuit tombe, la carte de sort vient au centre, le joueur crie le sort (« VOL » puis « ON ! », « → Kirua ») et la
// lumière bleue fuit de ses bords. La requête est partie au toucher du bouton : la cinématique attend la réponse du
// serveur (P1) au moment de lâcher le sort. Refus : la lumière meurt, les lettres tombent, la carte revient dans la
// fiche, rien n'est dépensé. Sinon la carte s'embrase, se ramasse en boule de lumière et part en comète, puis l'issue
// (issueLancer) : la carte prise revient et se retourne, la comète se brise sur un Mur défensif, le givre gagne
// l'écran (Gel), le Book de la cible s'ouvre (Voyance, Clairvoyance), la carte choisie se dédouble (Mimétisme),
// ou la boîte du jeu seule. Toucher pendant le cri saute à l'issue.
import type { SpellType } from '@gq/shared';
import { Carte, Concentration, DosCarte, type CarteProps } from '@gq/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { issueLancer, type PocheVision, type ReponseSort } from '../../lib/sorts';
import { creerEffets } from '../scan/effets';
import { Vision } from './Vision';

export type CarteVue = Omit<CarteProps, 'className' | 'illustration' | 'grisee'>;

export interface DemandeLancer {
  sort: SpellType;
  /** Nom crié (« VOL »). */
  nomSort: string;
  carteSort: CarteVue;
  cible: string | null;
  /** Échange : la carte donnée (elle part avec la comète) ; Mimétisme : la carte copiée. */
  carteChoisie: CarteVue | null;
  /** Place de la carte dans la fiche : elle part de là et y revient sur un refus. */
  depart: DOMRect | null;
  reponse: Promise<ReponseSort>;
  /** Phrase du résultat pour le lanceur (resumeSort). */
  phrase: (r: ReponseSort) => string;
  /** Voyance, Clairvoyance : pages du Book de la cible, et places des emplacements libres. */
  pagesVision: (r: ReponseSort) => PocheVision[][];
  placesLibres: number;
}

export type FinLancer = { type: 'fait'; r: ReponseSort } | { type: 'refus' };

const EASE = 'cubic-bezier(.16,1,.3,1)';
const BLEU = '#8fb2ff';
type Phase = 'intro' | 'revele' | 'vision' | 'range';
const centre = (el: Element): [number, number] => {
  const b = el.getBoundingClientRect();
  return [b.left + b.width / 2, b.top + b.height / 2];
};
const vibrer = (p: number | number[]) => navigator.vibrate?.(p);
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** Taille du cri : le mot tient dans la largeur de l'écran. */
const tailleCri = (mot: string) => `${Math.min(150, (Math.min(innerWidth, 480) * 0.92) / (mot.length * 0.86 + 0.4)).toFixed(0)}px`;

// Coque d'alvéoles du Mur défensif et ses fêlures, dessinées une fois.
const ALVEOLES = (() => {
  const hex = (cx: number, cy: number, r: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
    }).join(' ');
  const R = 9.5;
  const dx = R * Math.sqrt(3);
  const dy = R * 1.5;
  const l: string[] = [];
  for (let row = -7; row <= 7; row++)
    for (let col = -7; col <= 7; col++) {
      const x = col * dx + (row % 2 ? dx / 2 : 0);
      const y = row * dy;
      if (Math.hypot(x, y) < 62) l.push(hex(x, y, R - 0.6));
    }
  return l;
})();
const FELURES = ['M0 0 L-9 -14 L-6 -27 L-17 -40 L-14 -58', 'M0 0 L13 -8 L26 -6 L35 -19 L52 -24', 'M0 0 L15 10 L18 26 L33 34 L40 50', 'M0 0 L-12 9 L-28 7 L-37 20 L-54 26', 'M0 0 L-3 16 L-14 30 L-10 46', 'M-6 -27 L6 -36', 'M26 -6 L30 6'];
// Givre : branches cristallines, posées aux quatre coins.
const GIVRE = (() => {
  let s = 7;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const branche = (x: number, y: number, a: number, l: number, n: number): string => {
    if (n === 0 || l < 3) return '';
    const x2 = x + Math.cos(a) * l;
    const y2 = y + Math.sin(a) * l;
    let d = `M${x.toFixed(1)} ${y.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
    for (let i = 1; i <= 2; i++) {
      const k = i / 3;
      d += branche(x + (x2 - x) * k, y + (y2 - y) * k, a + (i % 2 ? 0.75 : -0.75), l * 0.42, n - 1);
    }
    return d + branche(x2, y2, a + (r() - 0.5) * 0.5, l * 0.66, n - 1);
  };
  let d = '';
  for (let i = 0; i < 6; i++) d += branche(0, 0, (Math.PI / 2) * (i / 5) + (r() - 0.5) * 0.15, 26 + r() * 14, 4);
  return d;
})();
const COINS_GIVRE = ['hg', 'hd', 'bg', 'bd'] as const;

export function Lancer({ demande, onRangement, onFini }: { demande: DemandeLancer; onRangement: () => void; onFini: (f: FinLancer) => void }) {
  const calme = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches).current;
  const [phase, setPhase] = useState<Phase>('intro');
  const [face, setFace] = useState<CarteVue>(demande.carteSort);
  const [cri, setCri] = useState({ mot: demande.nomSort.toUpperCase(), creux: false, centre: false });
  const [boite, setBoite] = useState({ qui: 'Greed Island', refus: false, texte: '', indice: '' });
  const [vision, setVision] = useState<{ pages: PocheVision[][]; libres: boolean } | null>(null);
  const r = {
    racine: useRef<HTMLDivElement>(null),
    nuit: useRef<HTMLDivElement>(null),
    lignes: useRef<HTMLDivElement>(null),
    givre: useRef<HTMLDivElement>(null),
    toile: useRef<HTMLCanvasElement>(null),
    mur: useRef<HTMLDivElement>(null),
    cri: useRef<HTMLDivElement>(null),
    criNom: useRef<HTMLSpanElement>(null),
    criOn: useRef<HTMLSpanElement>(null),
    scene: useRef<HTMLDivElement>(null),
    vol: useRef<HTMLDivElement>(null),
    ret: useRef<HTMLDivElement>(null),
    embrase: useRef<HTMLDivElement>(null),
    copie: useRef<HTMLDivElement>(null),
    vise: useRef<HTMLSpanElement>(null),
    orbe: useRef<HTMLDivElement>(null),
    donnee: useRef<HTMLDivElement>(null),
    flash: useRef<HTMLDivElement>(null),
    dialogue: useRef<HTMLDivElement>(null),
  };
  /** État partagé entre la séquence et le toucher, hors rendu. */
  const ctl = useRef({ saute: false, phase: 'intro' as Phase, revelA: 0, attentes: new Set<() => void>(), toucher: null as null | (() => void), finVision: null as null | (() => void) });
  const rappels = useRef({ onFini, onRangement });
  rappels.current = { onFini, onRangement };

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
    }
  }, []);

  useEffect(() => {
    const clavier = (e: KeyboardEvent) => {
      const c = ctl.current;
      if (c.phase === 'vision') {
        if (e.key === 'Escape') c.finVision?.();
        return;
      }
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
    const el = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.current!])) as { [K in keyof typeof r]: NonNullable<(typeof r)[K]['current']> };
    const fx = creerEffets(el.toile, () => el.ret.getBoundingClientRect());
    // La réponse est attendue plus tard : un refus arrivé avant ne doit pas passer pour une erreur non traitée.
    demande.reponse.catch(() => undefined);
    const anims: Animation[] = [];
    const A = (cible: Element, k: Keyframe[], o: KeyframeAnimationOptions & { duration: number }) => {
      const a = cible.animate(k, { fill: 'forwards', easing: EASE, ...o, duration: calme ? 1 : o.duration });
      anims.push(a);
      return a;
    };
    const vider = () => {
      anims.forEach((a) => a.cancel());
      anims.length = 0;
    };
    const fini = (a: Animation) => a.finished.then(() => undefined, () => undefined);
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
    const deuxImages = () => new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));
    const toucher = () =>
      new Promise<void>((res) => {
        c.toucher = res;
      });
    const mettrePhase = (p: Phase) => {
      c.phase = p;
      setPhase(p);
    };
    const taper = async (t: string) => {
      if (calme || c.saute) return setBoite((b) => ({ ...b, texte: t }));
      for (let n = 1; n <= t.length; n++) {
        if (!vivant) return;
        setBoite((b) => ({ ...b, texte: t.slice(0, n) }));
        await new Promise((res) => setTimeout(res, 22));
      }
    };
    const secouer = (px: number) => {
      if (!px || calme) return;
      el.scene.animate(
        [{ transform: 'translate(0,0)' }, { transform: `translate(${-px}px, ${px * 0.6}px)` }, { transform: `translate(${px * 0.8}px, ${-px * 0.6}px)` }, { transform: `translate(${-px * 0.4}px, ${px * 0.3}px)` }, { transform: 'translate(0,0)' }],
        { duration: 220, easing: 'linear' },
      );
    };
    const traceStroke = (racine: Element, ms: number, pas = 0) =>
      racine.querySelectorAll('path').forEach((p, i) =>
        A(p, [{ strokeDasharray: '1', strokeDashoffset: '1' }, { strokeDasharray: '1', strokeDashoffset: '0' }], { duration: ms, delay: calme ? 0 : i * pas, easing: 'cubic-bezier(.2,.7,.3,1)' }),
      );
    const plusUn = (cible: Element) => {
      if (calme) return;
      const b = cible.getBoundingClientRect();
      const p = document.createElement('span');
      p.className = 'tirage-plus-un';
      p.textContent = '+1';
      p.style.left = `${b.left + b.width / 2}px`;
      p.style.top = `${b.top - 34}px`;
      document.body.append(p);
      p.animate(
        [{ opacity: 0, transform: 'translate(-50%, 10px)' }, { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.2 }, { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.75 }, { opacity: 0, transform: 'translate(-50%, -8px)' }],
        { duration: 1300, easing: 'ease-out', fill: 'forwards' },
      ).finished.finally(() => p.remove());
    };
    const versRect = (de: DOMRect, vers: DOMRect) =>
      `translate(${vers.left - de.left + (vers.width - de.width) / 2}px, ${vers.top - de.top + (vers.height - de.height) / 2}px) scale(${vers.width / de.width}) rotate(-2deg)`;
    const coin: [number, number] = [innerWidth + 90, -90];
    const finir = (f: FinLancer) => {
      if (vivant) rappels.current.onFini(f);
    };

    const revele = async (qui: string, texte: string, indice: string, refus = false) => {
      c.revelA = performance.now();
      mettrePhase('revele');
      c.saute = false;
      setBoite({ qui, refus, texte: '', indice: '' });
      el.dialogue.style.opacity = '1';
      if (!calme) el.dialogue.animate([{ transform: 'translateY(30px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: EASE });
      await taper(texte);
      setBoite((b) => ({ ...b, indice }));
    };
    /** La comète revient du coin où elle est partie, jusqu'à (x, y). */
    const retourComete = async (x: number, y: number, ms: number, easing: string, echelle = 1.3) => {
      if (!c.saute && !calme) fx.trainee(() => centre(el.orbe));
      el.orbe.style.opacity = '1';
      await fini(A(el.orbe, [{ transform: `translate(${coin[0]}px, ${coin[1]}px) scale(.55)` }, { transform: `translate(${x}px, ${y}px) scale(${echelle})` }], { duration: c.saute ? 1 : ms, easing }));
      fx.trainee(null);
      el.orbe.style.opacity = '0';
    };
    /** Les animations du départ (carte rétrécie, voile) restent posées : on les retire avant de réutiliser la carte. */
    const liberer = (...l: Element[]) => l.forEach((e) => e.getAnimations().forEach((a) => a.cancel()));

    // Fin : la nuit se lève sur la main (la carte de sort a été dépensée).
    const refermer = async (rep: ReponseSort) => {
      mettrePhase('range');
      rappels.current.onRangement();
      A(el.dialogue, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(24px)' }], { duration: 200 });
      A(el.cri, [{ opacity: 1 }, { opacity: 0 }], { duration: 220 });
      A(el.givre, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
      await fini(A(el.nuit, [{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: 'ease-in' }));
      finir({ type: 'fait', r: rep });
    };
    // La carte reçue (ou copiée) file en arc dans l'onglet Book ; la nuit se referme dessus.
    const ranger = async (rep: ReponseSort, carte: HTMLElement) => {
      mettrePhase('range');
      rappels.current.onRangement();
      const onglet = document.querySelector('.onglets [data-onglet="livre"]');
      const [tx, ty] = onglet ? centre(onglet) : [innerWidth / 2, innerHeight - 30];
      const b = carte.getBoundingClientRect();
      const dx = tx - (b.left + b.width / 2);
      const dy = ty - (b.top + b.height / 2);
      const R = Math.hypot(innerWidth, innerHeight);
      const depart = getComputedStyle(carte).transform;
      vibrer(10);
      A(el.dialogue, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(24px)' }], { duration: 200, easing: 'ease' });
      A(el.cri, [{ opacity: 1 }, { opacity: 0 }], { duration: 220 });
      A(el.lignes, [{ opacity: 0.25 }, { opacity: 0 }], { duration: 250 });
      if (carte !== el.vol) A(el.vol, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
      A(el.nuit, [{ clipPath: `circle(${R}px at ${tx}px ${ty}px)` }, { clipPath: `circle(0px at ${tx}px ${ty}px)` }], { duration: 560, delay: 80, easing: 'cubic-bezier(.6,0,.4,1)' });
      await fini(
        A(
          carte,
          [
            { transform: depart === 'none' ? 'none' : depart, easing: 'cubic-bezier(.2,.7,.3,1)' },
            { transform: `translate(${dx * 0.18}px, ${dy * 0.18 - 70}px) scale(.72) rotate(-6deg)`, offset: 0.32, easing: 'cubic-bezier(.6,0,.9,.5)' },
            { transform: `translate(${dx}px, ${dy}px) scale(${30 / b.width}) rotate(-18deg)` },
          ],
          { duration: 640, easing: 'linear' },
        ),
      );
      if (!vivant) return;
      carte.style.opacity = '0';
      if (onglet) {
        onglet.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.16)' }, { transform: 'scale(1)' }], { duration: calme ? 1 : 320, easing: EASE });
        plusUn(onglet);
      }
      finir({ type: 'fait', r: rep });
    };

    // Refus : la lumière meurt, les lettres tombent, la carte revient dans la fiche. Rien n'est dépensé.
    const eteindre = async (texte: string) => {
      c.saute = false;
      fx.fuite(0, BLEU, 0);
      vibrer([20, 60, 20]);
      A(el.criNom, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(60px) rotate(-10deg)' }], { duration: 520, easing: 'cubic-bezier(.5,0,.75,0)' });
      A(el.criOn, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(80px) rotate(14deg)' }], { duration: 560, easing: 'cubic-bezier(.5,0,.75,0)' });
      A(el.vise, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      A(el.lignes, [{ opacity: 0.9 }, { opacity: 0.15 }], { duration: 400 });
      await pause(380);
      if (!vivant) return;
      await revele('Sort refusé', texte, 'Touche l’écran pour revenir', true);
      if (!vivant) return;
      await toucher();
      if (!vivant) return;
      mettrePhase('range');
      A(el.dialogue, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(24px)' }], { duration: 200 });
      A(el.nuit, [{ opacity: 1 }, { opacity: 0 }], { duration: 360, easing: 'ease-in' });
      if (demande.depart) await fini(A(el.vol, [{ transform: 'none' }, { transform: versRect(el.vol.getBoundingClientRect(), demande.depart) }], { duration: 420, easing: 'cubic-bezier(.3,0,.2,1)' }));
      else await pause(360);
      finir({ type: 'refus' });
    };

    // La comète revient avec son butin : une carte de dos jaillit, se retourne, puis file dans le Book.
    const jouerButin = async (rep: ReponseSort) => {
      const recu = rep.recu!;
      setFace({ genre: 'designee', numero: recu.numero ?? null, nom: recu.nom ?? '?', rang: recu.rang ?? null, limite: recu.limite ?? null, texte: recu.texte ?? null });
      liberer(el.vol, el.ret, el.embrase);
      el.vol.style.opacity = '0';
      el.embrase.style.opacity = '0';
      await deuxImages();
      const [cx, cy] = centre(el.vol);
      await retourComete(cx, cy, 460, 'cubic-bezier(.2,.6,.3,1)');
      if (!vivant) return;
      if (!c.saute && !calme) {
        A(el.flash, [{ opacity: 0.6 }, { opacity: 0 }], { duration: 240, easing: 'ease-out' });
        fx.onde(cx, cy, '#ffffff', 1.2);
        fx.etincelles(cx, cy, 120, '#e8b4b6', 1);
        fx.fumee(cx, cy, 20);
        secouer(7);
        vibrer([30, 40, 20]);
      }
      el.vol.style.opacity = '1';
      A(el.vol, [{ transform: 'scale(.3)' }, { transform: 'scale(1.1)', offset: 0.6 }, { transform: 'scale(1)' }], { duration: 420 });
      A(el.ret, [{ transform: 'rotateY(900deg)' }, { transform: 'rotateY(180deg)', offset: 0.7 }, { transform: 'rotateY(0deg)' }], { duration: 900, easing: 'cubic-bezier(.12,.8,.2,1)' });
      await pause(900);
      if (!vivant) return;
      await revele('Greed Island', demande.phrase(rep), 'Touche l’écran pour la ranger dans ton Book');
      if (!vivant) return;
      await toucher();
      if (vivant) await ranger(rep, el.vol);
    };

    // La protection de la cible : la comète revient, frappe la coque d'alvéoles et s'y brise ; la coque se fend.
    const jouerMur = async (rep: ReponseSort) => {
      const [mx, my] = centre(el.mur);
      A(el.mur, [{ opacity: 0, transform: 'scale(.85)' }, { opacity: 0.95, transform: 'scale(1)' }], { duration: 320, delay: 200 });
      await retourComete(mx, my, 560, 'cubic-bezier(.4,0,.9,.6)', 1.2);
      if (!vivant) return;
      if (!c.saute && !calme) {
        A(el.flash, [{ opacity: 0.45 }, { opacity: 0 }], { duration: 200 });
        fx.etincelles(mx, my, 140, '#bfe0ff', 1.1);
        fx.onde(mx, my, '#bfe0ff', 0.9);
        secouer(9);
        vibrer([40, 50, 30]);
      }
      traceStroke(el.mur.querySelector('.feles')!, 260, 25);
      await pause(520);
      if (!vivant) return;
      A(el.mur, [{ opacity: 0.95, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.12)' }], { duration: 420, easing: 'ease-in' });
      if (!c.saute && !calme) fx.etincelles(mx, my, 80, '#ffffff', 0.5);
      setCri({ mot: 'BLOQUÉ', creux: true, centre: false });
      await deuxImages();
      A(el.criNom, [{ opacity: 0, transform: 'scale(1.8)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.5,0,.75,0)' });
      await pause(300);
      if (!vivant) return;
      await revele('Greed Island', demande.phrase(rep), 'Touche l’écran pour revenir');
      if (!vivant) return;
      await toucher();
      if (vivant) await refermer(rep);
    };

    // Gel : la comète ne revient pas ; le givre gagne les coins de l'écran, au loin la cible est prise.
    const jouerGel = async (rep: ReponseSort) => {
      traceStroke(el.givre, 900);
      A(el.givre, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
      if (!c.saute && !calme) {
        fx.onde(innerWidth - 30, 30, '#dff0ff', 0.6);
        vibrer(20);
      }
      setCri({ mot: 'GELÉ', creux: true, centre: true });
      await deuxImages();
      A(el.criNom, [{ opacity: 0, transform: 'scale(1.6)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: 300 });
      await pause(800);
      if (!vivant) return;
      await revele('Greed Island', demande.phrase(rep), 'Touche l’écran pour revenir');
      if (!vivant) return;
      await toucher();
      if (vivant) await refermer(rep);
    };

    // Voyance / Clairvoyance : la comète revient chargée de ce qu'elle a vu ; le Book de la cible s'ouvre.
    const jouerVision = async (rep: ReponseSort) => {
      const [cx, cy] = [innerWidth / 2, innerHeight * 0.45];
      await retourComete(cx, cy, 460, 'cubic-bezier(.2,.6,.3,1)', 1.4);
      if (!vivant) return;
      if (!c.saute && !calme) {
        A(el.flash, [{ opacity: 0.5 }, { opacity: 0 }], { duration: 240, easing: 'ease-out' });
        fx.onde(cx, cy, BLEU, 1.1);
        fx.etincelles(cx, cy, 90, '#cfe0ff', 0.8);
        vibrer(25);
      }
      A(el.lignes, [{ opacity: 0.25 }, { opacity: 0.12 }], { duration: 400 });
      setVision({ pages: demande.pagesVision(rep), libres: rep.sort === 'regard' });
      mettrePhase('vision');
      await new Promise<void>((res) => {
        c.finVision = res;
      });
      c.finVision = null;
      const v = el.racine.querySelector('.lancer-vision');
      if (v && vivant) A(v, [{ opacity: 1 }, { opacity: 0, transform: 'scale(.96)' }], { duration: 220 });
      if (vivant) await refermer(rep);
    };

    // Mimétisme : la boule de lumière se pose sur la carte choisie, qui apparaît puis se dédouble ; la copie file dans le Book.
    const jouerCopie = async (rep: ReponseSort, cx: number, cy: number) => {
      if (demande.carteChoisie) setFace(demande.carteChoisie);
      liberer(el.vol, el.ret, el.embrase);
      el.embrase.style.opacity = '0';
      await deuxImages();
      el.vol.style.opacity = '1';
      A(el.orbe, [{ transform: `translate(${cx}px, ${cy}px) scale(1)`, opacity: 1 }, { transform: `translate(${cx}px, ${cy}px) scale(2.6)`, opacity: 0 }], { duration: 380 });
      A(el.vol, [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.06)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 480 });
      await pause(620);
      if (!vivant) return;
      el.copie.style.opacity = '1';
      if (!c.saute && !calme) {
        A(el.flash, [{ opacity: 0.45 }, { opacity: 0 }], { duration: 220 });
        fx.etincelles(cx, cy, 90, '#ffd0d2', 0.8);
        fx.onde(cx, cy, '#ffffff', 0.8);
        vibrer(25);
      }
      A(el.vol, [{ transform: 'none' }, { transform: 'translateX(-30%) rotate(-5deg) scale(.86)' }], { duration: 520 });
      A(el.copie, [{ transform: 'none' }, { transform: 'translateX(30%) rotate(5deg) scale(.86)' }], { duration: 520 });
      await pause(620);
      if (!vivant) return;
      await revele('Greed Island', demande.phrase(rep), 'Touche l’écran pour la ranger dans ton Book');
      if (!vivant) return;
      await toucher();
      if (vivant) await ranger(rep, el.copie);
    };

    // Sans butin (rien à prendre) ou sort d'information : la réponse arrive dans la boîte du jeu.
    const jouerTexte = async (rep: ReponseSort) => {
      await revele('Greed Island', demande.phrase(rep), 'Touche l’écran pour revenir');
      if (!vivant) return;
      await toucher();
      if (vivant) await refermer(rep);
    };

    void (async () => {
      await deuxImages();
      if (!vivant) return;

      // 1. La nuit tombe (posée d'abord en style : elle reste même si une animation ne joue pas) ; la carte vient au centre.
      el.nuit.style.clipPath = 'none';
      el.nuit.style.opacity = '1';
      A(el.nuit, [{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
      A(el.lignes, [{ opacity: 0, transform: 'scale(1.4)' }, { opacity: 0.7, transform: 'scale(1)' }], { duration: 700 });
      el.vol.style.opacity = '1';
      if (demande.depart) A(el.vol, [{ transform: versRect(el.vol.getBoundingClientRect(), demande.depart) }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.3,0,.2,1)' });
      vibrer(10);
      await pause(420);
      if (!vivant) return;

      // 2. Le cri : le nom du sort frappe, puis « ON ! » ; la lumière bleue fuit des bords de la carte.
      let montee = true;
      if (!calme) {
        const t0 = performance.now();
        const monter = (t: number) => {
          if (!vivant || !montee || c.saute) return;
          const k = Math.min(1, (t - t0) / 900);
          fx.fuite(k, BLEU, 30 + k * 160);
          if (k < 1) requestAnimationFrame(monter);
        };
        requestAnimationFrame(monter);
      }
      A(el.criNom, [{ opacity: 0, transform: 'scale(2.4)' }, { opacity: 1, transform: 'scale(.95)', offset: 0.7 }, { opacity: 1, transform: 'scale(1)' }], { duration: 340, easing: 'cubic-bezier(.5,0,.75,0)' });
      await pause(260);
      if (!c.saute) {
        vibrer(18);
        secouer(4);
      }
      await pause(220);
      A(el.criOn, [{ opacity: 0, transform: 'scale(2.6) rotate(8deg)' }, { opacity: 1, transform: 'scale(.94)', offset: 0.7 }, { opacity: 1, transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(.5,0,.75,0)' });
      if (demande.cible) A(el.vise, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: 160 });
      await pause(240);
      if (!c.saute && !calme) {
        vibrer(25);
        secouer(7);
        const [x, y] = centre(el.criOn);
        fx.etincelles(x, y, 40, BLEU, 0.6);
      }
      A(el.lignes, [{ opacity: 0.7, transform: 'scale(1)' }, { opacity: 0.95, transform: 'scale(.9)' }], { duration: 600, easing: 'ease-in' });
      await pause(520);
      if (!vivant) return;

      // 3. La réponse du serveur est attendue ici.
      let rep: ReponseSort;
      try {
        rep = await demande.reponse;
      } catch (e) {
        montee = false;
        if (vivant) await eteindre(message(e));
        return;
      }
      if (!vivant) return;
      montee = false;
      fx.fuite(0, BLEU, 0);
      const issue = issueLancer(rep);

      // 4. La carte s'embrase, se ramasse en boule de lumière et part en comète.
      if (!c.saute) {
        A(el.embrase, [{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-in' });
        A(el.vol, [{ transform: 'none' }, { transform: 'scale(1.06)' }], { duration: 220, easing: 'ease-in' });
        await pause(220);
        if (!vivant) return;
      }
      const [cx, cy] = centre(el.vol);
      A(el.vol, [{ transform: 'scale(1.06)', opacity: 1 }, { transform: 'scale(.12)', opacity: 0 }], { duration: 200, easing: 'cubic-bezier(.5,0,.75,0)' });
      el.orbe.style.opacity = '1';
      A(el.orbe, [{ transform: `translate(${cx}px, ${cy}px) scale(.2)` }, { transform: `translate(${cx}px, ${cy}px) scale(1.6)`, offset: 0.6 }, { transform: `translate(${cx}px, ${cy}px) scale(1)` }], { duration: 240 });
      A(el.criNom, [{ opacity: 1 }, { opacity: 0, transform: 'scale(1.1)' }], { duration: 300, delay: 120 });
      A(el.criOn, [{ opacity: 1 }, { opacity: 0, transform: 'scale(1.1)' }], { duration: 300, delay: 120 });
      A(el.vise, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: 120 });
      const echange = demande.sort === 'echange_force' && demande.carteChoisie;
      if (echange) {
        // La carte donnée monte se fondre dans la boule de lumière.
        el.donnee.style.opacity = '1';
        A(el.donnee, [{ transform: `translate(${cx - 60}px, ${innerHeight + 20}px) rotate(-8deg)` }, { transform: `translate(${cx - 60}px, ${cy - 84}px) scale(.12) rotate(6deg)`, opacity: 0.3 }], { duration: 440, easing: 'cubic-bezier(.5,0,.75,0)' });
      }
      await pause(echange ? 460 : 240);
      if (!vivant) return;
      if (!c.saute && !calme) {
        A(el.flash, [{ opacity: 0.55 }, { opacity: 0 }], { duration: 220, easing: 'ease-out' });
        fx.onde(cx, cy, BLEU, 1);
        fx.etincelles(cx, cy, 60, '#cfe0ff', 0.7);
        vibrer(30);
      }
      if (issue === 'copie') return jouerCopie(rep, cx, cy);
      if (!c.saute && !calme) fx.trainee(() => centre(el.orbe));
      await fini(
        A(
          el.orbe,
          [
            { transform: `translate(${cx}px, ${cy}px) scale(1)` },
            { transform: `translate(${cx + (coin[0] - cx) * 0.25 - 40}px, ${cy + (coin[1] - cy) * 0.25 + 30}px) scale(.9)`, offset: 0.35 },
            { transform: `translate(${coin[0]}px, ${coin[1]}px) scale(.55)` },
          ],
          { duration: c.saute ? 1 : 520, easing: 'cubic-bezier(.55,0,.8,.4)' },
        ),
      );
      fx.trainee(null);
      if (!vivant) return;
      A(el.lignes, [{ opacity: 0.95 }, { opacity: 0.25 }], { duration: 400 });
      await pause(380);
      if (!vivant) return;

      // 5. L'issue.
      if (issue === 'mur') return jouerMur(rep);
      if (issue === 'gel') return jouerGel(rep);
      if (issue === 'vision') return jouerVision(rep);
      if (issue === 'butin') return jouerButin(rep);
      return jouerTexte(rep);
    })();

    return () => {
      vivant = false;
      [...c.attentes].forEach((f) => f());
      c.toucher?.();
      c.finVision?.();
      vider();
      fx.arreter();
    };
    // une demande = une séquence (la clé du composant change avec la demande)
  }, []);

  const choisie = demande.carteChoisie;
  return (
    <div ref={r.racine} className={`lancer ${phase}`} role="dialog" aria-modal="true" aria-label={`Lancer ${demande.nomSort}`} onPointerDown={surToucher}>
      <div ref={r.nuit} className="lancer-nuit" />
      <div ref={r.lignes} className="lancer-lignes">
        <Concentration graine={23} />
      </div>
      <div ref={r.givre} className="lancer-givre" aria-hidden="true">
        {COINS_GIVRE.map((k) => (
          <svg key={k} className={k} viewBox="0 0 100 100">
            <path pathLength={1} d={GIVRE} strokeWidth={1.4} />
            <path pathLength={1} d={GIVRE} strokeWidth={5} opacity={0.18} />
          </svg>
        ))}
      </div>
      <canvas ref={r.toile} className="lancer-toile" aria-hidden="true" />
      <div ref={r.mur} className="lancer-mur" aria-hidden="true">
        <svg viewBox="-70 -70 140 140">
          <defs>
            <radialGradient id="lancer-mur-g">
              <stop offset="0" stopColor="#cfe6ff" stopOpacity=".05" />
              <stop offset=".75" stopColor="#9fd0ff" stopOpacity=".22" />
              <stop offset="1" stopColor="#9fd0ff" stopOpacity=".5" />
            </radialGradient>
          </defs>
          <circle r="64" fill="url(#lancer-mur-g)" />
          <g fill="none" stroke="#bfe0ff" strokeWidth=".8" opacity=".85">
            {ALVEOLES.map((pts, i) => (
              <polygon key={i} points={pts} />
            ))}
          </g>
          <circle r="64" fill="none" stroke="#e8f4ff" strokeWidth="1.6" />
          <g className="feles" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            {FELURES.map((d) => (
              <path key={d} pathLength={1} d={d} strokeDasharray="1" strokeDashoffset="1" />
            ))}
          </g>
        </svg>
      </div>
      <div ref={r.cri} className={`lancer-cri${cri.creux ? ' creux' : ''}${cri.centre ? ' centre' : ''}`} aria-hidden="true">
        <span ref={r.criNom} style={{ ['--taille' as string]: tailleCri(cri.mot) }}>
          {cri.mot}
        </span>
        <span ref={r.criOn} className="on">
          ON !
        </span>
      </div>
      <div ref={r.scene} className="lancer-scene">
        <div ref={r.vol} className="lancer-vol">
          <div ref={r.ret} className="lancer-retourne">
            <Carte {...face} />
            <DosCarte />
            <div ref={r.embrase} className="lancer-embrase" />
          </div>
        </div>
        <div ref={r.copie} className="lancer-vol lancer-copie">
          {choisie && <Carte {...choisie} />}
        </div>
      </div>
      <span ref={r.vise} className="lancer-vise" aria-hidden="true">
        {demande.cible ? `→ ${demande.cible}` : ''}
      </span>
      <div ref={r.orbe} className="lancer-orbe" aria-hidden="true" />
      <div ref={r.donnee} className="lancer-donnee" aria-hidden="true">
        {demande.sort === 'echange_force' && choisie && <Carte {...choisie} />}
      </div>
      <div ref={r.flash} className="lancer-flash" />
      {vision && (
        <Vision
          titre={`${demande.nomSort} · Book de ${demande.cible ?? '?'}`}
          cible={demande.cible ?? '?'}
          libres={vision.libres}
          places={demande.placesLibres}
          pages={vision.pages}
          onFermer={() => ctl.current.finVision?.()}
        />
      )}
      <div ref={r.dialogue} className="gi-dialogue lancer-dialogue">
        <span className={`a-qui${boite.refus ? ' refus' : ''}`}>{boite.qui}</span>
        <p className="a-texte" aria-hidden="true">
          {boite.texte}
        </p>
        <p className={`a-indice${boite.indice ? ' visible' : ''}`}>{boite.indice}</p>
      </div>
      <p className="sr" aria-live="polite">
        {phase === 'revele' && boite.indice ? boite.texte : ''}
      </p>
      <span className="lancer-passer" aria-hidden="true">
        Touche pour passer
      </span>
    </div>
  );
}
