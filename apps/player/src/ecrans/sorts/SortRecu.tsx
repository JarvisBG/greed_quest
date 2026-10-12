// Page ⑪ : le sort reçu, côté cible (prototype validé par Sivraj le 2026-10-12 : docs/prototype/sort-recu.html).
// Pour les sorts qui frappent (RG-10.5) : un battement rouge aux bords, la nuit tombe, le lanceur se montre en haut à
// droite et l'on entend son cri de loin (« VOL » + « ON ! », le nom seul pour un pouvoir) ; la comète part de son coin
// et fond sur toi. Issues : la carte arrachée de ta page du Book, face visible, puis aspirée vers le lanceur (la
// pochette garde « VOLÉE ») ; l'échange forcé (sa carte revient de dos et se retourne) ; le givre et le décompte
// (Gel), le viseur rouge en plus (Accompagnement) ; ta coque d'alvéoles qui encaisse (Mur défensif) ; la comète qui
// part en fumée (rien à prendre). Toucher pendant le cri saute à l'issue. Trace et Voyance restent une boîte (useJeu).
// Leçon des pages ⑧ et ⑪ : l'opacité finale d'une animation est aussi posée en style (téléphone de Sivraj).
import { Carte, Concentration, DosCarte, numeroCarte } from '@gq/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/client';
import { SORTS } from '../../lib/format';
import type { LivreRecu } from '../../lib/livre';
import { criRecu, issueRecu, pageDuSortRecu, texteSortRecu, type ItemRecu, type PocheRecu, type SortRecu as Recu } from '../../lib/sorts';
import { creerEffets } from '../scan/effets';
import { ALVEOLES, COINS_GIVRE, GIVRE, type CarteVue } from './Lancer';
import { minSec } from './FicheSort';

const EASE = 'cubic-bezier(.16,1,.3,1)';
type Phase = 'intro' | 'revele' | 'range';
// Fêlures de ta coque : la comète arrive du coin du lanceur (en haut à droite).
const FELURES = ['M28 -36 L19 -24 L8 -26 L0 -12 L-9 -14 L-6 -27', 'M28 -36 L36 -22 L52 -24', 'M28 -36 L38 -48 L36 -60', 'M0 -12 L-4 4 L-16 14 L-14 32 L-26 46', 'M-4 4 L12 14 L18 30 L33 38', 'M-9 -14 L-28 -10 L-40 -22 L-56 -20'];
const centre = (el: Element): [number, number] => {
  const b = el.getBoundingClientRect();
  return [b.left + b.width / 2, b.top + b.height / 2];
};
const vibrer = (p: number | number[]) => navigator.vibrate?.(p);
const taille = (mot: string, max: number) => `${Math.min(max, (Math.min(innerWidth, 480) * 0.86) / (mot.length * 0.86 + 0.4)).toFixed(0)}px`;
const vueDe = (i: ItemRecu): CarteVue =>
  i.kind === 'sort'
    ? { genre: 'sort', numero: SORTS[i.sort!]?.numero ?? null, nom: SORTS[i.sort!]?.nom ?? 'Sort', texte: SORTS[i.sort!]?.effet ?? null }
    : { genre: i.kind === 'objet' ? 'objet' : 'designee', numero: i.numero ?? null, nom: i.nom ?? '?', rang: i.rang ?? null, limite: i.limite ?? null, texte: i.texte ?? null };
const delai = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

interface Props {
  recu: Recu;
  partieId: string;
  /** Gel restant (ms), lu sur le profil rechargé après le sort. */
  geleMs: () => number;
  onFini: () => void;
}

