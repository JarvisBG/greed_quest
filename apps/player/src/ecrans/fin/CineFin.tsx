// Page ⑱ : les cinématiques de la fin (prototype validé : docs/prototype/fin-partie.html).
// - fin (RG-4.6, RG-13) : nuit d'encre, le gong descend, coup (éclair, ondes, disque qui tremble), « FIN DE PARTIE »
//   frappé ; après un Clear, ruban doré du gagnant ; podium 3e → 2e → 1er (marches qui montent, noms frappés) ;
//   ta place tombe en dernier comme un tampon rouge ; la voix du jeu, puis le classement ;
// - abandon (RG-5.7) : la licence au centre, un trait de pinceau rouge la raye, tampon « ABANDON », la voix du jeu.
// Toucher pendant l'intro la passe ; ensuite, toucher fait avancer la voix du jeu.
import { Concentration, EmblemeHunter } from '@gq/ui';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ordinal, podium, tailleNom, texteFin, type Classement, type CineFin as Cine } from '../../lib/fin';
import { FiltreEncre } from '../masadora/Paquet';
import { QrCode } from '../QrCode';
import { Sceau } from '../clear/Sceau';
import { creerEffets } from '../scan/effets';
import { FiltrePinceau, Gong, Rature, TamponPlace } from './Dessins';

const EASE = 'cubic-bezier(.16,1,.3,1)';
const REBOND = 'cubic-bezier(.3,1.5,.5,1)';
const BRONZE = '#f3c98a';
const vibrer = (p: number | number[]) => navigator.vibrate?.(p);
const delai = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
const centre = (el: Element): [number, number] => {
  const b = el.getBoundingClientRect();
  return [b.left + b.width / 2, b.top + b.height / 2];
};

type Phase = 'intro' | 'revele';
interface Boite {
  classe: '' | 'or' | 'rouge';
  texte: string;
  indice: string;
}

