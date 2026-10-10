// Cinématique du tirage (page ⑥ ; prototype validé par Sivraj le 2026-10-10 : docs/prototype/scanner-tirage.html).
// La nuit sort du QR visé, la carte jaillit de dos dans un nuage de fumée, la lumière de son rang fuit par ses bords
// (plus le rang est haut, plus l'attente et l'éclat durent), elle se retourne en frappant, la boîte du jeu dit ce
// qu'on a obtenu ; au toucher, elle vole en arc se ranger dans l'onglet Book (Sorts pour un sort).
// Les jenny frappent puis filent dans le compteur. Toucher pendant l'apparition saute à la révélation.
// Jouée au niveau de l'app : pour un scan, et pour chaque tirage rejoué au retour du réseau (RG-7.5).
import { Carte, Concentration, DosCarte } from '@gq/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { eclatDe, indiceRangement, ongletDe, phraseGain, tamponDe, type CarteTiree, type Eclat, type Etape } from '../../lib/tirage';
import { creerEffets } from './effets';

export interface DemandeTirage {
  id: number;
  etapes: Etape[];
  /** Le scan a consommé un Second souffle (annoncé dans la première phrase). */
  secondSouffle: boolean;
  /** Point de l'écran d'où sort la nuit (le QR visé) ; à défaut, le centre. */
  origine: [number, number] | null;
  /** Une étape de jenny vient d'arriver dans le compteur. */
  surJenny?: ((montant: number) => void) | undefined;
  fini: () => void;
}

export interface OptionsTirage {
  secondSouffle?: boolean | undefined;
  origine?: [number, number] | null | undefined;
  surJenny?: ((montant: number) => void) | undefined;
}

/** File des tirages à jouer : `jouer` rend une promesse résolue quand la carte est rangée. */
export function useTirages() {
  const [file, setFile] = useState<DemandeTirage[]>([]);
  const fileRef = useRef(file);
  fileRef.current = file;
  const n = useRef(0);
  const jouer = useCallback(
    (etapes: Etape[], o: OptionsTirage = {}) =>
      new Promise<void>((fini) => {
        if (!etapes.length) return fini();
        setFile((f) => [...f, { id: ++n.current, etapes, secondSouffle: !!o.secondSouffle, origine: o.origine ?? null, surJenny: o.surJenny, fini }]);
      }),
    [],
  );
  const terminer = useCallback(() => {
    const c = fileRef.current[0];
    setFile((f) => f.slice(1));
    c?.fini();
  }, []);
  return { courant: file[0] ?? null, jouer, terminer };
}

const EASE = 'cubic-bezier(.16,1,.3,1)';
type Phase = 'intro' | 'revele' | 'range';
const centre = (el: Element): [number, number] => {
  const b = el.getBoundingClientRect();
  return [b.left + b.width / 2, b.top + b.height / 2];
};
const vibrer = (p: number | number[]) => navigator.vibrate?.(p);

