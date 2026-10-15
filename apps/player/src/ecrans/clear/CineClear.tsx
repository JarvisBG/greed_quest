// Page ⑰ : les cinématiques du Clear, où que soit le joueur (prototype validé : docs/prototype/clear.html).
// - sceau : Clear déclaré (RG-13.1), le Book fermé monte, le sceau de cire doré s'écrase dessus ;
// - refus : le GM refuse, le sceau tremble, se fend, ses deux moitiés tombent ; le motif dans la voix du jeu ;
// - gloire : Clear confirmé (RG-13.2), nuit dorée, le Book monte en tournant, le sceau fond en lumière, la couverture
//   s'ouvre, les pochettes désignées s'allument une à une, « CLEAR ! » en or, pluie d'or ; puis le choix des lots ;
// - autre : un autre joueur voit « CLEAR ! » et le pseudo du gagnant ; la partie est terminée.
// Toucher pendant l'intro la passe ; ensuite, toucher fait avancer la voix du jeu.
import { Concentration, EmblemeBook, numeroCarte } from '@gq/ui';
import type { Rank } from '@gq/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { colonnesGloire, texteRefus, type CineClear as Cine } from '../../lib/clear';
import { creerEffets } from '../scan/effets';
import { Sceau } from './Sceau';

const EASE = 'cubic-bezier(.16,1,.3,1)';
const REBOND = 'cubic-bezier(.3,1.5,.5,1)';
const OR = '#ffd877';
const vibrer = (p: number | number[]) => navigator.vibrate?.(p);
const delai = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
const centre = (el: Element): [number, number] => {
  const b = el.getBoundingClientRect();
  return [b.left + b.width / 2, b.top + b.height / 2];
};

type Phase = 'intro' | 'revele';
interface Boite {
  qui: string;
  classe: 'or' | 'rouge';
  texte: string;
  indice: string;
}

