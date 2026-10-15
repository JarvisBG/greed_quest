// Cinématiques des cartes de Maître du jeu (prototype validé par Sivraj le 2026-10-15 : docs/prototype/cartes-gm.html).
// Jarvis tout-puissant (lanceur) : nuit dorée, la carte noire monte, « JARVIS A PARLÉ » frappe (rayons, éclair, secousse),
// l'onde d'or fige les joueurs à portée (Jugement), puis la carte choisie se matérialise sous une ligne d'or (Décret).
// Le Sceau d'Ange (lanceur et cible) : nuit rouge, « SCEAU ! », le Book visé, chaînes en croix, sceau 封 qui s'abat ;
// chez la cible, les bords de l'écran battent en rouge. Toucher pendant la séquence saute à la fin, puis ferme.
// Leçons des cinématiques : l'état final est posé en style, toute animation est annulée à la fin.
import { Carte, CarteNoire } from '@gq/ui';
import { useEffect, useRef, useState } from 'react';

export type CineGm =
  | { kind: 'jarvis'; carte: { numero: number | null; nom: string; rang: import('@gq/shared').Rank | null; limite: number | null; texte: string | null }; reprisA: string | null; figes: string[]; texte: string }
  | { kind: 'sceau'; cible: string; texte: string }
  | { kind: 'sceau-recu'; lanceur: string; texte: string };

const vibrer = (p: number | number[]) => navigator.vibrate?.(p);

