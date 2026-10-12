// Cinématique d'un pouvoir de Nen (page ⑩ ; prototype validé par Sivraj le 2026-10-12 : docs/prototype/pouvoirs-nen.html).
// Elle reste sur la planche (papier, encre, lignes de vitesse) : le médaillon de ton type frappe, l'aura jaillit en
// flammes cernées d'encre (rappel de la divination), le nom du pouvoir est crié. La requête est partie au toucher du
// bouton (P1) : la réponse du serveur est attendue après le cri ; un refus éteint l'aura. Puis la scène du pouvoir :
// l'encre coule et redessine la carte (Texture Surprise), le cercle de transmutation (Alchimie ; une contrefaçon tombe
// en poussière), la lame (L'épée du vol ; le Mur défensif l'arrête), l'aura s'éteint et le décompte commence (Zetsu),
// la pièce frappée d'un « +1 » (Fortune), les deux cartes se croisent (Échange forcé). Toucher pendant le cri saute.
import type { NenType } from '@gq/shared';
import { Carte, Concentration, DosCarte } from '@gq/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NENS } from '../../lib/format';
import { CASES } from '../../lib/pouvoir';
import { PieceFortune } from './CaseNen';
import { minSec } from './FicheSort';
import type { CarteVue } from './Lancer';

export type ScenePouvoir =
  | { cle: 'transformation'; doublon: CarteVue; apparence: CarteVue }
  | { cle: 'alchimie'; doublon: CarteVue }
  | { cle: 'bandit'; cible: string }
  | { cle: 'manipulation'; donnee: CarteVue; cible: string }
  | { cle: 'zetsu'; dureeMs: number | null }
  | { cle: 'fortune' };

/** Réponse du serveur, mise en mots par la fiche. */
export interface IssuePouvoir {
  phrase: string;
  /** Refus (RG-7.4) : rien n'est dépensé. */
  refus?: string;
  /** Alchimie ou Texture Surprise sur une contrefaçon. */
  echec?: boolean;
  /** L'épée arrêtée par une protection ; rien à prendre. */
  bloque?: boolean;
  vide?: boolean;
  /** Carte obtenue (Alchimie, épée, échange) : elle part dans le Book. */
  obtenue?: CarteVue | null;
  /** Légende sous la carte (« Prise à Kirua »). */
  tag?: string;
}

export interface DemandePouvoir {
  nen: NenType;
  scene: ScenePouvoir;
  reponse: Promise<IssuePouvoir>;
}

type Face = CarteVue | 'dos' | null;
const EASE = 'cubic-bezier(.16,1,.3,1)';
const vibrer = (p: number | number[]) => navigator.vibrate?.(p);
const centre = (el: Element): [number, number] => {
  const b = el.getBoundingClientRect();
  return [b.left + b.width / 2, b.top + b.height / 2];
};
/** Le cri, coupé en lignes courtes pour rester grand. */
function lignesCri(nom: string): { lignes: string[]; taille: string } {
  const l: string[] = [];
  for (const m of nom.toUpperCase().split(' ')) {
    const der = l.at(-1);
    if (der && `${der} ${m}`.length <= 8) l[l.length - 1] = `${der} ${m}`;
    else l.push(m);
  }
  const plus = Math.max(...l.map((x) => x.length));
  return { lignes: l, taille: `${Math.min(104, (Math.min(innerWidth, 480) * 0.9) / (plus * 0.86 + 0.3)).toFixed(0)}px` };
}
// Coulure de Texture Surprise : l'aplat d'aura descend, bord du bas en gouttes.
const COULURE = 'M0 0H100V196C96 196 95 214 91 214S86 188 82 188 78 222 72 222 67 192 61 192 57 206 52 206 47 186 42 186 38 226 31 226 26 194 21 194 17 210 12 210 6 190 0 190Z';
// Cercle de transmutation : deux cercles, l'étoile à six branches, six petits cercles.
const TRIANGLES = [-Math.PI / 2, Math.PI / 2].map((rot) => {
  const p = Array.from({ length: 3 }, (_, i) => {
    const a = rot + (i * 2 * Math.PI) / 3;
    return `${(Math.cos(a) * 80).toFixed(1)} ${(Math.sin(a) * 80).toFixed(1)}`;
  });
  return `M${p.join('L')}Z`;
});
const PETITS = Array.from({ length: 6 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 3;
  return [Math.cos(a) * 88, Math.sin(a) * 88] as const;
});