export function Tirage({ demande, onFini }: { demande: DemandeTirage; onFini: () => void }) {
  const calme = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches).current;
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [texte, setTexte] = useState('');
  const [indice, setIndice] = useState(false);
  const r = {
    racine: useRef<HTMLDivElement>(null),
    nuit: useRef<HTMLDivElement>(null),
    lignes: useRef<HTMLDivElement>(null),
    lettre: useRef<HTMLDivElement>(null),
    toile: useRef<HTMLCanvasElement>(null),
    jenny: useRef<HTMLDivElement>(null),
    rayons: useRef<HTMLDivElement>(null),
    scene: useRef<HTMLDivElement>(null),
    vol: useRef<HTMLDivElement>(null),
    ret: useRef<HTMLDivElement>(null),
    flash: useRef<HTMLDivElement>(null),
    dialogue: useRef<HTMLDivElement>(null),
  };
  /** État partagé entre la séquence et le toucher, hors rendu. */
  const ctl = useRef({ saute: false, phase: 'intro' as Phase, revelA: 0, attentes: new Set<() => void>(), toucher: null as null | (() => void) });
  const fin = useRef(onFini);
  fin.current = onFini;

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
    const el = {
      racine: r.racine.current!,
      nuit: r.nuit.current!,
      lignes: r.lignes.current!,
      lettre: r.lettre.current!,
      jenny: r.jenny.current!,
      rayons: r.rayons.current!,
      scene: r.scene.current!,
      vol: r.vol.current!,
      ret: r.ret.current!,
      flash: r.flash.current!,
      dialogue: r.dialogue.current!,
    };
    const fx = creerEffets(r.toile.current!, () => el.ret.getBoundingClientRect());
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
    // Rayons (S, SS, A) : élément de la page, tourné et fondu par le navigateur, sans repeindre l'écran.
    let tourne: Animation | null = null;
    const rayons = (de: number, a: number, ms: number, easing = 'linear') => A(el.rayons, [{ opacity: de }, { opacity: a }], { duration: ms, easing });
    const opaciteRayons = () => Number(getComputedStyle(el.rayons).opacity) || 0;
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
      if (calme || c.saute) return setTexte(t);
      for (let n = 1; n <= t.length; n++) {
        if (!vivant) return;
        setTexte(t.slice(0, n));
        await new Promise((res) => setTimeout(res, 22));
      }
    };
    const secouer = (px: number) => {
      if (!px || calme) return;
      el.scene.animate(
        [{ transform: 'translate(0,0)' }, { transform: `translate(${-px}px, ${px * 0.6}px)` }, { transform: `translate(${px * 0.8}px, ${-px * 0.6}px)` }, { transform: `translate(${-px * 0.4}px, ${px * 0.3}px)` }, { transform: 'translate(0,0)' }],
        { duration: 200, easing: 'linear' },
      );
    };
    const cacher = () => {
      el.nuit.style.opacity = '0';
      el.nuit.style.clipPath = '';
      el.lignes.style.opacity = '0';
      el.lettre.style.opacity = '0';
      el.vol.style.opacity = '0';
      el.dialogue.style.opacity = '0';
      el.jenny.style.opacity = '0';
      el.rayons.style.opacity = '0';
      tourne?.cancel();
      tourne = null;
      vider();
    };
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

    // ---------- Jenny : le montant frappe, puis file dans le compteur ----------
    const jouerJenny = async (montant: number, premier: boolean) => {
      vider();
      el.vol.style.opacity = '0';
      A(el.nuit, [{ opacity: premier ? 0 : 1, clipPath: 'none' }, { opacity: 0.92, clipPath: 'none' }], { duration: 220, easing: 'ease-out' });
      A(el.lignes, [{ opacity: 0, transform: 'scale(1.3)' }, { opacity: 0.6, transform: 'scale(1)' }], { duration: 420 });
      A(el.jenny, [{ opacity: 0, transform: 'scale(2.6)' }, { opacity: 1, transform: 'scale(.94)', offset: 0.7 }, { opacity: 1, transform: 'scale(1)' }], { duration: 380, easing: 'cubic-bezier(.5,0,.75,0)' });
      await pause(300);
      if (!vivant) return;
      if (!c.saute) {
        vibrer(20);
        const [x, y] = centre(el.jenny);
        fx.etincelles(x, y, 70, '#f6d36b', 0.8);
        fx.onde(x, y, '#f6d36b', 0.7);
      }
      await pause(700);
      if (!vivant) return;
      mettrePhase('range');
      vider();
      el.nuit.style.opacity = '0.92';
      el.nuit.style.clipPath = 'none';
      el.jenny.style.opacity = '1';
      el.lignes.style.opacity = '0.6';
      const compteur = document.querySelector('.barre .jenny');
      const [tx, ty] = compteur ? centre(compteur) : [innerWidth - 40, 30];
      const [gx, gy] = centre(el.jenny);
      A(el.lignes, [{ opacity: 0.6 }, { opacity: 0 }], { duration: 300 });
      A(el.nuit, [{ opacity: 0.92 }, { opacity: 0 }], { duration: 420, delay: 120, easing: 'ease-in' });
      await fini(A(el.jenny, [{ transform: 'none', opacity: 1 }, { transform: `translate(${tx - gx}px, ${ty - gy}px) scale(.2)`, opacity: 0.9 }], { duration: 520, easing: 'cubic-bezier(.5,0,.75,0)' }));
      if (!vivant) return;
      cacher();
      demande.surJenny?.(montant);
      compteur?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: calme ? 1 : 300, easing: EASE });
    };

    // ---------- Carte : apparition dans la fumée, fuite du rang, retournement, rangement ----------
    const impact = (E: Eclat, carte: CarteTiree) => {
      const [x, y] = centre(el.ret);
      vibrer(E.secousse > 5 ? [35, 40, 25] : 25);
      if (E.inverse) A(el.racine, [{ filter: 'invert(1)' }, { filter: 'invert(1)', offset: 0.99 }, { filter: 'none' }], { duration: 80, easing: 'linear', fill: 'none' });
      A(el.flash, [{ opacity: E.inverse ? 0.6 : 0.3 }, { opacity: 0 }], { duration: 240, easing: 'ease-out' });
      fx.etincelles(x, y, E.etincelles, E.couleur, E.etincelles > 150 ? 1.1 : 0.8);
      fx.onde(x, y, E.couleur, E.etincelles > 150 ? 1.4 : 0.9);
      fx.fuite(0, E.couleur);
      if (E.rayons) rayons(E.rayons * 0.75, E.rayons * 0.6, 400, EASE);
      secouer(E.secousse);
      A(el.lettre, [{ opacity: 0, transform: 'scale(2.2)' }, { opacity: carte.rang === 'D' ? 1 : 0.95, transform: 'scale(1)' }], { duration: 360, easing: 'cubic-bezier(.5,0,.75,0)' });
    };
    const poserRevele = (E: Eclat, carte: CarteTiree) => {
      vider();
      c.revelA = performance.now();
      mettrePhase('revele');
      el.nuit.style.opacity = '1';
      el.nuit.style.clipPath = 'none';
      el.lignes.style.opacity = '0.35';
      el.lignes.style.transform = 'none';
      el.vol.style.opacity = '1';
      el.vol.style.transform = 'none';
      el.ret.style.transform = 'rotateY(0deg)';
      el.lettre.style.opacity = carte.rang === 'D' ? '1' : '0.95';
      el.lettre.style.transform = 'none';
      fx.fuite(0, E.couleur);
      el.rayons.style.opacity = '0';
      if (E.rayons) rayons(E.rayons * 0.6, 0, 2600, 'ease-in');
      el.dialogue.style.opacity = '1';
      if (!calme) el.dialogue.animate([{ transform: 'translateY(30px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: EASE });
    };
    const ranger = async (carte: CarteTiree) => {
      mettrePhase('range');
      const onglet = document.querySelector(`.onglets [data-onglet="${ongletDe(carte)}"]`);
      const [tx, ty] = onglet ? centre(onglet) : [innerWidth / 2, innerHeight - 30];
      const b = el.vol.getBoundingClientRect();
      const dx = tx - (b.left + b.width / 2);
      const dy = ty - (b.top + b.height / 2);
      const R = Math.hypot(innerWidth, innerHeight);
      vibrer(10);
      // Dans `anims` : annulée à la fin, sinon elle cacherait la boîte de l'étape suivante.
      A(el.dialogue, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(24px)' }], { duration: 200, easing: 'ease' });
      A(el.lettre, [{ opacity: 1 }, { opacity: 0, transform: 'scale(.9)' }], { duration: 220 });
      A(el.lignes, [{ opacity: 0.35 }, { opacity: 0 }], { duration: 250 });
      rayons(opaciteRayons(), 0, 300);
      A(el.nuit, [{ clipPath: `circle(${R}px at ${tx}px ${ty}px)` }, { clipPath: `circle(0px at ${tx}px ${ty}px)` }], { duration: 560, delay: 80, easing: 'cubic-bezier(.6,0,.4,1)' });
      await fini(
        A(
          el.vol,
          [
            { transform: 'none', easing: 'cubic-bezier(.2,.7,.3,1)' },
            { transform: `translate(${dx * 0.18}px, ${dy * 0.18 - 70}px) scale(.72) rotate(-6deg)`, offset: 0.32, easing: 'cubic-bezier(.6,0,.9,.5)' },
            { transform: `translate(${dx}px, ${dy}px) scale(${30 / b.width}) rotate(-18deg)` },
          ],
          { duration: 640, easing: 'linear' },
        ),
      );
      if (!vivant) return;
      cacher();
      fx.vider();
      if (onglet) {
        onglet.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.16)' }, { transform: 'scale(1)' }], { duration: calme ? 1 : 320, easing: EASE });
        plusUn(onglet);
      }
    };
    const jouerCarte = async (carte: CarteTiree, premier: boolean, souffle: boolean) => {
      const E = eclatDe(carte);
      vider();
      fx.vider();
      el.lettre.style.opacity = '0';
      el.lettre.style.transform = '';
      el.vol.style.opacity = '1';
      el.vol.style.transform = '';
      el.ret.style.transform = '';
      el.dialogue.style.opacity = '0';
      el.rayons.style.opacity = '0';
      tourne?.cancel();
      tourne = null;
      if (E.rayons && !calme) {
        el.rayons.style.setProperty('--rayons', E.couleur);
        tourne = el.rayons.animate([{ rotate: '0deg' }, { rotate: '150deg' }], { duration: 9000, easing: 'linear', fill: 'forwards' });
      }

      // 1. La nuit sort du QR visé ; lignes de vitesse.
      const [qx, qy] = premier && demande.origine ? demande.origine : [innerWidth / 2, innerHeight * 0.42];
      const R = Math.hypot(innerWidth, innerHeight);
      A(el.nuit, [{ opacity: 1, clipPath: `circle(${premier ? 0 : R}px at ${qx}px ${qy}px)` }, { opacity: 1, clipPath: `circle(${R}px at ${qx}px ${qy}px)` }], { duration: 480, easing: 'cubic-bezier(.5,0,.2,1)' });
      A(el.lignes, [{ opacity: 0, transform: 'scale(1.4)' }, { opacity: 0.75, transform: 'scale(1)', offset: 0.5 }, { opacity: 0.35, transform: 'scale(.98)' }], { duration: 1100, easing: 'linear' });

      // 2. Pouf : la carte jaillit de dos dans un nuage de fumée, en tournoyant.
      await pause(160);
      if (!vivant) return;
      const s = el.scene.getBoundingClientRect();
      const cx = s.left + s.width / 2;
      const cy = s.top + (s.height - innerHeight * 0.18) / 2;
      if (!c.saute && !calme) {
        fx.fumee(cx, cy, 34);
        vibrer(10);
      }
      A(
        el.vol,
        [
          { transform: `translate(${qx - cx}px, ${qy - cy}px) scale(.18)`, opacity: 0 },
          { transform: `translate(${(qx - cx) * 0.2}px, ${(qy - cy) * 0.2 - 30}px) scale(.9)`, opacity: 1, offset: 0.45 },
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        ],
        { duration: 620, easing: 'cubic-bezier(.2,.9,.25,1)' },
      );
      A(el.ret, [{ transform: 'rotateY(900deg)' }, { transform: 'rotateY(180deg)' }], { duration: 760, easing: 'cubic-bezier(.12,.8,.2,1)' });
      await pause(720);
      if (!vivant) return;

      // 3. Suspense : la carte de dos tremble, la lumière de son rang fuit par les bords.
      if (E.attenteMs && !c.saute && !calme) {
        const t0 = performance.now();
        const monter = (t: number) => {
          if (!vivant || c.saute || c.phase !== 'intro') return;
          const k = Math.min(1, (t - t0) / E.attenteMs);
          fx.fuite(k, E.couleur, 40 + k * 220 * (E.etincelles / 150));
          if (k < 1) requestAnimationFrame(monter);
        };
        requestAnimationFrame(monter);
        const amp = 1.5 + E.secousse * 0.5;
        const tremb: Keyframe[] = [];
        for (let i = 0; i <= 12; i++) {
          const k = i / 12;
          tremb.push({ transform: `translate(${((i % 2 ? 1 : -1) * amp * k).toFixed(1)}px, ${(((i % 3) - 1) * amp * 0.5 * k).toFixed(1)}px) scale(${1 + k * 0.04})` });
        }
        A(el.vol, tremb, { duration: E.attenteMs, easing: 'linear' });
        if (E.rayons) rayons(0, E.rayons * 0.35, E.attenteMs, 'ease-in');
        A(el.lignes, [{ opacity: 0.35, transform: 'scale(.98)' }, { opacity: 0.85, transform: 'scale(.9)' }], { duration: E.attenteMs, easing: 'ease-in' });
        await pause(E.attenteMs);
        if (!vivant) return;
      }

      // 4. Retournement et impact.
      if (!c.saute) {
        fx.fuite(0, E.couleur);
        A(el.vol, [{ transform: `scale(${E.attenteMs ? 1.04 : 1})` }, { transform: 'scale(1.14)', offset: 0.5 }, { transform: 'scale(1)' }], { duration: 440 });
        A(el.ret, [{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(-14deg)', offset: 0.7 }, { transform: 'rotateY(0deg)' }], { duration: 440, easing: 'cubic-bezier(.3,0,.2,1)' });
        await pause(200);
        if (!vivant) return;
      }
      if (!c.saute && !calme) impact(E, carte);
      await pause(380);
      if (!vivant) return;
      if (!c.saute && !calme && E.double) {
        // SS : second coup, poussière d'or.
        const [x, y] = centre(el.ret);
        fx.etincelles(x, y, 180, E.couleur, 1.25);
        fx.onde(x, y, '#ffffff', 1.6);
        vibrer(40);
        A(el.flash, [{ opacity: 0.5 }, { opacity: 0 }], { duration: 260, easing: 'ease-out' });
        secouer(E.secousse * 1.3);
        await pause(300);
        if (!vivant) return;
      }

      // 5. Révélé : la boîte du jeu dit ce qu'on a obtenu ; on attend le toucher.
      poserRevele(E, carte);
      await taper(phraseGain(carte, souffle));
      if (!vivant) return;
      setIndice(true);
      await toucher();
      if (!vivant) return;
      await ranger(carte);
    };

    void (async () => {
      for (let i = 0; i < demande.etapes.length; i++) {
        const e = demande.etapes[i]!;
        c.saute = false;
        c.toucher = null;
        setIdx(i);
        setTexte('');
        setIndice(false);
        mettrePhase('intro');
        await deuxImages();
        if (!vivant) return;
        if (e.type === 'jenny') await jouerJenny(e.montant, i === 0);
        else await jouerCarte(e.carte, i === 0, demande.secondSouffle && i === 0);
        if (!vivant) return;
      }
      fin.current();
    })();

    return () => {
      vivant = false;
      [...c.attentes].forEach((f) => f());
      c.toucher?.();
      vider();
      tourne?.cancel();
      fx.arreter();
    };
    // une demande = une séquence (la clé du composant change avec la demande)
  }, []);

  const etape = demande.etapes[idx];
  const carte = etape?.type === 'carte' ? etape.carte : null;
  const phrase = carte ? phraseGain(carte, demande.secondSouffle && idx === 0) : '';
  return (
    <div ref={r.racine} className={`tirage ${phase}`} role="dialog" aria-modal="true" aria-label="Tirage" onPointerDown={surToucher}>
      <div ref={r.nuit} className="tirage-nuit" />
      <div ref={r.lignes} className="tirage-lignes">
        <Concentration graine={41} />
      </div>
      <div ref={r.lettre} className={`tirage-lettre${carte && carte.genre !== 'designee' ? ' mot' : ''}${carte?.rang === 'D' ? ' creux' : ''}`} style={{ color: carte && carte.rang !== 'D' ? eclatDe(carte).couleur : undefined }} aria-hidden="true">
        {carte ? tamponDe(carte) : ''}
      </div>
      <canvas ref={r.toile} className="tirage-toile" aria-hidden="true" />
      <div ref={r.jenny} className="tirage-jenny" aria-hidden="true">
        {etape?.type === 'jenny' && (
          <>
            +{etape.montant}
            <small>J</small>
          </>
        )}
      </div>
      <div ref={r.scene} className="tirage-scene">
        <div ref={r.rayons} className="tirage-rayons" aria-hidden="true" />
        <div ref={r.vol} className="tirage-vol">
          <div ref={r.ret} className="tirage-retourne">
            {carte && <Carte genre={carte.genre} numero={carte.numero} nom={carte.nom} rang={carte.rang} limite={carte.limite} texte={carte.texte} />}
            <DosCarte />
          </div>
        </div>
      </div>
      <div ref={r.flash} className="tirage-flash" />
      <div ref={r.dialogue} className="gi-dialogue tirage-dialogue">
        <span className="a-qui">Greed Island</span>
        <p className="a-texte" aria-hidden="true">
          {texte}
        </p>
        <p className={`a-indice${indice ? ' visible' : ''}`}>{carte ? indiceRangement(carte) : ''}</p>
      </div>
      <p className="sr" aria-live="polite">
        {phase !== 'intro' && etape?.type === 'carte' ? phrase : etape?.type === 'jenny' && phase === 'range' ? `${etape.montant} jenny reçus` : ''}
      </p>
      <span className="tirage-passer" aria-hidden="true">
        Touche pour passer
      </span>
    </div>
  );
}