export function CinematiqueGm({ cine, onFini }: { cine: CineGm; onFini: () => void }) {
  const calme = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches).current;
  const [pret, setPret] = useState(false);
  const r = {
    nuit: useRef<HTMLDivElement>(null),
    halo: useRef<HTMLDivElement>(null),
    rayons: useRef<HTMLDivElement>(null),
    bords: useRef<HTMLDivElement>(null),
    scene: useRef<HTMLDivElement>(null),
    cri: useRef<HTMLParagraphElement>(null),
    carte: useRef<HTMLDivElement>(null),
    onde: useRef<HTMLDivElement>(null),
    pions: useRef<HTMLDivElement>(null),
    creee: useRef<HTMLDivElement>(null),
    ligne: useRef<HTMLSpanElement>(null),
    reprise: useRef<HTMLParagraphElement>(null),
    livre: useRef<HTMLDivElement>(null),
    ch1: useRef<HTMLSpanElement>(null),
    ch2: useRef<HTMLSpanElement>(null),
    sceau: useRef<HTMLSpanElement>(null),
    boite: useRef<HTMLDivElement>(null),
  };
  const ctl = useRef({ anims: [] as Animation[], minuteries: [] as number[], fin: () => {} });
  const rappel = useRef(onFini);
  rappel.current = onFini;

  useEffect(() => {
    const c = ctl.current;
    const A = (el: Element | null, k: Keyframe[], o: KeyframeAnimationOptions) => {
      if (!el) return null;
      const a = el.animate(k, { fill: 'forwards', ...o });
      c.anims.push(a);
      return a;
    };
    const T = (f: () => void, ms: number) => c.minuteries.push(window.setTimeout(f, ms));
    const st = (el: HTMLElement | null, s: Partial<CSSStyleDeclaration>) => el && Object.assign(el.style, s);
    const secousse = () => A(r.scene.current, [{ transform: 'translate(0,0)' }, { transform: 'translate(-7px,5px)' }, { transform: 'translate(6px,-5px)' }, { transform: 'translate(-3px,2px)' }, { transform: 'translate(0,0)' }], { duration: 300, fill: 'none' });
    const pions = () => [...(r.pions.current?.children ?? [])] as HTMLElement[];

    // État final, posé en style : il reste juste quand les animations sont lâchées.
    c.fin = () => {
      for (const t of c.minuteries) clearTimeout(t);
      c.minuteries = [];
      for (const a of c.anims) a.cancel();
      c.anims = [];
      st(r.cri.current, { opacity: '0' });
      st(r.carte.current, { opacity: '0' });
      st(r.boite.current, { opacity: '1', transform: 'none' });
      st(r.halo.current, { opacity: '0.4' });
      if (cine.kind === 'jarvis') {
        st(r.rayons.current, { opacity: '0.4' });
        st(r.creee.current, { opacity: '1', clipPath: 'none', transform: 'none' });
        st(r.reprise.current, { opacity: cine.reprisA ? '1' : '0' });
        for (const p of pions()) {
          p.style.opacity = '1';
          p.classList.add('fige');
        }
      } else {
        st(r.livre.current, { opacity: '1', transform: 'none' });
        st(r.ch1.current, { opacity: '1', transform: 'none' });
        st(r.ch2.current, { opacity: '1', transform: 'none' });
        st(r.sceau.current, { opacity: '1', transform: 'rotate(-12deg)' });
        st(r.bords.current, { opacity: cine.kind === 'sceau-recu' ? '0.6' : '0' });
      }
      setPret(true);
    };
    if (calme) {
      c.fin();
      return;
    }

    if (cine.kind === 'jarvis') {
      A(r.halo.current, [{ opacity: 0, transform: 'scale(0.3)' }, { opacity: 0.55, transform: 'scale(1)' }], { duration: 900, delay: 150, easing: 'ease-out' });
      // 1. La carte noire monte dans la nuit, puis tremble.
      A(r.carte.current, [{ opacity: 0, transform: 'translateY(60vh) rotate(-8deg) scale(0.7)' }, { opacity: 1, transform: 'translateY(-2vh) rotate(2deg) scale(1.03)', offset: 0.75 }, { opacity: 1, transform: 'none' }], { duration: 900, delay: 150, easing: 'cubic-bezier(0.16,1,0.3,1)' });
      A(r.carte.current, [{ transform: 'none' }, { transform: 'translateX(-3px) rotate(-1deg)' }, { transform: 'translateX(3px) rotate(1deg)' }, { transform: 'none' }], { duration: 110, iterations: 6, delay: 1100, fill: 'none', composite: 'add' });
      // 2. Éclair : « JARVIS A PARLÉ » frappe, rayons d'or, secousse, vibration.
      T(() => {
        A(r.rayons.current, [{ opacity: 0, transform: 'rotate(0)' }, { opacity: 0.7, transform: 'rotate(25deg)', offset: 0.2 }, { opacity: 0.45, transform: 'rotate(90deg)' }], { duration: 4200 });
        A(r.cri.current, [{ opacity: 0, transform: 'scale(2.4)' }, { opacity: 1, transform: 'scale(0.94)', offset: 0.6 }, { opacity: 1, transform: 'scale(1)' }], { duration: 380, easing: 'cubic-bezier(0.2,0.8,0.2,1)' });
        A(r.nuit.current, [{ backgroundColor: '#fff4cf' }, { backgroundColor: '#08080a' }], { duration: 420, fill: 'none' });
        secousse();
        vibrer([60, 40, 120]);
      }, 1750);
      // 3. Jugement : l'onde d'or part de la carte, les joueurs à portée se figent l'un après l'autre.
      T(() => {
        A(r.carte.current, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.25)' }], { duration: 420, easing: 'ease-in' });
        A(r.onde.current, [{ opacity: 1, transform: 'scale(0.5)', borderWidth: '6px' }, { opacity: 0, transform: 'scale(16)', borderWidth: '1px' }], { duration: 1000, easing: 'cubic-bezier(0.16,1,0.3,1)' });
        pions().forEach((p, i) => {
          A(p, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: 120 + i * 70 });
          T(() => {
            p.classList.add('fige');
            vibrer(25);
          }, 520 + i * 180);
        });
      }, 2700);
      // 4. Décret : la carte choisie se matérialise sous une ligne d'or qui descend.
      T(() => {
        A(r.cri.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
        A(r.creee.current, [{ opacity: 1, clipPath: 'inset(0 0 100% 0)', transform: 'translateY(-12px)' }, { opacity: 1, clipPath: 'inset(0 0 0% 0)', transform: 'none' }], { duration: 1100, easing: 'cubic-bezier(0.3,0,0.2,1)' });
        A(r.ligne.current, [{ opacity: 1, top: '0%' }, { opacity: 1, top: '100%', offset: 0.95 }, { opacity: 0, top: '100%' }], { duration: 1150, easing: 'cubic-bezier(0.3,0,0.2,1)' });
        if (cine.reprisA) A(r.reprise.current, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: 300 });
      }, 4300);
      T(() => {
        A(r.creee.current, [{ filter: 'brightness(2.2)' }, { filter: 'brightness(1)' }], { duration: 500, fill: 'none' });
        secousse();
        vibrer(50);
      }, 5420);
      T(() => A(r.boite.current, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 320 }), 5800);
      T(() => c.fin(), 6150);
    } else {
      if (cine.kind === 'sceau-recu') {
        A(r.bords.current, [{ opacity: 0 }, { opacity: 1 }, { opacity: 0.3 }, { opacity: 1 }, { opacity: 0.6 }], { duration: 1200 });
        vibrer([80, 60, 80]);
      }
      A(r.halo.current, [{ opacity: 0, transform: 'scale(0.3)' }, { opacity: 0.45, transform: 'scale(1)' }], { duration: 800, delay: 100 });
      // 1. La carte d'Ange monte, « SCEAU ! », puis elle s'efface.
      A(r.carte.current, [{ opacity: 0, transform: 'translateY(50vh) rotate(8deg) scale(0.7)' }, { opacity: 1, transform: 'none' }], { duration: 800, delay: 150, easing: 'cubic-bezier(0.16,1,0.3,1)' });
      T(() => {
        A(r.cri.current, [{ opacity: 0, transform: 'scale(2.2)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(0.2,0.8,0.2,1)' });
        A(r.carte.current, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.2) translateY(-20px)' }], { duration: 450, delay: 300, easing: 'ease-in' });
        secousse();
        vibrer(60);
      }, 1100);
      // 2. Le Book visé apparaît ; les chaînes le ceinturent.
      T(() => {
        A(r.livre.current, [{ opacity: 0, transform: 'scale(0.85)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.16,1,0.3,1)' });
        [r.ch1.current, r.ch2.current].forEach((x, i) => A(x, [{ opacity: 0, transform: `translateX(${i ? 120 : -120}%)` }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 380 + i * 160, easing: 'cubic-bezier(0.3,0,0.2,1)' }));
      }, 1700);
      // 3. Le sceau 封 s'abat : impact, éclair rouge, secousse.
      T(() => {
        A(r.sceau.current, [{ opacity: 0, transform: 'scale(3) rotate(-30deg)' }, { opacity: 1, transform: 'scale(0.92) rotate(-12deg)', offset: 0.7 }, { opacity: 1, transform: 'scale(1) rotate(-12deg)' }], { duration: 360, easing: 'cubic-bezier(0.5,0,0.75,0)' });
        T(() => {
          A(r.nuit.current, [{ backgroundColor: '#5a0a0e' }, { backgroundColor: '#08080a' }], { duration: 500, fill: 'none' });
          secousse();
          vibrer([120, 50, 40]);
        }, 330);
        A(r.cri.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 600 });
      }, 2600);
      T(() => A(r.boite.current, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 320 }), 3500);
      T(() => c.fin(), 3850);
    }
    return () => {
      for (const t of c.minuteries) clearTimeout(t);
      for (const a of c.anims) a.cancel();
    };
  }, []);

  const toucher = () => {
    if (pret) rappel.current();
    else ctl.current.fin();
  };
  const sceau = cine.kind !== 'jarvis';

  return (
    <div
      className={`cine-gm ${sceau ? 'rouge' : 'or'}`}
      ref={r.nuit}
      role="dialog"
      aria-modal="true"
      aria-label={cine.kind === 'jarvis' ? 'Jarvis a parlé' : 'Le Sceau d’Ange'}
      onClick={toucher}
    >
      <div className="cg-halo" ref={r.halo} />
      {!sceau && <div className="cg-rayons" ref={r.rayons} />}
      {cine.kind === 'sceau-recu' && <div className="cg-bords" ref={r.bords} />}
      <div className="cg-scene" ref={r.scene}>
        <p className="cg-cri" ref={r.cri} aria-hidden="true">
          {sceau ? (
            'SCEAU !'
          ) : (
            <>
              JARVIS
              <br />A PARLÉ
            </>
          )}
        </p>
        <div className="cg-carte" ref={r.carte}>
          <CarteNoire gm={sceau ? 'ange' : 'jarvis'} />
        </div>
        {cine.kind === 'jarvis' ? (
          <>
            <div className="cg-onde" ref={r.onde} />
            <div className="cg-pions" ref={r.pions}>
              {cine.figes.map((p) => (
                <div key={p} className="cg-pion">
                  <span className="tete">{p[0]}</span>
                  {p}
                  <span className="etiq">FIGÉ 3:00</span>
                </div>
              ))}
            </div>
            <p className="cg-reprise" ref={r.reprise}>
              {cine.reprisA ? `Reprise à ${cine.reprisA}` : ''}
            </p>
            <div className="cg-creee" ref={r.creee}>
              <Carte genre="designee" numero={cine.carte.numero} nom={cine.carte.nom} rang={cine.carte.rang} limite={cine.carte.limite} texte={cine.carte.texte} />
              <span className="ligne" ref={r.ligne} />
            </div>
          </>
        ) : (
          <div className="cg-livre" ref={r.livre}>
            BOOK
            <span className="qui">{cine.kind === 'sceau-recu' ? 'Ton Book' : `Book de ${cine.cible}`}</span>
            <span className="chaine" ref={r.ch1} style={{ rotate: '28deg' }} />
            <span className="chaine" ref={r.ch2} style={{ rotate: '-28deg' }} />
            <span className="sceau" ref={r.sceau} lang="ja">
              封
            </span>
          </div>
        )}
      </div>
      <div className="gi-dialogue cg-boite" ref={r.boite} aria-live="assertive">
        <span className="a-qui">{cine.kind === 'jarvis' ? 'Jarvis tout-puissant' : cine.kind === 'sceau' ? 'Le Sceau d’Ange' : 'Sort reçu'}</span>
        <p>{cine.texte}</p>
        <span className="suite">Toucher pour continuer</span>
      </div>
      {!pret && <span className="cg-passer">Toucher pour passer</span>}
    </div>
  );
}