// Aura : une langue de flamme par angle, plus longue vers le haut, balayée par le vent.
const N = 17;
const PHASES = Array.from({ length: N }, (_, i) => [Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1), 0.7 + ((i * 0.37) % 0.6)] as const);
function langues(g: CanvasRenderingContext2D, t: number, x: number, y: number, R: number, amp: number, k: number) {
  g.beginPath();
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + t * 0.00018;
    const [ph, f] = PHASES[i]!;
    const haut = Math.max(0, -Math.sin(a));
    const len = R * amp * k * (0.38 + 0.3 * Math.sin(t * 0.007 * f + ph * 6.28) + 0.22 * Math.sin(t * 0.013 * f + i)) * (1 + 1.1 * haut);
    const d = (Math.PI / N) * 1.25;
    const sway = Math.sin(t * 0.005 * f + ph * 9) * 0.25;
    g.moveTo(x + Math.cos(a - d) * R * 0.92, y + Math.sin(a - d) * R * 0.92);
    g.quadraticCurveTo(x + Math.cos(a - d * 0.4) * (R + len * 0.55), y + Math.sin(a - d * 0.4) * (R + len * 0.55) - len * 0.1, x + Math.cos(a + sway) * (R + len), y + Math.sin(a + sway) * (R + len) - len * 0.45);
    g.quadraticCurveTo(x + Math.cos(a + d * 0.9) * (R + len * 0.45), y + Math.sin(a + d * 0.9) * (R + len * 0.45) - len * 0.1, x + Math.cos(a + d) * R * 0.92, y + Math.sin(a + d) * R * 0.92);
    g.closePath();
  }
  g.moveTo(x + R, y);
  g.arc(x, y, R, 0, Math.PI * 2);
}

type Phase = 'intro' | 'revele' | 'sortie';

