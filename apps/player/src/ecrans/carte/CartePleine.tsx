// Carte agrandie : le parchemin se déroule entre deux rouleaux (ses bords restent enroulés), puis l'encre trace les zones une à une,
// les trames et les noms se posent, et ton point tombe (≈ 2,3 s, toucher pour passer ; validé le 2026-10-10).
// Ensuite : pincer pour zoomer, glisser pour bouger, toucher deux fois pour zoomer, « Me retrouver ».
// Rouleaux épais aux bouts déchirés ; la feuille serre la carte entière et se déplie quand on zoome (validé le 2026-10-10).
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { cadrer, zoomerVue, type Cadrage, type Plan, type Vue } from '../../lib/carte';
import { DessinCarte, type EvenementZone } from './CarteIle';

const EASE = 'cubic-bezier(.16,1,.3,1)';

/** Bords déchirés, tirés une fois (toujours les mêmes) : haut et bas du parchemin, bouts des rouleaux. */
function dechirures() {
  let g = 41;
  const r = () => (g = (g * 16807) % 2147483647) / 2147483647;
  const bord = (y0: number, sens: number) => {
    const pts: string[] = [];
    for (let x = 0; x <= 100; x += 2 + r() * 3) pts.push(`${Math.min(100, x).toFixed(1)}% ${(y0 + sens * r() * 2).toFixed(2)}%`);
    pts.push(`100% ${y0}%`);
    return pts;
  };
  const parchemin = `polygon(${[...bord(0.4, 1), ...bord(99.6, -1).reverse()].join(',')})`;
  const bout = (y: number, sens: number) => [0, 14, 27, 41, 55, 70, 84, 100].map((x) => `${x}% calc(${y}% + ${(sens * (1 + r() * 6)).toFixed(1)}px)`);
  const rouleau = () => `polygon(${[...bout(0, 1), ...bout(100, -1).reverse()].join(',')})`;
  return { parchemin, gauche: rouleau(), droite: rouleau() };
}

const LEGENDE: { titre: string; dessin: React.JSX.Element }[] = [
  { titre: 'Aucune', dessin: <rect x="1" y="1" width="20" height="14" className="leg-cadre" fill="none" /> },
  { titre: '1', dessin: <rect x="1" y="1" width="20" height="14" className="leg-cadre" fill="url(#legt1)" /> },
  { titre: '2 ou 3', dessin: <rect x="1" y="1" width="20" height="14" className="leg-cadre" fill="url(#legt2)" /> },
  { titre: '4 et plus', dessin: <rect x="1" y="1" width="20" height="14" className="leg-cadre" fill="url(#legt3)" /> },
  { titre: 'Toi', dessin: <circle cx="11" cy="8" r="5" className="moi-point" /> },
  { titre: 'Évènement', dessin: <rect x="1" y="1" width="20" height="14" className="leg-ev" /> },
];