export function CineFin({ cine, classement, pseudo, onFini }: { cine: Cine; classement: Classement | null; pseudo: string; onFini: () => void }) {
  const calme = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches).current;
  const [phase, setPhase] = useState<Phase>('intro');
  const [boite, setBoite] = useState<Boite>({ classe: '', texte: '', indice: '' });
  const r = {
    racine: useRef<HTMLDivElement>(null),
    scene: useRef<HTMLDivElement>(null),
    nuit: useRef<HTMLDivElement>(null),
    lignes: useRef<HTMLDivElement>(null),
    gong: useRef<HTMLDivElement>(null),
    cri: useRef<HTMLDivElement>(null),
    ruban: useRef<HTMLDivElement>(null),
    podium: useRef<HTMLDivElement>(null),
    licence: useRef<HTMLDivElement>(null),
    tampon: useRef<HTMLDivElement>(null),
    flash: useRef<HTMLDivElement>(null),
    dialogue: useRef<HTMLDivElement>(null),
    toile: useRef<HTMLCanvasElement>(null),
  };
  const ctl = useRef({ saute: false, phase: 'intro' as Phase, revelA: 0, attentes: new Set<() => void>(), toucher: null as null | (() => void) });
  const rappel = useRef(onFini);
  rappel.current = onFini;

  const fin = cine.type === 'fin' && classement !== null;
  const moi = classement?.moi ?? null;
  const total = classement?.lignes.length ?? 0;
  const top = classement ? podium(classement.lignes) : [];
  const surPodium = moi !== null && moi.place <= 3 && top.some((p) => p.ligne.moi);
  const largeurMarche = Math.min(innerWidth * 0.94, 420) / 3.2;

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
    const A = (cible: Element | null | undefined, k: Keyframe[], o: KeyframeAnimationOptions & { duration: number }) => {
      if (!cible) return null;
      const vite = calme || c.saute;
      const a = cible.animate(k, { fill: 'both', easing: EASE, ...o, duration: vite ? 1 : o.duration, delay: vite ? 0 : (o.delay ?? 0) });
      anims.push(a);
      const finK = k[k.length - 1]!;
      if (finK.opacity !== undefined && cible instanceof HTMLElement) cible.style.opacity = String(finK.opacity);
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
    const secousse = (force: number) => {
      if (!vif()) return;
      try {
        r.scene.current?.animate(
          [{ translate: '0 0' }, { translate: `${force}px ${-force * 0.6}px` }, { translate: `${-force * 0.8}px ${force * 0.5}px` }, { translate: `${force * 0.4}px 0` }, { translate: '0 0' }],
          { duration: 380, easing: 'linear', composite: 'add' },
        );
      } catch {
        // `composite` inconnu : pas de secousse
      }
    };
    const frappe = (el: Element | null | undefined, rot = 0) =>
      A(el, [{ opacity: 0, scale: 2.1, rotate: `${rot}deg` }, { opacity: 1, scale: 0.94, offset: 0.7 }, { opacity: 1, scale: 1, rotate: `${rot}deg` }], { duration: 300, easing: REBOND });
    /** La voix du jeu : le texte s'écrit, puis on attend un toucher. */
    const dire = async (texte: string, indice: string, classe: Boite['classe']) => {
      c.phase = 'revele';
      setPhase('revele');
      c.saute = false;
      setBoite({ classe, texte: '', indice: '' });
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

    // 1. Fin de partie : le gong, « FIN DE PARTIE », le podium, ta place.
    const gong = async (cl: Classement) => {
      // a. La nuit tombe, le gong descend.
      A(r.nuit.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 500 });
      A(r.gong.current, [{ opacity: 0, translate: '-50% -62%' }, { opacity: 1, translate: '-50% -50%' }], { duration: 650, delay: 200 });
      await pause(1000);
      if (!vivant) return;
      // b. Le coup : éclair, ondes, le disque tremble, l'écran aussi.
      const disque = r.gong.current?.querySelector('.fp-centre');
      const [gx, gy] = disque ? centre(disque) : [innerWidth / 2, innerHeight * 0.4];
      vibrer([90, 50, 220]);
      A(r.flash.current, [{ opacity: 0.9 }, { opacity: 0 }], { duration: 260 });
      if (vif()) {
        fx.onde(gx, gy, BRONZE, 1.3);
        setTimeout(() => vivant && fx.onde(gx, gy, '#f6f6f2', 1.6), 160);
        setTimeout(() => vivant && fx.onde(gx, gy, BRONZE, 1.9), 340);
        fx.etincelles(gx, gy, 40, BRONZE, 0.7);
      }
      A(r.gong.current?.querySelector('.fp-disque'), [{ rotate: '0deg' }, { rotate: '7deg' }, { rotate: '-5deg' }, { rotate: '3deg' }, { rotate: '-1.5deg' }, { rotate: '0deg' }], {
        duration: 1600,
        easing: 'ease-out',
      });
      A(r.gong.current, [{ scale: 1 }, { scale: 1.06 }, { scale: 0.98 }, { scale: 1.02 }, { scale: 1 }], { duration: 900, easing: 'ease-out' });
      secousse(12);
      A(r.lignes.current, [{ opacity: 0, scale: 1.3 }, { opacity: 0.55, scale: 1 }], { duration: 400 });
      await pause(1100);
      if (!vivant) return;
      // c. Le gong s'efface, « FIN DE PARTIE » frappé.
      A(r.gong.current, [{ opacity: 1 }, { opacity: 0.18 }], { duration: 400 });
      frappe(r.cri.current, -4);
      vibrer(40);
      setTimeout(() => vivant && secousse(8), calme ? 0 : 200);
      await pause(1100);
      if (!vivant) return;
      // d. Après un Clear : le gagnant rappelé en tête, ruban doré.
      if (cl.gagnant) {
        A(r.ruban.current, [{ opacity: 1, clipPath: 'inset(0 50% 0 50%)' }, { opacity: 1, clipPath: 'inset(0 0% 0 0%)' }], { duration: 520 });
        setTimeout(() => {
          if (vivant && vif() && r.ruban.current) fx.etincelles(...centre(r.ruban.current), 30, '#ffd877', 0.5);
        }, 300);
        await pause(1000);
        if (!vivant) return;
      }
      // e. Le podium : 3e, 2e, 1er. Les marches montent, les noms sont frappés.
      A(r.gong.current, [{ opacity: 0.18 }, { opacity: 0 }], { duration: 300 });
      A(r.lignes.current, [{ opacity: 0.55 }, { opacity: 0.25 }], { duration: 400 });
      for (const p of [3, 2, 1]) {
        const m = r.podium.current?.querySelector(`[data-p="${p}"]`);
        if (!m) continue;
        await fini(A(m.querySelector('.fp-bloc'), [{ translate: '0 101%' }, { translate: '0 0' }], { duration: p === 1 ? 620 : 480, easing: 'cubic-bezier(.2,1.25,.4,1)' }));
        if (!vivant) return;
        frappe(m.querySelector('.fp-nom'));
        vibrer(p === 1 ? [30, 30, 60] : 25);
        const bloc = m.querySelector('.fp-bloc');
        if (vif() && bloc) {
          const [mx, my] = centre(bloc);
          fx.etincelles(mx, my - 20, p === 1 ? 50 : 22, p === 1 ? '#ffd877' : p === 2 ? '#e9ecef' : '#f2b48a', p === 1 ? 0.8 : 0.5);
        }
        await pause(p === 1 ? 900 : 520);
        if (!vivant) return;
      }
      // f. Ta place tombe en dernier, comme un tampon (« TOI » sur ta marche si tu es sur le podium).
      const tp = r.tampon.current;
      if (tp && cl.moi) {
        if (surPodium) {
          const bloc = r.podium.current?.querySelector(`[data-p="${cl.moi.place}"] .fp-bloc`) ?? r.podium.current?.querySelector('.moi .fp-bloc');
          if (bloc) {
            const b = bloc.getBoundingClientRect();
            tp.style.left = `${b.left + b.width / 2}px`;
            tp.style.top = `${b.top + b.height * 0.6}px`;
          }
        } else A(r.podium.current, [{ opacity: 1 }, { opacity: 0.35 }], { duration: 400 });
        await pause(surPodium ? 100 : 350);
        if (!vivant) return;
        A(tp, [{ opacity: 0, scale: 2.4, rotate: '-4deg' }, { opacity: 1, scale: 0.92, rotate: '-13deg', offset: 0.75 }, { opacity: 1, scale: 1, rotate: '-12deg' }], {
          duration: 340,
          easing: 'cubic-bezier(.4,0,.6,1)',
        });
        setTimeout(() => {
          if (!vivant) return;
          vibrer([70]);
          secousse(9);
          if (vif()) fx.etincelles(...centre(tp), 26, '#ff6a5a', 0.5);
        }, calme ? 0 : 260);
        await pause(1100);
        if (!vivant) return;
      }
      // g. La voix du jeu.
      await dire(texteFin(cl, pseudo), 'Touche pour voir le classement', cl.gagnant ? 'or' : '');
      await fermer();
    };

    // 2. Abandon : la licence se raye, « ABANDON ».
    const abandon = async () => {
      A(r.nuit.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
      A(r.licence.current, [{ opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1 }], { duration: 500, delay: 150 });
      await pause(800);
      if (!vivant) return;
      // Le trait de pinceau rouge traverse la licence.
      A(r.licence.current?.querySelector('.fp-trait'), [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 320, easing: 'cubic-bezier(.6,0,.4,1)' });
      vibrer(35);
      await pause(360);
      if (!vivant) return;
      r.licence.current?.classList.add('rayee');
      secousse(7);
      await pause(420);
      if (!vivant) return;
      // Le tampon tombe.
      A(r.licence.current?.querySelector('.fp-tampon-abandon'), [{ opacity: 0, scale: 2.2 }, { opacity: 1, scale: 0.94, offset: 0.75 }, { opacity: 1, scale: 1 }], {
        duration: 320,
        easing: 'cubic-bezier(.4,0,.6,1)',
      });
      setTimeout(() => {
        if (!vivant) return;
        vibrer([60]);
        secousse(9);
      }, calme ? 0 : 240);
      await pause(1000);
      if (!vivant) return;
      await dire('Tu as quitté la partie. Tu restes classé avec ton Book : rendez-vous au classement final.', 'Touche pour continuer', 'rouge');
      await fermer();
    };

    if (cine.type === 'abandon') void abandon();
    else if (classement) void gong(classement);
    else rappel.current();

    return () => {
      vivant = false;
      anims.forEach((a) => a.cancel());
      fx.arreter();
    };
  }, []);

  return (
    <div
      ref={r.racine}
      className={`fp-cine ${phase}`}
      role="alertdialog"
      aria-modal="true"
      aria-label={cine.type === 'abandon' ? 'Abandon' : 'Fin de partie'}
      onPointerDown={surToucher}
    >
      <FiltreEncre />
      <FiltrePinceau />
      <div ref={r.scene} className="fp-scene">
        <div ref={r.nuit} className="fp-nuit" />
        <div ref={r.lignes} className="fp-lignes">
          <Concentration graine={23} />
        </div>
        {fin && (
          <>
            <div ref={r.gong} className="fp-gong">
              <Gong />
            </div>
            <div ref={r.cri} className="fp-cri">
              <span>FIN DE</span>
              <span>PARTIE</span>
            </div>
            {classement.gagnant && (
              <div ref={r.ruban} className="fp-c-ruban">
                <span className="fp-mini-sceau">
                  <Sceau bas="GAGNÉ" />
                </span>
                <span>
                  <b>CLEAR</b> · {classement.gagnant}
                </span>
              </div>
            )}
            <div ref={r.podium} className="fp-c-podium">
              {top.map(({ ligne, marche }) => (
                <div key={marche} className={`fp-c-marche p${marche}${ligne.moi ? ' moi' : ''}`} data-p={marche}>
                  <div className="fp-nom">
                    <b style={{ '--fs': `${tailleNom(ligne.pseudo, largeurMarche, marche === 1 ? 26 : 22).toFixed(1)}px` } as CSSProperties}>{ligne.pseudo}</b>
                    <span>
                      {ligne.cartes}/{classement.designees} · {ligne.points} pts
                    </span>
                  </div>
                  <div className="fp-bloc">
                    <strong>{ligne.place}</strong>
                  </div>
                </div>
              ))}
            </div>
            {moi && (
              <div ref={r.tampon} className={`fp-c-tampon${surPodium ? ' petit' : ''}`}>
                {surPodium ? <TamponPlace grand="TOI" /> : <TamponPlace grand={ordinal(moi.place)} petit={`SUR ${total}`} haut="TA PLACE" />}
              </div>
            )}
          </>
        )}
        {cine.type === 'abandon' && (
          <div ref={r.licence} className="fp-c-licence">
            <div className="fp-licence">
              <div className="fp-licence-tete">
                <EmblemeHunter />
                <div>
                  <strong>HUNTER</strong>
                  <span>Licence de Hunter</span>
                </div>
              </div>
              <div className="fp-qr">
                <QrCode texte="GREED ISLAND" titre="" marge={1} />
              </div>
              <div className="fp-licence-pied">
                <b>{pseudo}</b>
              </div>
            </div>
            <Rature trace={false} />
          </div>
        )}
      </div>
      <canvas ref={r.toile} className="fp-toile" aria-hidden="true" />
      <div ref={r.flash} className="fp-flash" />
      <div ref={r.dialogue} className="lancer-dialogue gi-dialogue fp-dialogue" role="status">
        <span className={`a-qui ${boite.classe}`}>Greed Island</span>
        <p className="a-texte">{boite.texte}</p>
        <p className={`a-indice${boite.indice ? ' visible' : ''}`}>{boite.indice || ' '}</p>
      </div>
      {phase === 'intro' && (
        <span className="lancer-passer fp-passer" aria-hidden="true">
          Touche pour passer
        </span>
      )}
    </div>
  );
}