export function Pouvoir({ demande, onFini }: { demande: DemandePouvoir; onFini: (i: IssuePouvoir | null) => void }) {
  const calme = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches).current;
  const { nen, scene } = demande;
  const nom = CASES[scene.cle].nom;
  const cri = lignesCri(nom);
  const [faceA, setFaceA] = useState<Face>(null);
  const [faceB, setFaceB] = useState<Face>(null);
  const [tag, setTag] = useState('');
  const [boite, setBoite] = useState({ qui: 'Greed Island', refus: false, texte: '', indice: '' });
  const [phase, setPhase] = useState<Phase>('intro');
  const [etat, setEtat] = useState({ creux: false, gris: false, trame: false, felee: false });
  const r = {
    racine: useRef<HTMLDivElement>(null),
    fond: useRef<HTMLDivElement>(null),
    lignes: useRef<HTMLDivElement>(null),
    toile: useRef<HTMLCanvasElement>(null),
    medaille: useRef<HTMLDivElement>(null),
    cri: useRef<HTMLDivElement>(null),
    scene: useRef<HTMLDivElement>(null),
    porte: useRef<HTMLDivElement>(null),
    carteA: useRef<HTMLDivElement>(null),
    carteB: useRef<HTMLDivElement>(null),
    coulure: useRef<SVGSVGElement>(null),
    cercle: useRef<SVGSVGElement>(null),
    tag: useRef<HTMLSpanElement>(null),
    mur: useRef<HTMLDivElement>(null),
    lame: useRef<SVGSVGElement>(null),
    piece: useRef<HTMLDivElement>(null),
    frappe: useRef<HTMLDivElement>(null),
    onomato: useRef<HTMLSpanElement>(null),
    zetsu: useRef<HTMLDivElement>(null),
    flash: useRef<HTMLDivElement>(null),
    dialogue: useRef<HTMLDivElement>(null),
  };
  const ctl = useRef({ saute: false, phase: 'intro' as Phase, revelA: 0, attentes: new Set<() => void>(), toucher: null as null | (() => void) });
  const rappel = useRef(onFini);
  rappel.current = onFini;

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
    demande.reponse.catch(() => undefined);
    const couleur = getComputedStyle(document.documentElement).getPropertyValue(`--nen-${nen}`).trim() || '#ffd24a';
    const anims: Animation[] = [];
    const A = (cible: Element, k: Keyframe[], o: KeyframeAnimationOptions & { duration: number }) => {
      const a = cible.animate(k, { fill: 'forwards', easing: EASE, ...o, duration: calme ? 1 : o.duration });
      anims.push(a);
      return a;
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
    const secouer = (cible: Element, px: number) => {
      if (!px || calme || c.saute) return;
      cible.animate([{ translate: '0 0' }, { translate: `${-px}px ${px * 0.6}px` }, { translate: `${px * 0.8}px ${-px * 0.6}px` }, { translate: `${-px * 0.4}px ${px * 0.3}px` }, { translate: '0 0' }], { duration: 220, easing: 'linear' });
    };
    const taper = async (t: string) => {
      if (calme || c.saute) return setBoite((b) => ({ ...b, texte: t }));
      for (let n = 1; n <= t.length; n++) {
        if (!vivant) return;
        setBoite((b) => ({ ...b, texte: t.slice(0, n) }));
        await new Promise((res) => setTimeout(res, 20));
      }
    };
    const dire = async (texte: string, qui = 'Greed Island', refus = false) => {
      c.phase = 'revele';
      setPhase('revele');
      c.saute = false;
      setBoite({ qui, refus, texte: '', indice: '' });
      el.dialogue.style.opacity = '1';
      if (!calme) el.dialogue.animate([{ transform: 'translateY(14px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 280, easing: EASE });
      await taper(texte);
      c.revelA = performance.now();
      setBoite((b) => ({ ...b, indice: 'Touche pour fermer' }));
      await toucher();
    };
    const montrerTag = (t: string) => {
      setTag(t);
      el.tag.style.opacity = '1';
      A(el.tag, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 260 });
    };

    // ---------- Toile : l'aura et les miettes ----------
    const g = el.toile.getContext('2d')!;
    const dpr = Math.min(1.5, devicePixelRatio || 1);
    const taille = () => {
      el.toile.width = innerWidth * dpr;
      el.toile.height = innerHeight * dpr;
    };
    taille();
    addEventListener('resize', taille);
    const aura = { amp: 0, cible: 0, gris: false };
    type Miette = { x: number; y: number; vx: number; vy: number; gr: number; s: number; v: number; c: string; bord: boolean };
    let miettes: Miette[] = [];
    let image = 0;
    const boucle = (t: number) => {
      image = 0;
      if (!vivant) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, innerWidth, innerHeight);
      aura.amp += (aura.cible - aura.amp) * 0.08;
      if (aura.amp > 0.01) {
        const b = el.medaille.getBoundingClientRect();
        const [x, y, R] = [b.left + b.width / 2, b.top + b.height / 2, b.width / 2];
        // Contour d'encre tracé d'abord, recouvert par l'aplat : seul le bord extérieur reste.
        langues(g, t, x, y, R, aura.amp, 1);
        g.lineJoin = 'round';
        g.lineWidth = 7;
        g.strokeStyle = '#111';
        g.stroke();
        g.fillStyle = aura.gris ? '#c9cac4' : couleur;
        g.fill();
        langues(g, t + 900, x, y, R * 0.98, aura.amp, 0.55);
        g.fillStyle = 'rgba(255,255,255,0.55)';
        g.fill();
      }
      miettes = miettes.filter((m) => (m.v -= 0.016) > 0);
      for (const m of miettes) {
        m.x += m.vx;
        m.y += m.vy;
        m.vy += m.gr;
        g.globalAlpha = Math.min(1, m.v * 2);
        g.fillStyle = m.c;
        g.strokeStyle = '#111';
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(m.x, m.y, m.s, 0, Math.PI * 2);
        g.fill();
        if (m.bord) g.stroke();
      }
      g.globalAlpha = 1;
      if (aura.amp > 0.01 || aura.cible > 0 || miettes.length) image = requestAnimationFrame(boucle);
    };
    const relancer = () => {
      if (!image && !calme) image = requestAnimationFrame(boucle);
    };
    const eclats = (x: number, y: number, n: number, col: string, force = 1) => {
      if (calme || c.saute) return;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = (1.5 + Math.random() * 5) * force;
        miettes.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, gr: 0.06, s: 2 + Math.random() * 4, v: 0.6 + Math.random() * 0.5, c: col, bord: true });
      }
      relancer();
    };
    const auraVers = (v: number) => {
      aura.cible = v;
      relancer();
    };

    // ---------- Les scènes ----------
    const entrerCarte = async () => {
      el.porte.style.opacity = '1';
      await fini(A(el.porte, [{ transform: 'translateY(40px) rotate(-3deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420 }));
    };
    const retourner = async (cible: Element, apres: () => void) => {
      await fini(A(cible, [{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg)' }], { duration: 160, easing: 'ease-in' }));
      apres();
      await deuxImages();
      await fini(A(cible, [{ transform: 'rotateY(-90deg)' }, { transform: 'rotateY(0)' }], { duration: 260 }));
    };

    const texture = async (s: Extract<ScenePouvoir, { cle: 'transformation' }>, i: IssuePouvoir) => {
      setFaceA(s.doublon);
      setFaceB(s.apparence);
      await deuxImages();
      el.carteB.style.opacity = '0';
      await entrerCarte();
      await pause(250);
      el.coulure.style.opacity = '1';
      vibrer(12);
      if (i.echec) {
        // L'encre ne prend pas sur une contrefaçon : elle s'arrête à mi-carte, la carte se fend et perd ses couleurs.
        await fini(A(el.coulure, [{ transform: 'translateY(0)' }, { transform: 'translateY(45%)' }], { duration: 600, easing: 'cubic-bezier(.55,0,.7,.4)' }));
        secouer(el.porte, 7);
        vibrer([30, 40, 30]);
        setEtat((e) => ({ ...e, felee: true }));
        A(el.coulure, [{ opacity: 1 }, { opacity: 0 }], { duration: 500 });
        auraVers(0.3);
        await pause(600);
        return dire(i.phrase, 'Échec', true);
      }
      await fini(A(el.coulure, [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], { duration: 950, easing: 'cubic-bezier(.55,0,.7,.4)' }));
      el.carteA.style.opacity = '0';
      el.carteB.style.opacity = '1';
      await pause(150);
      await fini(A(el.coulure, [{ transform: 'translateY(100%)' }, { transform: 'translateY(205%)' }], { duration: 750, easing: 'cubic-bezier(.3,.6,.4,1)' }));
      eclats(...centre(el.porte), 20, couleur, 0.8);
      vibrer(20);
      montrerTag(i.tag ?? '');
      await dire(i.phrase);
    };

    const alchimie = async (s: Extract<ScenePouvoir, { cle: 'alchimie' }>, i: IssuePouvoir) => {
      setFaceA(s.doublon);
      setFaceB('dos');
      await deuxImages();
      el.carteB.style.opacity = '0';
      await entrerCarte();
      await pause(250);
      el.cercle.style.opacity = '1';
      el.cercle.querySelectorAll('.tr').forEach((p, k) => A(p, [{ strokeDashoffset: '1' }, { strokeDashoffset: '0' }], { duration: 700, delay: calme ? 0 : k * 70, easing: 'cubic-bezier(.3,0,.2,1)' }));
      await pause(900);
      vibrer(15);
      // La carte s'enfonce dans le cercle : elle descend, son bas disparaît sous la ligne.
      const fondre = (jusqua: number, ms: number) =>
        A(el.porte, [{ transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)' }, { transform: `translateY(${jusqua}%)`, clipPath: `inset(0 0 ${jusqua}% 0)` }], { duration: ms, easing: 'cubic-bezier(.5,0,.75,0)' });
      if (i.echec) {
        await fini(fondre(38, 700));
        // L'alchimie bute : la fausse carte se fend, perd ses couleurs et tombe en poussière.
        secouer(el.porte, 7);
        vibrer([30, 40, 30]);
        setEtat((e) => ({ ...e, felee: true }));
        el.cercle.querySelectorAll('.tr').forEach((p) => A(p, [{ opacity: 1 }, { opacity: 0.15 }], { duration: 700 }));
        await pause(700);
        const b = el.porte.getBoundingClientRect();
        if (!calme) for (let k = 0; k < 70; k++) miettes.push({ x: b.left + Math.random() * b.width, y: b.top + Math.random() * b.height * 0.62, vx: (Math.random() - 0.5) * 1.6, vy: Math.random() * 0.6, gr: 0.16, s: 1.5 + Math.random() * 3, v: 0.7 + Math.random() * 0.6, c: '#8e8f8a', bord: false });
        relancer();
        A(el.porte, [{ opacity: 1 }, { opacity: 0 }], { duration: 380 });
        auraVers(0.3);
        await pause(600);
        return dire(i.phrase, 'Échec', true);
      }
      await fini(fondre(100, 900));
      if (!calme && !c.saute) A(el.flash, [{ opacity: 0.6 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
      eclats(...centre(el.cercle), 34, '#ffd24a', 1.2);
      vibrer(30);
      // La carte voulue remonte du cercle, de dos, puis se retourne.
      el.carteA.style.opacity = '0';
      el.carteB.style.opacity = '1';
      await fini(A(el.porte, [{ transform: 'translateY(100%)', clipPath: 'inset(0 0 100% 0)' }, { transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)' }], { duration: 760 }));
      await retourner(el.porte, () => setFaceB(i.obtenue ?? null));
      el.cercle.querySelectorAll('.tr').forEach((p) => A(p, [{ opacity: 1 }, { opacity: 0.25 }], { duration: 600 }));
      montrerTag(i.tag ?? '');
      await dire(i.phrase);
    };

    const bandit = async (_s: Extract<ScenePouvoir, { cle: 'bandit' }>, i: IssuePouvoir) => {
      const W = innerWidth;
      const H = innerHeight;
      const L = Math.hypot(W + 80, H * 0.38);
      el.lame.setAttribute('viewBox', `0 0 ${W} ${H}`);
      el.lame.querySelectorAll('path').forEach((p) => {
        p.setAttribute('d', `M${W + 40} ${H * 0.36}L-40 ${H * 0.74}`);
        p.style.strokeDasharray = `${L}`;
        p.style.strokeDashoffset = `${L}`;
      });
      el.lame.style.opacity = '1';
      if (i.bloque) {
        // La lame bute sur la protection de la cible : elle s'arrête au milieu, le mur se fend.
        el.mur.style.opacity = '1';
        A(el.mur, [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 260 });
        await pause(200);
        el.lame.querySelectorAll('path').forEach((p) => A(p, [{ strokeDashoffset: `${L}` }, { strokeDashoffset: `${L * 0.5}` }], { duration: 170, easing: 'cubic-bezier(.5,0,1,1)' }));
        await pause(170);
        secouer(el.mur, 9);
        vibrer([40, 30, 40]);
        eclats(W / 2, H * 0.55, 30, '#8fb2ff', 1.3);
        A(el.lame, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 120 });
        await pause(500);
        return dire(i.phrase);
      }
      el.lame.querySelectorAll('path').forEach((p) => A(p, [{ strokeDashoffset: `${L}` }, { strokeDashoffset: '0' }], { duration: 170, easing: 'cubic-bezier(.5,0,1,1)' }));
      await pause(170);
      if (!calme && !c.saute) A(el.flash, [{ opacity: 0.5 }, { opacity: 0 }], { duration: 260 });
      secouer(el.fond, 10);
      vibrer(35);
      A(el.lame, [{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: 160 });
      if (i.vide || !i.obtenue) {
        await pause(500);
        return dire(i.phrase);
      }
      setFaceA('dos');
      await deuxImages();
      el.porte.style.opacity = '1';
      eclats(W / 2, H * 0.55, 24, couleur, 1);
      await fini(A(el.porte, [{ transform: 'scale(.2) rotate(-30deg)', opacity: 0 }, { transform: 'scale(1.05) rotate(4deg)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 440 }));
      await retourner(el.porte, () => setFaceA(i.obtenue ?? null));
      montrerTag(i.tag ?? '');
      await dire(i.phrase);
    };

    const echange = async (s: Extract<ScenePouvoir, { cle: 'manipulation' }>, i: IssuePouvoir) => {
      setFaceA(s.donnee);
      setFaceB('dos');
      await deuxImages();
      el.carteB.style.opacity = '0';
      await entrerCarte();
      await pause(200);
      if (i.bloque || i.vide || !i.obtenue) {
        secouer(el.porte, 7);
        await pause(300);
        return dire(i.phrase);
      }
      await fini(A(el.carteA, [{ transform: 'none' }, { transform: `translateX(${innerWidth}px) rotate(18deg)` }], { duration: 420, easing: 'cubic-bezier(.5,0,.75,0)' }));
      el.carteB.style.opacity = '1';
      vibrer(20);
      await fini(A(el.carteB, [{ transform: `translateX(${-innerWidth}px) rotate(-18deg)` }, { transform: 'none' }], { duration: 440 }));
      await retourner(el.carteB, () => setFaceB(i.obtenue ?? null));
      montrerTag(i.tag ?? '');
      await dire(i.phrase);
    };

    const zetsu = async (s: Extract<ScenePouvoir, { cle: 'zetsu' }>) => {
      auraVers(0);
      await pause(500);
      aura.gris = true;
      setEtat((e) => ({ ...e, gris: true, creux: true, trame: true }));
      A(el.lignes, [{ opacity: 0.85 }, { opacity: 0 }], { duration: 900 });
      vibrer([10, 80, 10]);
      await pause(700);
      if (s.dureeMs) {
        el.zetsu.style.opacity = '1';
        A(el.zetsu, [{ opacity: 0, transform: 'translate(-50%, -50%) scale(.9)' }, { opacity: 1, transform: 'translate(-50%, -50%)' }], { duration: 400 });
      }
      await dire('Personne ne peut plus te viser ni te voir. Lancer un sort offensif ou proposer un échange le rompt.');
    };

    const fortune = async () => {
      el.piece.style.opacity = '1';
      await fini(
        A(
          el.piece,
          [
            { transform: `translateY(${-innerHeight * 0.6}px) rotateY(0)` },
            { transform: 'translateY(0) rotateY(1440deg) scale(1, .86)', offset: 0.82 },
            { transform: 'translateY(-14px) rotateY(1440deg) scale(1)', offset: 0.92 },
            { transform: 'translateY(0) rotateY(1440deg)' },
          ],
          { duration: 1100, easing: 'cubic-bezier(.4,0,.6,1)' },
        ),
      );
      vibrer(30);
      el.onomato.style.opacity = '1';
      A(el.onomato, [{ opacity: 0, transform: 'translate(0%, -230%) rotate(-10deg) scale(1.6)' }, { opacity: 1, transform: 'translate(2%, -245%) rotate(-10deg) scale(1)' }], { duration: 260 });
      eclats(...centre(el.piece), 22, '#e2bd4f', 1);
      await pause(380);
      el.frappe.style.opacity = '1';
      A(el.frappe, [{ opacity: 0, transform: 'scale(2.2) rotate(-14deg)' }, { opacity: 1, transform: 'scale(1) rotate(-8deg)' }], { duration: 240, easing: 'cubic-bezier(.5,0,.75,0)' });
      await pause(240);
      secouer(el.piece, 6);
      vibrer(25);
      await dire('Ton prochain scan réussi donne un gain de plus. La pièce t’attend sur le Scanner.');
    };

    // 5. La planche revient ; la pièce de Fortune s'envole vers le Scanner, la carte obtenue vers le Book.
    const sortir = async (i: IssuePouvoir | null) => {
      if (!vivant) return;
      c.phase = 'sortie';
      setPhase('sortie');
      auraVers(0);
      const onglet = (id: string) => document.querySelector(`.onglets [data-onglet="${id}"]`)?.getBoundingClientRect();
      const fondu = A(el.racine, [{ opacity: 1 }, { opacity: 0 }], { duration: 360, delay: 160 });
      if (i && scene.cle === 'fortune' && !calme) {
        const vers = onglet('scan');
        const de = el.piece.getBoundingClientRect();
        if (vers) await fini(A(el.piece, [{ transform: 'none' }, { transform: `translate(${vers.left + vers.width / 2 + 6 + 15 - (de.left + de.width / 2)}px, ${vers.top + 18 - (de.top + de.height / 2)}px) scale(${30 / de.width})` }], { duration: 560, easing: 'cubic-bezier(.5,0,.3,1)' }));
      } else if (i?.obtenue && !calme) {
        const vers = onglet('livre');
        const de = el.porte.getBoundingClientRect();
        if (vers) await fini(A(el.porte, [{ transform: 'none' }, { transform: `translate(${vers.left + vers.width / 2 - (de.left + de.width / 2)}px, ${vers.top - (de.top + de.height / 2)}px) scale(.12) rotate(10deg)` }], { duration: 520, easing: 'cubic-bezier(.5,0,.75,0)' }));
      }
      await fini(fondu);
      if (vivant) rappel.current(i);
    };

    // ---------- La séquence ----------
    void (async () => {
      relancer();
      // 1. La planche se vide, les lignes de vitesse convergent ; le médaillon frappe, l'aura jaillit.
      el.fond.style.opacity = '1';
      A(el.fond, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
      A(el.lignes, [{ opacity: 0, transform: 'scale(1.5)' }, { opacity: 0.85, transform: 'scale(1)' }], { duration: 600 });
      el.medaille.style.opacity = '1';
      A(el.medaille, [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.65 }, { transform: 'scale(1)', opacity: 1 }], { duration: 420 });
      await pause(200);
      auraVers(1);
      vibrer(15);
      await pause(320);
      // 2. Le nom du pouvoir, crié.
      const mots = [...el.cri.children];
      mots.forEach((m, k) => A(m, [{ opacity: 0, transform: 'scale(2.4)' }, { opacity: 1, transform: 'scale(.95)', offset: 0.7 }, { opacity: 1, transform: 'scale(1)' }], { duration: 300, delay: calme ? 0 : k * 140, easing: 'cubic-bezier(.5,0,.75,0)' }));
      await pause(260 + (mots.length - 1) * 140);
      vibrer(25);
      secouer(el.cri, 6);
      eclats(...centre(el.medaille), 26, couleur, 1.1);
      await pause(620);

      // 3. La réponse du serveur. Un refus éteint l'aura : rien n'est dépensé.
      const i = await demande.reponse.catch((e: unknown): IssuePouvoir => ({ refus: e instanceof Error ? e.message : String(e), phrase: '' }));
      if (!vivant) return;
      if (i.refus) {
        auraVers(0);
        setEtat((e) => ({ ...e, creux: true }));
        A(el.medaille, [{ transform: 'none', opacity: 1 }, { transform: 'scale(.9)', opacity: 0.35 }], { duration: 500 });
        await pause(300);
        await dire(i.refus, 'Refusé', true);
        return sortir(null);
      }
      // 4. Le médaillon monte en haut de la planche, l'aura le suit ; la scène du pouvoir commence.
      if (scene.cle !== 'zetsu') {
        mots.forEach((m) => A(m, [{ opacity: 1 }, { opacity: 0, transform: 'scale(1.08)' }], { duration: 260 }));
        A(el.medaille, [{ transform: 'none' }, { transform: `translateY(${Math.max(70, innerHeight * 0.13) - innerHeight * 0.3}px) scale(.5)` }], { duration: 480 });
        auraVers(0.7);
        await pause(380);
      }
      if (scene.cle === 'transformation') await texture(scene, i);
      else if (scene.cle === 'alchimie') await alchimie(scene, i);
      else if (scene.cle === 'bandit') await bandit(scene, i);
      else if (scene.cle === 'manipulation') await echange(scene, i);
      else if (scene.cle === 'zetsu') await zetsu(scene);
      else await fortune();
      await sortir(i);
    })();

    return () => {
      vivant = false;
      cancelAnimationFrame(image);
      removeEventListener('resize', taille);
      anims.forEach((a) => a.cancel());
    };
  }, []);

  const face = (f: Face) => (f === 'dos' ? <DosCarte /> : f ? <Carte {...f} /> : null);
  return (
    <div
      ref={r.racine}
      className={`pouvoir${phase === 'intro' ? ' intro' : ''}`}
      style={{ ['--aura' as string]: `var(--nen-${nen})` }}
      onPointerDown={surToucher}
      role="dialog"
      aria-modal="true"
      aria-label={`Pouvoir : ${nom}`}
    >
      <div ref={r.fond} className={`pouvoir-fond${etat.trame ? ' trame' : ''}`} />
      <div ref={r.lignes} className="pouvoir-lignes">
        <Concentration graine={11} />
      </div>
      <canvas ref={r.toile} className="pouvoir-toile" />
      <div ref={r.medaille} className={`pouvoir-medaille${etat.gris ? ' gris' : ''}`} aria-hidden="true">
        <span className={NENS[nen].court.length > 2 ? 'long' : ''}>{NENS[nen].court}</span>
      </div>
      <div ref={r.cri} className={`pouvoir-cri${etat.creux ? ' creux' : ''}`} aria-hidden="true">
        {cri.lignes.map((l) => (
          <span key={l} style={{ ['--taille' as string]: cri.taille }}>
            {l}
          </span>
        ))}
      </div>
      <div ref={r.scene} className="pouvoir-scene">
        <div ref={r.porte} className={`pouvoir-porte${etat.felee ? ' felee' : ''}`}>
          <div ref={r.carteA}>{face(faceA)}</div>
          <div ref={r.carteB}>{face(faceB)}</div>
          <div className="pouvoir-coulure">
            <svg ref={r.coulure} viewBox="0 0 100 230" preserveAspectRatio="none" aria-hidden="true">
              <path d={COULURE} fill="var(--aura)" stroke="#111" strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
              <path d="M0 22C14 30 22 14 38 24S66 30 80 18 96 26 100 22V0H0Z" fill="#fff" opacity=".35" />
            </svg>
          </div>
          {etat.felee && (
            <svg className="pouvoir-feles" viewBox="0 0 63 88" aria-hidden="true">
              <path d="M30 0l-4 14 7 6-6 12 8 9-5 14M33 20l12 4M27 32l-14 3M34 41l11 9" />
            </svg>
          )}
        </div>
        <div className="pouvoir-cercle">
          <svg ref={r.cercle} viewBox="-100 -100 200 200" aria-hidden="true">
            <circle r="96" fill="#ffd24a" opacity=".35" />
            <g fill="none" stroke="#111" strokeLinecap="round">
              <circle className="tr" r="94" strokeWidth="3.5" pathLength={1} />
              <circle className="tr" r="82" strokeWidth="1.6" pathLength={1} />
              {TRIANGLES.map((d) => (
                <path key={d} className="tr" d={d} strokeWidth="2.4" pathLength={1} />
              ))}
              <circle className="tr" r="38" strokeWidth="2" pathLength={1} />
              {PETITS.map(([x, y]) => (
                <circle key={`${x}`} className="tr" cx={x} cy={y} r="7" strokeWidth="2" fill="#fbfbf7" pathLength={1} />
              ))}
            </g>
          </svg>
        </div>
        <span ref={r.tag} className="pouvoir-tag">
          {tag}
        </span>
      </div>
      <div ref={r.mur} className="pouvoir-mur" aria-hidden="true">
        <svg viewBox="-100 -100 200 200">
          <path d="M0-92 80-46V46L0 92-80 46V-46Z" fill="rgba(143,178,255,.22)" stroke="#1f4a9c" strokeWidth="5" />
          <path d="M0-92 80-46V46L0 92-80 46V-46Z" fill="none" stroke="#111" strokeWidth="2" transform="scale(1.06)" />
        </svg>
      </div>
      <svg ref={r.lame} className="pouvoir-lame" aria-hidden="true">
        <path stroke="var(--aura)" strokeWidth="30" strokeLinecap="round" opacity=".55" />
        <path stroke="#111" strokeWidth="15" strokeLinecap="round" />
        <path stroke="#fff" strokeWidth="7" strokeLinecap="round" />
      </svg>
      <div ref={r.piece} className="pouvoir-piece" aria-hidden="true">
        <PieceFortune />
        <div ref={r.frappe} className="pouvoir-frappe">
          <PieceFortune plus />
        </div>
      </div>
      <span ref={r.onomato} className="pouvoir-onomato" aria-hidden="true">
        TING !
      </span>
      {scene.cle === 'zetsu' && (
        <div ref={r.zetsu} className="pouvoir-zetsu" aria-hidden="true">
          <b>{scene.dureeMs ? minSec(scene.dureeMs) : ''}</b>
          <span>Tu es invisible</span>
        </div>
      )}
      <div ref={r.flash} className="pouvoir-flash" />
      <div ref={r.dialogue} className="gi-dialogue pouvoir-dialogue">
        <span className={`a-qui${boite.refus ? ' refus' : ''}`}>{boite.qui}</span>
        <p className="a-texte" aria-hidden="true">
          {boite.texte}
        </p>
        <p className={`a-indice${boite.indice ? ' visible' : ''}`}>{boite.indice}</p>
      </div>
      <p className="sr" aria-live="polite">
        {phase === 'revele' && boite.indice ? boite.texte : ''}
      </p>
      <span className="pouvoir-passer" aria-hidden="true">
        Touche pour passer
      </span>
    </div>
  );
}