export function CartePleine({ plan, evenements, onFermer }: { plan: Plan; evenements: readonly EvenementZone[]; onFermer: () => void }) {
  const calme = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches).current;
  const W = plan.largeur;
  const H = plan.hauteur;
  const [vue, setVue] = useState<Vue>({ cx: W / 2, cy: H / 2, z: 1 });
  /** Taille de la scène, mesurée : la feuille et le zoom en dépendent. */
  const [taille, setTaille] = useState<{ w: number; h: number } | null>(null);
  /** La feuille ne glisse vers sa nouvelle taille qu'une fois qu'on a commencé à zoomer. */
  const [anime, setAnime] = useState(false);
  const cadrage: Cadrage | null = taille ? cadrer(vue, taille, W, H) : null;
  const cadrageRef = useRef(cadrage);
  cadrageRef.current = cadrage;
  const majVue = (v: Vue) => {
    setAnime(true);
    setVue(v);
  };
  const dechire = useMemo(dechirures, []);
  const [joue, setJoue] = useState(!calme);
  const arreter = useRef<() => void>(() => undefined);
  const r = {
    racine: useRef<HTMLDivElement>(null),
    scene: useRef<HTMLDivElement>(null),
    feuille: useRef<HTMLDivElement>(null),
    svg: useRef<SVGSVGElement>(null),
    fermer: useRef<HTMLButtonElement>(null),
  };

  // Plein écran : la page dessous ne défile plus ; Échap ferme.
  const fermer = useRef(onFermer);
  fermer.current = onFermer;
  useEffect(() => {
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    r.fermer.current?.focus({ preventScroll: true });
    const touche = (e: KeyboardEvent) => e.key === 'Escape' && fermer.current();
    addEventListener('keydown', touche);
    return () => {
      document.body.style.overflow = avant;
      removeEventListener('keydown', touche);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mesure de la scène, et à chaque changement de taille de l'écran.
  useLayoutEffect(() => {
    const scene = r.scene.current!;
    const mesurer = () => setTaille((t) => (t && t.w === scene.clientWidth && t.h === scene.clientHeight ? t : { w: scene.clientWidth, h: scene.clientHeight }));
    mesurer();
    const ro = new ResizeObserver(mesurer);
    ro.observe(scene);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Cinématique (une fois la feuille à sa taille) ----------
  const lancee = useRef(false);
  useLayoutEffect(() => {
    if (calme || !taille || lancee.current) return;
    lancee.current = true;
    const racine = r.racine.current!;
    const scene = r.scene.current!;
    const feuille = r.feuille.current!;
    const svg = r.svg.current!;
    const anims: Animation[] = [];
    const A = (el: Element, k: Keyframe[], o: KeyframeAnimationOptions) => {
      const a = el.animate(k, { fill: 'forwards', easing: EASE, ...o });
      anims.push(a);
      return a;
    };
    navigator.vibrate?.(12);
    const sc = scene.getBoundingClientRect();
    const pr = feuille.getBoundingClientRect();
    // 1. Le fond s'assombrit ; la feuille, roulée au centre, se déroule vers les deux bords.
    A(racine, [{ backgroundColor: 'rgba(12,10,6,0)' }, { backgroundColor: 'rgba(12,10,6,.5)' }], { duration: 200 });
    A(racine.querySelector('.plein-tete')!, [{ transform: 'translateY(-100%)' }, { transform: 'none' }], { duration: 420 });
    A(racine.querySelector('.plein-pied')!, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 420 });
    A(scene, [{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'linear' });
    A(
      feuille,
      [
        { clipPath: 'inset(-40px 50% -40px 50%)', transform: 'scale(.94) rotate(-1.2deg)', easing: 'cubic-bezier(.45,0,.2,1)' },
        { clipPath: 'inset(-40px -40px -40px -40px)', transform: 'none' },
      ],
      { duration: 720, delay: 120, easing: 'linear' },
    );
    // Deux rouleaux qui s'écartent du centre vers les bords de la feuille.
    const milieu = pr.left - sc.left + pr.width / 2;
    scene.querySelectorAll<HTMLElement>('.rouleau').forEach((el, i) => {
      el.style.top = `${pr.top - sc.top - 8}px`;
      el.style.height = `${pr.height + 16}px`;
      const bord = i === 0 ? pr.left - sc.left : pr.right - sc.left;
      A(
        el,
        [
          { left: `${milieu}px`, opacity: 1, transform: 'scaleX(1.25)', easing: 'cubic-bezier(.45,0,.2,1)' },
          { left: `${bord}px`, opacity: 1, transform: 'scaleX(1)', offset: 0.85 },
          { left: `${bord}px`, opacity: 0, transform: 'scaleX(.6)' },
        ],
        { duration: 840, delay: 120, easing: 'linear' },
      );
    });
    // Les rouleaux arrivés aux bords, le papier y reste enroulé.
    scene.querySelectorAll('.enroule').forEach((el) =>
      A(el, [{ opacity: 0, transform: 'scaleX(1.8)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: 760, easing: 'ease-out', fill: 'backwards' }),
    );
    // 2. L'encre : chaque zone se trace, puis sa trame et son nom se posent.
    const zones = [...svg.querySelectorAll('.zone')];
    zones.forEach((z, i) => {
      const t = 640 + i * 110;
      const forme = z.querySelector<SVGPolygonElement>('.zone-forme')!;
      const L = Math.ceil(forme.getTotalLength());
      A(forme, [{ strokeDasharray: `${L} ${L}`, strokeDashoffset: L }, { strokeDasharray: `${L} ${L}`, strokeDashoffset: 0 }], {
        duration: 520,
        delay: t,
        easing: 'cubic-bezier(.5,0,.3,1)',
        fill: 'backwards',
      });
      A(z.querySelector('.zone-fond')!, [{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: t + 320, easing: 'ease-out', fill: 'backwards' });
      A(z.querySelector('.zone-label')!, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 360, delay: t + 380, fill: 'backwards' });
      const ev = z.querySelector('.ev-etiquette');
      if (ev) A(ev, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: t + 520, fill: 'backwards' });
    });
    // 3. Toi : le point tombe, une onde part une seule fois.
    const fin = 640 + zones.length * 110 + 520;
    const moi = svg.querySelector('.moi');
    if (moi) {
      A(moi, [{ opacity: 0, transform: 'translate(0,-18px) scale(1.6)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: fin, fill: 'backwards' });
      A(
        moi.querySelector('.moi-halo')!,
        [
          { transform: 'scale(.2)', opacity: 1 },
          { transform: 'scale(2.4)', opacity: 0, offset: 0.7 },
          { transform: 'scale(1)', opacity: 1 },
        ],
        { duration: 900, delay: fin + 200, easing: 'ease-out', fill: 'backwards' },
      );
    }
    const minuteur = window.setTimeout(() => setJoue(false), fin + 900);
    // Démontage (ou double montage du mode strict) : on arrête et on pourra relancer.
    const nettoyer = () => {
      clearTimeout(minuteur);
      anims.forEach((a) => a.cancel());
      lancee.current = false;
    };
    arreter.current = () => {
      nettoyer();
      lancee.current = true;
      setJoue(false);
    };
    return nettoyer;
  }, [taille !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Zoom et déplacement ----------
  const versPlan = (px: number, py: number) => {
    const rect = r.svg.current!.getBoundingClientRect();
    const vb = cadrageRef.current!.vb;
    // preserveAspectRatio « meet » : l'image est centrée dans le cadre.
    const s = Math.min(rect.width / vb.w, rect.height / vb.h);
    return { x: vb.x + (px - rect.left - (rect.width - vb.w * s) / 2) / s, y: vb.y + (py - rect.top - (rect.height - vb.h * s) / 2) / s, s };
  };
  const vueActuelle = () => cadrageRef.current?.vue ?? vue;
  const animerVers = (z: number, cx: number, cy: number) => {
    const de = vueActuelle();
    const t0 = performance.now();
    const D = calme ? 1 : 380;
    const pas = (t: number) => {
      const k = Math.min(1, (t - t0) / D);
      const e = 1 - Math.pow(1 - k, 4);
      majVue({ cx: de.cx + (cx - de.cx) * e, cy: de.cy + (cy - de.cy) * e, z: de.z + (z - de.z) * e });
      if (k < 1) requestAnimationFrame(pas);
    };
    requestAnimationFrame(pas);
  };
  const doigts = useRef(new Map<number, [number, number]>());
  const pince = useRef<number | null>(null);
  const dernierTap = useRef(0);
  const surPose = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    doigts.current.set(e.pointerId, [e.clientX, e.clientY]);
    pince.current = null;
  };
  const surBouge = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = doigts.current;
    const avant = d.get(e.pointerId);
    if (!avant) return;
    d.set(e.pointerId, [e.clientX, e.clientY]);
    if (d.size === 1) {
      const { s } = versPlan(0, 0);
      const v = vueActuelle();
      majVue({ ...v, cx: v.cx - (e.clientX - avant[0]) / s, cy: v.cy - (e.clientY - avant[1]) / s });
    } else if (d.size === 2) {
      const [a, b] = [...d.values()] as [[number, number], [number, number]];
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pince.current) {
        const m = versPlan((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        majVue(zoomerVue(vueActuelle(), dist / pince.current, m.x, m.y));
      }
      pince.current = dist;
    }
  };
  const surLeve = (e: React.PointerEvent<SVGSVGElement>) => {
    doigts.current.delete(e.pointerId);
    pince.current = null;
    if (e.type !== 'pointerup') return;
    const t = performance.now();
    if (t - dernierTap.current < 300) {
      const m = versPlan(e.clientX, e.clientY);
      animerVers(vueActuelle().z * 2, m.x, m.y);
    }
    dernierTap.current = t;
  };
  // Molette (ordinateur) : écouteur non passif pour empêcher le défilement.
  useEffect(() => {
    const svg = r.svg.current!;
    const roue = (e: WheelEvent) => {
      e.preventDefault();
      const m = versPlan(e.clientX, e.clientY);
      majVue(zoomerVue(vueActuelle(), Math.pow(1.0018, -e.deltaY), m.x, m.y));
    };
    svg.addEventListener('wheel', roue, { passive: false });
    return () => svg.removeEventListener('wheel', roue);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const zoom = (f: number) => {
    const v = vueActuelle();
    animerVers(v.z * f, v.cx, v.cy);
  };
  const vb = cadrage?.vb ?? { x: 0, y: 0, w: W, h: H };

  return (
    <div ref={r.racine} className="carte-pleine" role="dialog" aria-modal="true" aria-labelledby="titre-carte-pleine">
      <div className="plein-tete">
        <h2 id="titre-carte-pleine" className="sous-titre">
          Carte de l’île
        </h2>
        <button ref={r.fermer} className="retour" onClick={onFermer} aria-label="Fermer la carte">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 5l14 14M19 5 5 19" />
          </svg>
        </button>
      </div>
      <div ref={r.scene} className="plein-scene" onPointerDownCapture={(e) => joue && (e.stopPropagation(), arreter.current())}>
        <div
          ref={r.feuille}
          className={`feuille${anime ? ' anime' : ''}`}
          style={cadrage ? { width: cadrage.feuille.w, height: cadrage.feuille.h } : { visibility: 'hidden' }}
        >
          <div className="parchemin" style={{ clipPath: dechire.parchemin }}>
            <svg
              ref={r.svg}
              viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
              role="img"
              aria-label="Carte de l’île : zones, nombre de balises actives par zone, ta position"
              onPointerDown={surPose}
              onPointerMove={surBouge}
              onPointerUp={surLeve}
              onPointerCancel={surLeve}
            >
              <DessinCarte plan={plan} evenements={evenements} p="pl" />
            </svg>
          </div>
          {/* Bords restés enroulés, épais, aux bouts un peu déchirés (demande de Sivraj, 2026-10-10). */}
          <div className="enroule gauche" style={{ '--dechire': dechire.gauche } as CSSProperties} aria-hidden="true" />
          <div className="enroule droite" style={{ '--dechire': dechire.droite } as CSSProperties} aria-hidden="true" />
          <svg className="rose" viewBox="-11 -30 22 46" aria-hidden="true">
            <path d="M0 -14 4 0 0 14 -4 0z" className="rose-plein" />
            <path d="M0 -14 4 0 -4 0z" className="rose-vide" />
            <text y="-17" textAnchor="middle">
              N
            </text>
          </svg>
        </div>
        {!calme && (
          <>
            <div className="rouleau" aria-hidden="true" />
            <div className="rouleau" aria-hidden="true" />
          </>
        )}
        <div className="zoom">
          <button onClick={() => zoom(1.6)} aria-label="Zoomer">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button onClick={() => zoom(1 / 1.6)} aria-label="Dézoomer">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>
        {joue && <span className="passer">Touche pour passer</span>}
      </div>
      <div className="plein-pied">
        <ul className="legende">
          {LEGENDE.map((l, i) => (
            <li key={l.titre}>
              <svg viewBox="0 0 22 16" aria-hidden="true">
                {i === 0 && (
                  <defs>
                    <pattern id="legt1" width="6" height="6" patternUnits="userSpaceOnUse">
                      <circle cx="3" cy="3" r=".8" fill="#1b150c" opacity=".55" />
                    </pattern>
                    <pattern id="legt2" width="4" height="4" patternUnits="userSpaceOnUse">
                      <circle cx="2" cy="2" r="1" fill="#1b150c" opacity=".6" />
                    </pattern>
                    <pattern id="legt3" width="3" height="3" patternUnits="userSpaceOnUse">
                      <circle cx="1.5" cy="1.5" r="1.2" fill="#1b150c" opacity=".78" />
                    </pattern>
                  </defs>
                )}
                {l.dessin}
              </svg>
              {l.titre}
            </li>
          ))}
        </ul>
        <p className="doux legende-note">Plus la trame est serrée, plus la zone a de balises actives. Leur place reste secrète.</p>
        {plan.moi ? (
          <button className="gi-btn-encre" onClick={() => animerVers(2.4, plan.moi!.x, plan.moi!.y)}>
            Me retrouver
          </button>
        ) : (
          <p className="legende-note">Ta position n’est pas sur la carte (GPS en attente ou hors des zones).</p>
        )}
      </div>
    </div>
  );
}