export function SortRecu({ recu, partieId, geleMs, onFini }: Props) {
  const calme = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches).current;
  const issue = issueRecu(recu);
  const [phase, setPhase] = useState<Phase>('intro');
  const [page, setPage] = useState<ReturnType<typeof pageDuSortRecu>>(null);
  const [videe, setVidee] = useState(false);
  const [mot, setMot] = useState('');
  const [decompte, setDecompte] = useState('');
  const [boite, setBoite] = useState({ texte: '', indice: '' });
  const r = {
    racine: useRef<HTMLDivElement>(null),
    nuit: useRef<HTMLDivElement>(null),
    alarme: useRef<HTMLDivElement>(null),
    lignes: useRef<HTMLDivElement>(null),
    givre: useRef<HTMLDivElement>(null),
    toile: useRef<HTMLCanvasElement>(null),
    mur: useRef<HTMLDivElement>(null),
    toi: useRef<HTMLDivElement>(null),
    viseur: useRef<HTMLDivElement>(null),
    oeil: useRef<HTMLSpanElement>(null),
    livre: useRef<HTMLDivElement>(null),
    scene: useRef<HTMLDivElement>(null),
    recue: useRef<HTMLDivElement>(null),
    ret: useRef<HTMLDivElement>(null),
    arrachee: useRef<HTMLDivElement>(null),
    lanceur: useRef<HTMLDivElement>(null),
    cri: useRef<HTMLDivElement>(null),
    criNom: useRef<HTMLSpanElement>(null),
    criOn: useRef<HTMLSpanElement>(null),
    issue: useRef<HTMLDivElement>(null),
    decompte: useRef<HTMLDivElement>(null),
    orbe: useRef<HTMLDivElement>(null),
    flash: useRef<HTMLDivElement>(null),
    dialogue: useRef<HTMLDivElement>(null),
  };
  const ctl = useRef({ saute: false, phase: 'intro' as Phase, revelA: 0, attentes: new Set<() => void>(), toucher: null as null | (() => void) });
  const rappels = useRef({ onFini, geleMs });
  rappels.current = { onFini, geleMs };

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
    const fx = creerEffets(el.toile, () => el.arrachee.getBoundingClientRect());
    const anims: Animation[] = [];
    const A = (cible: Element, k: Keyframe[], o: KeyframeAnimationOptions & { duration: number }) => {
      const a = cible.animate(k, { fill: 'both', easing: EASE, ...o, duration: calme ? 1 : o.duration });
      anims.push(a);
      const fin = k[k.length - 1]!;
      if (fin.opacity !== undefined && cible instanceof HTMLElement) cible.style.opacity = String(fin.opacity);
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
    const mettrePhase = (p: Phase) => {
      c.phase = p;
      setPhase(p);
    };
    const taper = async (t: string) => {
      if (calme || c.saute) return setBoite((b) => ({ ...b, texte: t }));
      for (let n = 1; n <= t.length; n++) {
        if (!vivant) return;
        setBoite((b) => ({ ...b, texte: t.slice(0, n) }));
        await delai(22);
      }
    };
    // La secousse est un bonus : `composite` manque sur d'anciens navigateurs, jamais une erreur.
    const secouer = (px: number) => {
      if (!px || calme) return;
      try {
        for (const e of [el.scene, el.livre])
          e.animate([{ translate: '0 0' }, { translate: `${-px}px ${px * 0.6}px` }, { translate: `${px * 0.8}px ${-px * 0.6}px` }, { translate: `${-px * 0.4}px ${px * 0.3}px` }, { translate: '0 0' }], { duration: 220, easing: 'linear', composite: 'add' });
      } catch {
        // rien
      }
    };
    const tracer = (racine: Element, ms: number, pas = 0) =>
      racine.querySelectorAll('path').forEach((p, i) => A(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: ms, delay: calme ? 0 : i * pas, easing: 'cubic-bezier(.2,.7,.3,1)' }));
    const pointLanceur = (): [number, number] => [innerWidth - 40, Math.max(40, centre(el.lanceur)[1] + 30)];
    const frapper = (texte: string, rouge = false, max = 110) => {
      setMot(texte);
      el.issue.classList.toggle('rouge', rouge);
      el.issue.style.setProperty('--taille', taille(texte, max));
      A(el.issue, [{ opacity: 0, transform: 'scale(1.8)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.5,0,.75,0)' });
    };
    const revele = async (indice: string) => {
      c.revelA = performance.now();
      mettrePhase('revele');
      c.saute = false;
      el.dialogue.style.opacity = '1';
      if (!calme) el.dialogue.animate([{ transform: 'translateY(30px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: EASE });
      await taper(texteSortRecu(recu));
      setBoite((b) => ({ ...b, indice }));
    };
    const marquer = (onglet: string, texte: string, classe: string) => {
      const o = document.querySelector(`.onglets [data-onglet="${onglet}"]`);
      if (!o || calme) return;
      o.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.16)' }, { transform: 'scale(1)' }], { duration: 320, easing: EASE });
      const b = o.getBoundingClientRect();
      const p = document.createElement('span');
      p.className = classe;
      p.textContent = texte;
      p.style.left = `${b.left + b.width / 2}px`;
      p.style.top = `${b.top - 34}px`;
      document.body.append(p);
      p.animate(
        [{ opacity: 0, transform: 'translate(-50%, 10px)' }, { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.2 }, { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.75 }, { opacity: 0, transform: 'translate(-50%, -8px)' }],
        { duration: 1400, easing: 'ease-out', fill: 'forwards' },
      ).finished.finally(() => p.remove());
    };
    const finir = () => {
      if (vivant) rappels.current.onFini();
    };
    // La nuit se lève ; l'onglet touché le marque (« −1 » sur Book pour une carte perdue, sur Sorts pour le Mur).
    const refermer = async (marque: 'livre' | 'sorts' | null) => {
      mettrePhase('range');
      A(el.dialogue, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(24px)' }], { duration: 200 });
      for (const e of [el.cri, el.issue, el.decompte, el.givre, el.livre, el.toi, el.viseur, el.oeil, el.lanceur, el.lignes]) A(e, [{ opacity: getComputedStyle(e).opacity }, { opacity: 0 }], { duration: 240 });
      await fini(A(el.nuit, [{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: 'ease-in' }));
      if (marque) marquer(marque, '−1', 'recu-moins-un');
      finir();
    };
    // Échange forcé : la carte reçue file dans l'onglet Book ; la nuit se referme dessus.
    const ranger = async () => {
      mettrePhase('range');
      const onglet = document.querySelector('.onglets [data-onglet="livre"]');
      const [tx, ty] = onglet ? centre(onglet) : [innerWidth / 2, innerHeight - 30];
      const b = el.recue.getBoundingClientRect();
      const dx = tx - (b.left + b.width / 2);
      const dy = ty - (b.top + b.height / 2);
      const R = Math.hypot(innerWidth, innerHeight);
      vibrer(10);
      A(el.dialogue, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(24px)' }], { duration: 200 });
      for (const e of [el.lignes, el.livre, el.lanceur]) A(e, [{ opacity: getComputedStyle(e).opacity }, { opacity: 0 }], { duration: 250 });
      A(el.nuit, [{ clipPath: `circle(${R}px at ${tx}px ${ty}px)` }, { clipPath: `circle(0px at ${tx}px ${ty}px)` }], { duration: 560, delay: 80, easing: 'cubic-bezier(.6,0,.4,1)' });
      await fini(
        A(
          el.recue,
          [
            { transform: 'none', easing: 'cubic-bezier(.2,.7,.3,1)' },
            { transform: `translate(${dx * 0.18}px, ${dy * 0.18 - 70}px) scale(.72) rotate(-6deg)`, offset: 0.32, easing: 'cubic-bezier(.6,0,.9,.5)' },
            { transform: `translate(${dx}px, ${dy}px) scale(${30 / b.width}) rotate(-18deg)` },
          ],
          { duration: 640, easing: 'linear' },
        ),
      );
      if (!vivant) return;
      el.recue.style.opacity = '0';
      marquer('livre', '+1', 'tirage-plus-un');
      finir();
    };

    /** La carte quitte sa pochette (ou apparaît au centre si la page manque), montre sa face, puis file vers le lanceur. */
    const arracher = async (cx: number, cy: number) => {
      if (!c.saute && !calme) {
        A(el.flash, [{ opacity: 0.5 }, { opacity: 0 }], { duration: 200, easing: 'ease-out' });
        fx.onde(cx, cy, '#8fb2ff', 0.9);
        fx.etincelles(cx, cy, 90, '#cfe0ff', 0.8);
        secouer(8);
        vibrer([40, 40, 60]);
      }
      const poche = el.livre.querySelector('.poche.visee');
      const W = Math.min(innerWidth * 0.5, 210);
      const H = (W * 88) / 63;
      const b = poche?.getBoundingClientRect() ?? new DOMRect(innerWidth / 2 - W / 4, innerHeight / 2 - H / 4, W / 2, H / 2);
      const k0 = b.width / W;
      const pos = (x: number, y: number, s: number) => `translate(${x - (W * (1 - s)) / 2}px, ${y - (H * (1 - s)) / 2}px) scale(${s})`;
      el.arrachee.style.width = `${W}px`;
      el.arrachee.style.opacity = '1';
      setVidee(true);
      const mx = innerWidth / 2 - W / 2;
      const my = Math.max(80, innerHeight * 0.32 - H / 2);
      await fini(
        A(el.arrachee, [{ transform: pos(b.left, b.top, k0) }, { transform: `${pos(b.left + (mx - b.left) * 0.3, b.top - 40, k0 + (1 - k0) * 0.4)} rotate(-14deg)`, offset: 0.3 }, { transform: `${pos(mx, my, 1)} rotate(6deg)` }], {
          duration: c.saute ? 1 : 560,
          easing: 'cubic-bezier(.2,.7,.3,1)',
        }),
      );
      if (!vivant) return;
      const tampon = el.livre.querySelector('.recu-volee');
      if (tampon) A(tampon, [{ opacity: 0, transform: 'scale(1.8)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: 80 });
      // Elle tremble un instant, face visible : on sait ce qu'on perd.
      if (!c.saute && !calme)
        try {
          el.arrachee.animate([{ translate: '0 0' }, { translate: '-3px 1px' }, { translate: '3px -1px' }, { translate: '0 0' }], { duration: 120, iterations: 4, composite: 'add' });
        } catch {
          // rien
        }
      await pause(820);
      if (!vivant) return;
      const [lx, ly] = pointLanceur();
      if (!c.saute && !calme) fx.trainee(() => centre(el.arrachee));
      await fini(
        A(el.arrachee, [{ transform: `${pos(mx, my, 1)} rotate(6deg)` }, { transform: `${pos(mx - 30, my + 20, 1.05)} rotate(-4deg)`, offset: 0.2 }, { transform: `${pos(lx - W / 2, ly - H / 2, 0.06)} rotate(40deg)`, opacity: 0.2 }], {
          duration: c.saute ? 1 : 560,
          easing: 'cubic-bezier(.6,0,.9,.4)',
        }),
      );
      fx.trainee(null);
      el.arrachee.style.opacity = '0';
      if (!c.saute && !calme) fx.etincelles(lx, ly, 30, '#8fb2ff', 0.4);
    };

    void (async () => {
      // Une autre cinématique en cours (ton propre lancer) : le sort reçu attend la fin.
      while (vivant && document.querySelector('.lancer')) await delai(300);
      // Ta page d'avant le vol : le Book est relu après le sort (court délai au plus).
      const livre = recu.perdue ? Promise.race([api.get<LivreRecu>(`/parties/${partieId}/livre`).catch(() => null), delai(1500).then(() => null)]) : Promise.resolve(null);
      await deuxImages();
      if (!vivant) return;
      const cri = criRecu(recu).toUpperCase();
      const pouvoir = !!recu.pouvoir;

      // 1. L'alerte : un battement rouge aux bords, la nuit tombe d'un coup ; le lanceur se montre en haut à droite.
      el.nuit.style.opacity = '1';
      A(el.nuit, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
      A(el.alarme, [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0.2, offset: 0.55 }, { opacity: 0.8, offset: 0.7 }, { opacity: 0 }], { duration: 900, easing: 'linear' });
      vibrer([200, 100, 200]);
      A(el.lignes, [{ opacity: 0, transform: 'scale(1.4)' }, { opacity: 0.55, transform: 'scale(1)' }], { duration: 700 });
      A(el.lanceur, [{ opacity: 0, transform: 'translateX(30px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: 120 });
      el.criNom.style.setProperty('--taille', taille(cri, 110));
      el.criOn.style.display = pouvoir ? 'none' : '';
      const p = recu.perdue ? await livre : null;
      if (!vivant) return;
      if (p && recu.perdue) setPage(pageDuSortRecu(p, recu.perdue, recu.recue));
      await deuxImages();
      if (!vivant) return;
      if (el.livre.querySelector('.poche')) A(el.livre, [{ opacity: 0, transform: 'translateY(40px) scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 460, delay: 100 });
      else if (issue !== 'vol' && issue !== 'echange') A(el.toi, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: 200 });
      await pause(520);
      if (!vivant) return;

      // 2. Le cri du lanceur, entendu de loin.
      A(el.criNom, [{ opacity: 0, transform: 'scale(2.2)' }, { opacity: 1, transform: 'scale(.95)', offset: 0.7 }, { opacity: 1, transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.5,0,.75,0)' });
      await pause(240);
      if (!c.saute) {
        vibrer(18);
        secouer(3);
      }
      if (!pouvoir) {
        await pause(160);
        A(el.criOn, [{ opacity: 0, transform: 'scale(2.4) rotate(8deg)' }, { opacity: 1, transform: 'scale(.94)', offset: 0.7 }, { opacity: 1, transform: 'scale(1)' }], { duration: 280, easing: 'cubic-bezier(.5,0,.75,0)' });
        await pause(220);
        if (!c.saute && !calme) {
          vibrer(25);
          secouer(6);
          const [x, y] = centre(el.criOn);
          fx.etincelles(x, y, 30, '#8fb2ff', 0.5);
        }
      }
      if (issue === 'mur') A(el.mur, [{ opacity: 0, transform: 'scale(.85)' }, { opacity: 0.95, transform: 'scale(1)' }], { duration: 320, delay: 150 });
      await pause(360);
      if (!vivant) return;

      // 3. La comète part du lanceur et fond sur toi.
      A(el.criNom, [{ opacity: 1 }, { opacity: 0, transform: 'scale(1.1)' }], { duration: 260 });
      if (!pouvoir) A(el.criOn, [{ opacity: 1 }, { opacity: 0, transform: 'scale(1.1)' }], { duration: 260 });
      const [lx, ly] = pointLanceur();
      const visee = el.livre.querySelector('.poche.visee');
      const mb = el.mur.getBoundingClientRect();
      const [cx, cy] = visee ? centre(visee) : issue === 'mur' ? [mb.left + mb.width * 0.7, mb.top + mb.height * 0.24] : centre(el.toi);
      if (!c.saute && !calme) fx.trainee(() => centre(el.orbe));
      el.orbe.style.opacity = '1';
      await fini(
        A(el.orbe, [{ transform: `translate(${lx}px, ${ly}px) scale(.5)` }, { transform: `translate(${lx + (cx - lx) * 0.4 + 40}px, ${ly + (cy - ly) * 0.4 - 30}px) scale(.9)`, offset: 0.4 }, { transform: `translate(${cx}px, ${cy}px) scale(1.3)` }], {
          duration: c.saute ? 1 : 520,
          easing: 'cubic-bezier(.45,0,.85,.5)',
        }),
      );
      fx.trainee(null);
      el.orbe.style.opacity = '0';
      if (!vivant) return;
      A(el.lignes, [{ opacity: 0.55 }, { opacity: 0.2 }], { duration: 400 });

      // 4. L'issue.
      if (issue === 'vol' || issue === 'echange') {
        await arracher(cx, cy);
        if (!vivant) return;
        if (issue === 'vol') {
          frapper('VOLÉE', true);
          await revele('Touche l’écran pour revenir');
          if (!vivant) return;
          await toucher();
          if (vivant) await refermer('livre');
          return;
        }
        // Échange forcé : la comète revient avec sa carte, de dos ; elle se retourne.
        A(el.livre, [{ opacity: 1 }, { opacity: 0.25 }], { duration: 300 });
        const [rx, ry] = centre(el.recue);
        if (!c.saute && !calme) fx.trainee(() => centre(el.orbe));
        el.orbe.style.opacity = '1';
        await fini(A(el.orbe, [{ transform: `translate(${lx}px, ${ly}px) scale(.5)` }, { transform: `translate(${rx}px, ${ry}px) scale(1.3)` }], { duration: c.saute ? 1 : 460, easing: 'cubic-bezier(.2,.6,.3,1)' }));
        fx.trainee(null);
        el.orbe.style.opacity = '0';
        if (!vivant) return;
        if (!c.saute && !calme) {
          A(el.flash, [{ opacity: 0.5 }, { opacity: 0 }], { duration: 220 });
          fx.onde(rx, ry, '#ffffff', 1);
          fx.etincelles(rx, ry, 100, '#e8b4b6', 0.9);
          fx.fumee(rx, ry, 16);
          secouer(6);
          vibrer([30, 40, 20]);
        }
        el.recue.style.opacity = '1';
        A(el.recue, [{ transform: 'scale(.3)' }, { transform: 'scale(1.1)', offset: 0.6 }, { transform: 'scale(1)' }], { duration: 420 });
        A(el.ret, [{ transform: 'rotateY(900deg)' }, { transform: 'rotateY(180deg)', offset: 0.7 }, { transform: 'rotateY(0deg)' }], { duration: 900, easing: 'cubic-bezier(.12,.8,.2,1)' });
        await pause(900);
        if (!vivant) return;
        await revele('Touche l’écran pour la ranger dans ton Book');
        if (!vivant) return;
        await toucher();
        if (vivant) await ranger();
        return;
      }

      if (issue === 'gel' || issue === 'accompagnement') {
        if (!c.saute && !calme) {
          A(el.flash, [{ opacity: 0.45 }, { opacity: 0 }], { duration: 220 });
          fx.onde(cx, cy, '#dff0ff', 1);
          fx.etincelles(cx, cy, 90, '#dff0ff', 0.8);
          secouer(6);
          vibrer([40, 30, 40]);
        }
        tracer(el.givre, 900);
        A(el.givre, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
        el.toi.classList.add('gele');
        frapper('GELÉ', false, 130);
        const reste = rappels.current.geleMs();
        setDecompte(reste > 0 ? minSec(reste) : '');
        A(el.decompte, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: 300 });
        if (issue === 'accompagnement') {
          await pause(560);
          if (!vivant) return;
          A(el.viseur, [{ opacity: 0, transform: 'scale(2.6) rotate(-40deg)' }, { opacity: 1, transform: 'scale(1) rotate(0deg)' }], { duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)' });
          await pause(480);
          if (!vivant) return;
          if (!c.saute) {
            vibrer(30);
            secouer(4);
          }
          A(el.oeil, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 260 });
        }
        await pause(700);
        if (!vivant) return;
        await revele('Touche l’écran pour revenir');
        if (!vivant) return;
        await toucher();
        if (vivant) await refermer(null);
        return;
      }

      if (issue === 'mur') {
        if (!c.saute && !calme) {
          A(el.flash, [{ opacity: 0.45 }, { opacity: 0 }], { duration: 200 });
          fx.etincelles(cx, cy, 140, '#bfe0ff', 1.1);
          fx.onde(cx, cy, '#bfe0ff', 0.9);
          secouer(9);
          vibrer([40, 50, 30]);
        }
        tracer(el.mur.querySelector('.feles')!, 260, 30);
        await pause(560);
        if (!vivant) return;
        A(el.mur, [{ opacity: 0.95, transform: 'scale(1)' }, { opacity: 0, transform: 'translateY(60px) scale(1.04)' }], { duration: 480, easing: 'cubic-bezier(.5,0,.75,0)' });
        if (!c.saute && !calme) {
          const [mx, my] = centre(el.mur);
          fx.etincelles(mx, my + 40, 60, '#ffffff', 0.4);
        }
        frapper('BLOQUÉ');
        await pause(320);
        if (!vivant) return;
        await revele('Touche l’écran pour revenir');
        if (!vivant) return;
        await toucher();
        if (vivant) await refermer(recu.protection === 'barriere' ? 'sorts' : null);
        return;
      }

      // Rien à prendre : la comète se défait en fumée devant toi.
      if (!c.saute && !calme) {
        fx.fumee(cx, cy, 28);
        fx.etincelles(cx, cy, 30, '#8fb2ff', 0.3);
        vibrer(20);
      }
      frapper('RIEN');
      await pause(500);
      if (!vivant) return;
      await revele('Touche l’écran pour revenir');
      if (!vivant) return;
      await toucher();
      if (vivant) await refermer(null);
    })();

    return () => {
      vivant = false;
      [...c.attentes].forEach((f) => f());
      c.toucher?.();
      anims.forEach((a) => a.cancel());
      fx.arreter();
    };
    // un sort reçu = une séquence (la clé du composant change avec le sort)
  }, []);

  const perdue = recu.perdue ? vueDe(recu.perdue) : null;
  const recueVue = recu.recue ? vueDe(recu.recue) : null;
  const restes = page ? 12 - page.poches.length : 0;
  const span = restes % 3 || 3;
  const poche = (p: PocheRecu, k: number) => {
    const visee = page?.index === k;
    if (visee && videe)
      return (
        <span key={k} className="poche visee">
          {recu.perdue?.emplacement === 'fixe' && (
            <span className="poche-num">
              {numeroCarte(recu.perdue.numero ?? null)}
              <em>{recu.perdue.rang}</em>
            </span>
          )}
          <span className="recu-volee">VOLÉE</span>
        </span>
      );
    if (p.type === 'vide') return <span key={k} className={`poche${visee ? ' visee' : ''}`} />;
    if (p.type === 'absente')
      return (
        <span key={k} className="poche">
          <span className="poche-num">
            {numeroCarte(p.numero)}
            <em>{p.rang}</em>
          </span>
        </span>
      );
    return (
      <span key={k} className={`poche${visee ? ' visee' : ''}`}>
        {p.type === 'sort' ? <Carte genre="sort" numero={SORTS[p.sort]?.numero ?? null} nom={SORTS[p.sort]?.nom ?? ''} /> : <Carte genre="designee" numero={p.carte.numero} nom={p.carte.nom} rang={p.carte.rang} limite={p.carte.limite ?? null} />}
      </span>
    );
  };

  return (
    <div ref={r.racine} className={`lancer recu ${phase}`} role="alertdialog" aria-modal="true" aria-label={`Sort reçu : ${criRecu(recu)}`} onPointerDown={surToucher}>
      <div ref={r.nuit} className="lancer-nuit recu-nuit" />
      <div ref={r.alarme} className="recu-alarme" />
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
      <div ref={r.mur} className="lancer-mur recu-mur" aria-hidden="true">
        <svg viewBox="-70 -70 140 140">
          <defs>
            <radialGradient id="recu-mur-g">
              <stop offset="0" stopColor="#cfe6ff" stopOpacity=".05" />
              <stop offset=".75" stopColor="#9fd0ff" stopOpacity=".22" />
              <stop offset="1" stopColor="#9fd0ff" stopOpacity=".5" />
            </radialGradient>
          </defs>
          <circle r="64" fill="url(#recu-mur-g)" />
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
      <div ref={r.toi} className="recu-toi" aria-hidden="true">
        <span>toi</span>
      </div>
      <div ref={r.viseur} className="recu-viseur" aria-hidden="true">
        <svg viewBox="-50 -50 100 100">
          <circle r="40" />
          <circle r="22" strokeDasharray="6 6" />
          <path d="M0 -48v14M0 34v14M-48 0h14M34 0h14" />
        </svg>
      </div>
      <span ref={r.oeil} className="recu-oeil" aria-hidden="true">
        {recu.lanceur} voit où tu es
      </span>
      <div ref={r.livre} className="recu-livre" aria-hidden="true">
        {page && (
          <div className={`page ${page.libre ? 'p-libre' : 'p-designee'}`}>
            <div className="page-tete">
              <span>{page.libre ? 'Libres' : 'Fixes'}</span>
              <span>{page.libre ? '' : page.titre}</span>
            </div>
            <div className="poches">
              {page.poches.map(poche)}
              {restes > 0 && (
                <span className="page-folio" style={{ gridColumn: `span ${span}` }}>
                  {page.folio}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      <div ref={r.scene} className="lancer-scene">
        <div ref={r.recue} className="lancer-vol recu-recue">
          <div ref={r.ret} className="lancer-retourne">
            {recueVue && <Carte {...recueVue} />}
            <DosCarte />
          </div>
        </div>
      </div>
      <div ref={r.arrachee} className="recu-arrachee" aria-hidden="true">
        {perdue && <Carte {...perdue} />}
      </div>
      <div ref={r.lanceur} className="recu-lanceur" aria-hidden="true">
        <small>{recu.pouvoir ? 'pouvoir lancé par' : 'sort lancé par'}</small>
        <b>{recu.lanceur}</b>
      </div>
      <div ref={r.cri} className="lancer-cri recu-cri" aria-hidden="true">
        <span ref={r.criNom}>{criRecu(recu).toUpperCase()}</span>
        <span ref={r.criOn} className="on">
          ON !
        </span>
      </div>
      <div ref={r.issue} className="recu-issue" aria-hidden="true">
        {mot}
      </div>
      <div ref={r.decompte} className="recu-decompte" aria-hidden="true">
        {decompte}
      </div>
      <div ref={r.orbe} className="lancer-orbe" aria-hidden="true" />
      <div ref={r.flash} className="lancer-flash" />
      <div ref={r.dialogue} className="gi-dialogue lancer-dialogue">
        <span className="a-qui recu-qui">Sort reçu</span>
        <p className="a-texte" aria-hidden="true">
          {boite.texte}
        </p>
        <p className={`a-indice${boite.indice ? ' visible' : ''}`}>{boite.indice}</p>
      </div>
      <p className="sr" aria-live="assertive">
        {phase === 'revele' && boite.indice ? boite.texte : ''}
      </p>
      <span className="lancer-passer" aria-hidden="true">
        Touche pour passer
      </span>
    </div>
  );
}