export function CineClear({ cine, pseudo, cartes, onFini }: { cine: Cine; pseudo: string; cartes: { numero: number; rang: Rank }[]; onFini: () => void }) {
  const calme = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches).current;
  const [phase, setPhase] = useState<Phase>('intro');
  const [boite, setBoite] = useState<Boite>({ qui: 'Greed Island', classe: 'or', texte: '', indice: '' });
  const [l2, setL2] = useState('');
  const gloire = cine.type === 'gloire';
  const r = {
    racine: useRef<HTMLDivElement>(null),
    nuit: useRef<HTMLDivElement>(null),
    lignes: useRef<HTMLDivElement>(null),
    rayons: useRef<HTMLDivElement>(null),
    book: useRef<HTMLDivElement>(null),
    couv: useRef<HTMLDivElement>(null),
    dos: useRef<HTMLDivElement>(null),
    slots: useRef<HTMLDivElement>(null),
    n: useRef<HTMLElement>(null),
    sceau: useRef<HTMLDivElement>(null),
    g: useRef<HTMLDivElement>(null),
    d: useRef<HTMLDivElement>(null),
    compte: useRef<HTMLDivElement>(null),
    cri: useRef<HTMLDivElement>(null),
    flash: useRef<HTMLDivElement>(null),
    dialogue: useRef<HTMLDivElement>(null),
    toile: useRef<HTMLCanvasElement>(null),
  };
  const ctl = useRef({ saute: false, phase: 'intro' as Phase, revelA: 0, attentes: new Set<() => void>(), toucher: null as null | (() => void) });
  const rappel = useRef(onFini);
  rappel.current = onFini;

  const surToucher = useCallback(() => {
    const c = ctl.current;
    if (c.phase === 'revele' && c.toucher) {
      if (performance.now() - c.revelA < 350) return;
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
    const fx = creerEffets(r.toile.current!, () => new DOMRect(-999, -999, 0, 0));
    const anims: Animation[] = [];
    // L'opacité finale est aussi posée en style (leçon des pages ⑧ et ⑪ : sur certains téléphones, le `fill` ne tient pas).
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
    const secousse = (k: Keyframe[], duree: number) => {
      if (!vif()) return;
      try {
        r.racine.current?.animate(k, { duration: duree, composite: 'add' });
      } catch {
        // `composite` inconnu : pas de secousse
      }
    };
    /** La voix du jeu : le texte s'écrit, puis on attend un toucher. */
    const dire = async (qui: string, texte: string, indice: string, classe: Boite['classe'] = 'or') => {
      c.phase = 'revele';
      setPhase('revele');
      c.saute = false;
      setBoite({ qui, classe, texte: '', indice: '' });
      if (r.dialogue.current?.style.opacity !== '1') A(r.dialogue.current, [{ opacity: 0, translate: '-50% 20px' }, { opacity: 1, translate: '-50% 0' }], { duration: 300 });
      for (let n = 1; n <= texte.length; n++) {
        if (!vivant) return;
        if (calme || c.saute) {
          setBoite((b) => ({ ...b, texte }));
          break;
        }
        setBoite((b) => ({ ...b, texte: texte.slice(0, n) }));
        await delai(22);
      }
      if (!vivant) return;
      setBoite((b) => ({ ...b, texte, indice }));
      c.revelA = performance.now();
      await new Promise<void>((res) => {
        c.toucher = res;
      });
    };
    const fermer = async () => {
      c.saute = false;
      await fini(A(r.racine.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 }));
      if (vivant) rappel.current();
    };

    // 1. Clear déclaré : le Book fermé monte, le sceau s'écrase dessus.
    const sceau = async () => {
      vibrer([30, 40, 30]);
      A(r.nuit.current, [{ opacity: 0 }, { opacity: 0.92 }], { duration: 300 });
      A(r.book.current, [{ opacity: 0, transform: 'translateY(30%) scale(.8)' }, { opacity: 1, transform: 'none' }], { duration: 560 });
      await pause(700);
      if (!vivant) return;
      A(r.sceau.current, [{ opacity: 0, scale: 2.4 }, { opacity: 1, scale: 0.94, offset: 0.7 }, { opacity: 1, scale: 1 }], { duration: 380, easing: REBOND });
      await pause(270);
      if (!vivant) return;
      const [x, y] = centre(r.sceau.current!);
      if (vif()) {
        fx.onde(x, y, OR, 0.7);
        fx.etincelles(x, y, 40, OR, 0.6);
      }
      vibrer(120);
      secousse([{ translate: '0 0' }, { translate: '-6px 4px' }, { translate: '5px -3px' }, { translate: '0 0' }], 240);
      await pause(600);
      if (!vivant) return;
      await dire('Greed Island', 'Book complet ! Ton Book est scellé : plus rien ne peut le toucher. Va voir le Game Master et montre-lui ta licence.', 'Touche pour fermer');
      await fermer();
    };

    // 2. Refus du GM : le sceau tremble, se fend, les deux moitiés tombent.
    const refus = async (motif: string) => {
      A(r.nuit.current, [{ opacity: 0 }, { opacity: 0.92 }], { duration: 300 });
      A(r.book.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
      A(r.sceau.current, [{ opacity: 1 }, { opacity: 1 }], { duration: 1 });
      await pause(600);
      if (!vivant) return;
      if (vif()) {
        try {
          r.sceau.current?.animate([{ translate: '0 0' }, { translate: '-3px 0' }, { translate: '3px 0' }, { translate: '0 0' }], { duration: 200, iterations: 2, composite: 'add' });
        } catch {
          // pas de tremblement
        }
      }
      vibrer([30, 30, 30]);
      await pause(420);
      if (!vivant) return;
      const [x, y] = centre(r.sceau.current!);
      A(r.sceau.current, [{ opacity: 0 }, { opacity: 0 }], { duration: 1 });
      if (vif()) fx.etincelles(x, y, 24, '#c99a2a', 0.5);
      vibrer(90);
      A(r.g.current, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate(-40%, 120%) rotate(-40deg)' }], { duration: 900, easing: 'cubic-bezier(.5,0,.8,.6)' });
      A(r.d.current, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate(40%, 120%) rotate(35deg)' }], { duration: 900, easing: 'cubic-bezier(.5,0,.8,.6)' });
      await pause(700);
      if (!vivant) return;
      await dire('Clear refusé', texteRefus(motif), 'Touche pour fermer', 'rouge');
      await fermer();
    };

    // 3. Clear confirmé : le Book en gloire.
    const enGloire = async () => {
      const n = cartes.length;
      vibrer([60, 40, 60, 40, 200]);
      A(r.nuit.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
      A(r.lignes.current, [{ opacity: 0, scale: 1.3 }, { opacity: 0.16, scale: 1 }], { duration: 600 });
      A(r.sceau.current, [{ opacity: 1 }, { opacity: 1 }], { duration: 1 });
      A(
        r.book.current,
        [
          { opacity: 1, transform: `translateY(${innerHeight * 0.6}px) rotateX(30deg) rotateZ(-12deg) scale(.7)` },
          { opacity: 1, transform: 'translateY(-4%) rotateZ(3deg) scale(1.04)', offset: 0.75 },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 900, easing: 'cubic-bezier(.2,.8,.3,1)' },
      );
      await pause(950);
      if (!vivant) return;
      // Le sceau fond en lumière, la couverture s'ouvre.
      let [bx, by] = centre(r.book.current!);
      A(r.sceau.current, [{ opacity: 1, filter: 'brightness(1)', scale: 1 }, { opacity: 0, filter: 'brightness(3)', scale: 1.3 }], { duration: 420 });
      if (vif()) fx.etincelles(bx, by, 50, OR, 0.7);
      vibrer(60);
      await pause(300);
      A(r.couv.current, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-168deg)' }], { duration: 760, easing: 'cubic-bezier(.5,0,.25,1)' });
      A(r.dos.current, [{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(12deg)' }], { duration: 760, easing: 'cubic-bezier(.5,0,.25,1)' });
      A(r.rayons.current, [{ opacity: 0, scale: 0.4 }, { opacity: 0.55, scale: 1 }], { duration: 800 });
      await pause(780);
      if (!vivant) return;
      // Les pochettes s'allument une à une, de plus en plus vite ; le compteur monte.
      A(r.compte.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
      const slots = [...(r.slots.current?.querySelectorAll<HTMLElement>('.cl-slot:not(.embleme)') ?? [])];
      for (let i = 0; i < slots.length; i++) {
        if (!vivant) return;
        const s = slots[i]!;
        s.classList.add('allume');
        const mini = s.querySelector<HTMLElement>('.cl-mini');
        if (mini) mini.style.opacity = '1';
        A(s.querySelector<HTMLElement>('.cl-lueur'), [{ opacity: 1 }, { opacity: 0 }], { duration: 500, easing: 'ease-out' });
        A(s, [{ scale: 1.18 }, { scale: 1 }], { duration: 260, easing: REBOND });
        if (vif()) fx.etincelles(...centre(s), 8, OR, 0.25);
        if (r.n.current) r.n.current.textContent = `${i + 1}/${n}`;
        if (r.compte.current) r.compte.current.innerHTML = `Cartes désignées <b>${i + 1}</b> / ${n}`;
        vibrer(12);
        await pause(Math.max(70, 210 - i * 12));
      }
      await pause(220);
      if (!vivant) return;
      // La dernière : éclat, onde, « CLEAR ! » frappé en or.
      [bx, by] = centre(r.book.current!);
      A(r.flash.current, [{ opacity: 0.85 }, { opacity: 0 }], { duration: 520, easing: 'ease-out' });
      if (vif()) {
        fx.onde(bx, by, '#fff1c9', 1.6);
        fx.etincelles(bx, by, 90, OR, 1.1);
        fx.etincelles(bx, by, 40, '#ffffff', 0.9);
      }
      vibrer([150, 60, 300]);
      secousse([{ translate: '0 0' }, { translate: '-9px 5px' }, { translate: '7px -4px' }, { translate: '-3px 2px' }, { translate: '0 0' }], 300);
      A(r.book.current, [{ transform: 'none' }, { transform: 'translateY(9%) scale(.8)' }], { duration: 420 });
      A(r.cri.current, [{ opacity: 0, scale: 2.6 }, { opacity: 1, scale: 1 }], { duration: 340, easing: REBOND });
      A(r.rayons.current, [{ opacity: 0.55, rotate: '0deg' }, { opacity: 0.85, rotate: '30deg' }], { duration: 3000, easing: 'linear' });
      if (!calme) fx.pluie(9000, [OR, OR, '#fff1c9']);
      A(r.compte.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 600 });
      await pause(1500);
      if (!vivant) return;
      await dire('Greed Island', `Félicitations, ${pseudo} ! Tu as réuni les ${n} cartes désignées. La partie est terminée : tu as gagné le Clear !`, 'Touche pour continuer');
      if (!vivant) return;
      await dire('Greed Island', 'Choisis maintenant 3 cartes de ton Book : elles deviennent les lots que l’organisateur te remettra.', 'Touche pour choisir tes lots');
      await fermer();
    };

    // 4. Les autres joueurs : « CLEAR ! » plein écran.
    const autre = async (qui: string) => {
      vibrer([200, 100, 200]);
      A(r.nuit.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
      A(r.lignes.current, [{ opacity: 0, scale: 1.3 }, { opacity: 0.16, scale: 1 }], { duration: 600 });
      await pause(500);
      if (!vivant) return;
      A(r.cri.current, [{ opacity: 0, scale: 2.6 }, { opacity: 1, scale: 1 }], { duration: 340, easing: REBOND });
      await pause(240);
      if (!vivant) return;
      const [x, y] = centre(r.cri.current!);
      if (vif()) {
        fx.onde(x, y, OR, 1.3);
        fx.etincelles(x, y, 70, OR, 1);
      }
      vibrer(140);
      A(r.rayons.current, [{ opacity: 0, scale: 0.6 }, { opacity: 0.45, scale: 1 }], { duration: 700 });
      await pause(1300);
      if (!vivant) return;
      await dire('Greed Island', `${qui} a réussi le Clear. La partie est terminée : place au classement final.`, 'Touche pour fermer');
      await fermer();
    };

    if (cine.type === 'sceau') void sceau();
    else if (cine.type === 'refus') void refus(cine.motif);
    else if (cine.type === 'gloire') {
      setL2(`${pseudo} réunit les ${cartes.length} cartes !`);
      void enGloire();
    } else {
      setL2(`${cine.pseudo} a réuni toutes les cartes désignées`);
      void autre(cine.pseudo);
    }

    return () => {
      vivant = false;
      anims.forEach((a) => a.cancel());
      fx.arreter();
    };
  }, []);

  const sombre = cine.type !== 'gloire';
  const avecBook = cine.type !== 'autre';
  const cols = colonnesGloire(cartes.length);
  return (
    <div
      ref={r.racine}
      className={`cl-cine ${phase}${cine.type === 'autre' ? ' autre' : ''}`}
      role="alertdialog"
      aria-modal="true"
      aria-label={cine.type === 'refus' ? 'Clear refusé' : cine.type === 'sceau' ? 'Clear déclaré' : 'Clear !'}
      onPointerDown={surToucher}
    >
      <div ref={r.nuit} className={`cl-nuit${sombre ? ' sombre' : ''}`} />
      <div ref={r.lignes} className="cl-lignes">
        <Concentration graine={31} />
      </div>
      <div ref={r.rayons} className="cl-rayons" />
      {avecBook && (
        <div ref={r.book} className="cl-book" aria-hidden="true">
          <div className="cl-volume">
            {gloire && (
              <div className="cl-page">
                <h3>
                  <span>Désignées</span>
                  <b ref={r.n}>0/{cartes.length}</b>
                </h3>
                <div ref={r.slots} className="cl-slots" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                  {cartes.map((c, i) => (
                    <div key={i} className="cl-slot">
                      <div className={`cl-mini r-${c.rang}`} style={{ opacity: 0 }}>
                        <i>
                          {numeroCarte(c.numero)}
                          <em>{c.rang}</em>
                        </i>
                        <u />
                      </div>
                      <span className="cl-lueur" />
                    </div>
                  ))}
                  <div className="cl-slot embleme">
                    <EmblemeBook />
                  </div>
                </div>
              </div>
            )}
            <div ref={r.dos} className="cl-couv-dos" />
            <div ref={r.couv} className="cl-couv">
              <EmblemeBook />
              <strong>BOOK</strong>
            </div>
            <div ref={r.sceau} className="cl-sceau-pose">
              <Sceau />
            </div>
            <div ref={r.g} className="cl-moitie g">
              <Sceau />
            </div>
            <div ref={r.d} className="cl-moitie d">
              <Sceau />
            </div>
          </div>
        </div>
      )}
      <div ref={r.compte} className="cl-compte" />
      <div ref={r.cri} className="cl-cri">
        <span className="l1">CLEAR !</span>
        <span className="l2">{l2}</span>
      </div>
      <canvas ref={r.toile} className="cl-toile" aria-hidden="true" />
      <div ref={r.flash} className="cl-flash" />
      <div ref={r.dialogue} className="lancer-dialogue gi-dialogue cl-dialogue" role="status">
        <span className={`a-qui ${boite.classe}`}>{boite.qui}</span>
        <p className="a-texte">{boite.texte}</p>
        <p className={`a-indice${boite.indice ? ' visible' : ''}`}>{boite.indice || ' '}</p>
      </div>
      {phase === 'intro' && (
        <span className="lancer-passer cl-passer" aria-hidden="true">
          Touche pour passer
        </span>
      )}
    </div>
  );
}

