// Les plans qui tournent dans la case unique (~21 s chacun) : la course au Book, le duel de tête, l'île, le fait
// marquant, comment jouer. Un seul sujet en plein écran à la fois (prototype v2, validé le 2026-10-15).
import { Carte } from '@gq/ui';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { A } from '../lib/anim';
import { construirePlan } from '../lib/plan';
import { calme } from '../lib/son';
import { fait, ilYa, titreDuel, trier } from '../lib/textes';
import { heureJeuMaintenant, instantVue, type Vue } from '../lib/useEcran';
import type { LigneClassement } from '../lib/types';
import { IleSvg } from './Ile';
import { Raid } from './Raid';

export const DUREE_PLAN = 21_000;
type IdPlan = 'course' | 'duel' | 'ile' | 'fait' | 'jouer';

// ---------- La course au Book ----------
function Course({ lignes, n, monte }: { lignes: LigneClassement[]; n: number; monte: Vue['monte'] }) {
  const piste = useRef<HTMLDivElement>(null);
  const tops = useRef(new Map<string, number>());
  const top8 = trier(lignes).slice(0, 8);

  // À l'entrée du plan : les pions partent du départ et filent à leur place, le premier en dernier.
  useEffect(() => {
    if (calme || !piste.current) return;
    [...piste.current.querySelectorAll<HTMLElement>('.couloir')].reverse().forEach((el, i) =>
      el.animate([{ '--k': 0 } as Keyframe, { '--k': el.style.getPropertyValue('--k') } as Keyframe], { duration: 1500, delay: 200 + i * 110, easing: 'cubic-bezier(.2,.9,.25,1)', fill: 'backwards' }),
    );
  }, []);

  // FLIP : chaque couloir glisse de son ancienne place vers la nouvelle.
  useLayoutEffect(() => {
    const el = piste.current;
    if (!el) return;
    const k = el.getBoundingClientRect().height / el.offsetHeight || 1;
    for (const c of el.querySelectorAll<HTMLElement>('.couloir')) {
      const p = c.dataset.p!;
      const t = c.getBoundingClientRect().top;
      const avant = tops.current.get(p);
      if (avant !== undefined && !calme) {
        const dy = (avant - t) / k;
        if (Math.abs(dy) > 1) c.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 1000, easing: 'cubic-bezier(.16,1,.3,1)' });
      }
      tops.current.set(p, t);
    }
  });

  return (
    <>
      <div className="course-tete">
        <h2 className="titre-plan">La course au Book</h2>
        <p>
          Le premier à <b>{n} cartes</b> fait Clear
        </p>
      </div>
      <div className="reperes">
        <span />
        <span />
        <div className="voie-rep">
          <span>Départ</span>
          <b>Clear</b>
        </div>
      </div>
      <div className="piste" ref={piste}>
        {top8.map((l, i) => (
          <div key={l.pseudo} className={`couloir c${i + 1}${i < 3 ? ` m${i + 1}` : ''}`} data-p={l.pseudo} style={{ '--k': Math.min(1, l.cartes / Math.max(1, n)) } as React.CSSProperties}>
            <span className="cr">{i + 1}</span>
            <span className="cn">{l.pseudo}</span>
            <div className="voie">
              <i className="trace" />
              <span className="pion">
                <b>{l.cartes}</b>
              </span>
              {monte?.pseudo === l.pseudo && <Boum key={monte.n} />}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** « DÉPASSEMENT ! » au-dessus du pion qui vient de doubler. */
function Boum() {
  const el = useRef<HTMLSpanElement>(null);
  const [vu, setVu] = useState(true);
  useEffect(() => {
    const a = A(
      el.current,
      [
        { transform: 'rotate(-8deg) scale(2.2)', opacity: 0 },
        { transform: 'rotate(-8deg) scale(1)', opacity: 1, offset: 0.25 },
        { transform: 'rotate(-8deg) scale(1)', opacity: 1, offset: 0.8 },
        { transform: 'rotate(-8deg) translateY(-30px)', opacity: 0 },
      ],
      { duration: 2200, delay: 700, easing: 'ease-out' },
    );
    a?.finished.then(() => setVu(false), () => undefined);
  }, []);
  return vu ? (
    <span ref={el} className="boum" style={{ left: 'calc(var(--k) * (100% - 112px) - 120px)', top: -50 }}>
      DÉPASSEMENT !
    </span>
  ) : null;
}

// ---------- Le duel de tête ----------
function Duel({ lignes, n }: { lignes: LigneClassement[]; n: number }) {
  const p = useRef<HTMLDivElement>(null);
  const [a, b] = trier(lignes) as [LigneClassement, LigneClassement];
  const e = a.cartes - b.cartes;
  useEffect(() => {
    const r = p.current;
    if (!r || calme) return;
    A(r.querySelector('.titre-plan'), [{ transform: 'scale(1.4)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600, easing: 'cubic-bezier(.2,1.3,.4,1)' });
    A(r.querySelector('.duelliste:not(.second)'), [{ transform: 'translateX(-200px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 800, delay: 250 });
    A(r.querySelector('.duelliste.second'), [{ transform: 'translateX(200px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 800, delay: 350 });
    A(r.querySelector('.ecart'), [{ transform: 'rotate(-30deg) scale(2)', opacity: 0 }, { transform: 'rotate(-4deg)', opacity: 1 }], { duration: 500, delay: 900, easing: 'cubic-bezier(.2,1.5,.4,1)' });
  }, []);
  return (
    <div ref={p} style={{ display: 'contents' }}>
      <h2 className="titre-plan">{titreDuel(a, b)}</h2>
      <div className="duel">
        <div className="duelliste m1">
          <span className="med">1</span>
          <span className="nom">{a.pseudo}</span>
          <span className="n">
            {a.cartes}
            <small> / {n}</small>
          </span>
        </div>
        {e === 0 ? (
          <div className="ecart egal">
            <b>=</b>
            <span>même nombre de cartes</span>
          </div>
        ) : (
          <div className="ecart">
            <b>{e}</b>
            <span>carte{e > 1 ? 's' : ''} d'avance</span>
          </div>
        )}
        <div className="duelliste second m2">
          <span className="med">2</span>
          <span className="nom">{b.pseudo}</span>
          <span className="n">
            {b.cartes}
            <small> / {n}</small>
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------- L'île ----------
function PlanIle({ v }: { v: Vue }) {
  const plan = useMemo(() => construirePlan(v.partie.zones), [v.partie.zones]);
  const nom = v.scan ? v.partie.zones.find((z) => z.id === v.scan!.zoneId)?.nom : null;
  const [bulle, setBulle] = useState<string | null>(null);
  useEffect(() => {
    if (!nom) return;
    setBulle(nom);
    const t = setTimeout(() => setBulle(null), 3200);
    return () => clearTimeout(t);
  }, [v.scan, nom]);
  const total = Object.values(v.balisesParZone).reduce((a, b) => a + b, 0);
  return (
    <>
      <div className="ile-cote">
        <div>
          <div className="gros-n">{total}</div>
          <h3>QR à trouver dans l'île</h3>
        </div>
        <p>Chaque halo cache un QR. Il dit « par ici », jamais « ici ».</p>
        <div className="legende">
          <span>
            <svg viewBox="0 0 40 30" aria-hidden="true">
              <defs>
                <radialGradient id="lg-h">
                  <stop offset="0" stopColor="#d9a11a" stopOpacity=".8" />
                  <stop offset="1" stopColor="#d9a11a" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="20" cy="15" r="14" fill="url(#lg-h)" />
            </svg>
            Un QR par ici
          </span>
          <span>
            <svg viewBox="0 0 40 30" aria-hidden="true">
              <g opacity=".8">
                <circle cx="14" cy="15" r="6" fill="#c0272d" />
                <circle cx="25" cy="13" r="5" fill="#c0272d" />
                <circle cx="22" cy="21" r="4" fill="#c0272d" />
              </g>
            </svg>
            Des Hunters, il y a 2 min
          </span>
        </div>
      </div>
      <div className="ile-cadre" style={{ aspectRatio: `${plan.largeur} / ${plan.hauteur}` }}>
        <IleSvg
          plan={plan}
          p="i"
          balisesParZone={v.balisesParZone}
          heatmap={v.heatmap}
          halos={v.halos}
          halosN={v.halosN}
          doubleGain={v.evs.filter((e) => e.type === 'double_gain' && e.zoneId).map((e) => e.zoneId!)}
          maudites={v.evs.filter((e) => e.type === 'zone_maudite' && e.zoneId).map((e) => e.zoneId!)}
          flash={v.scan}
        />
        <div className={`scan-bulle${bulle ? ' on' : ''}`}>Un QR a été trouvé : {bulle}</div>
      </div>
    </>
  );
}

// ---------- Le fait marquant ----------
function Fait({ v, i }: { v: Vue; i: number }) {
  const r = useRef<HTMLDivElement>(null);
  const e = v.fil[i]!;
  const f = fait(e);
  const minutes = Math.max(0, Math.floor((heureJeuMaintenant(v) - e.heureJeu) / 60_000));
  const nb = Math.min(3, v.fil.length);
  useEffect(() => {
    const p = r.current;
    if (!p || calme) return;
    A(p.querySelector('.porte'), [{ transform: 'translateY(200px) rotate(8deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 900 });
    A(p.querySelector('.mot'), [{ scale: 1.5, opacity: 0 }, { scale: 1, opacity: 1 }], { duration: 900 });
    A(p.querySelector('.bulle'), [{ transform: 'translateX(120px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 700, delay: 200 });
    A(p.querySelector('.bulle p'), [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 900, delay: 500, easing: 'steps(24)' });
  }, []);
  return (
    <div ref={r} style={{ display: 'contents' }}>
      <div className={`fait${f.carte ? '' : ' sans-carte'}${f.gm ? ' gm' : ''}`}>
        {!f.carte && (
          <span className="mot" aria-hidden="true">
            {f.mot ?? ''}
          </span>
        )}
        {f.carte && (
          <div className="porte">
            <Carte genre="designee" numero={f.carte.numero} nom={f.carte.nom} rang={f.carte.rang} limite={f.carte.limite} texte={f.carte.texte} />
          </div>
        )}
        <div className="bulle">
          <time>{ilYa(minutes)}</time>
          <p>{f.texte}</p>
          {f.rang && <span className={`rg r-${f.rang}`}>Rang {f.rang}</span>}
        </div>
      </div>
      <div className="points-fait">
        {Array.from({ length: nb }, (_, k) => (
          <i key={k} className={k === i ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
}

// ---------- Comment jouer (une étape à la fois, sans QR) ----------
const DESSINS = [
  <svg key="1" viewBox="0 0 300 220" aria-hidden="true"><rect x="40" y="40" width="96" height="96" fill="#fff" stroke="#111" strokeWidth="5" /><g fill="#111"><rect x="52" y="52" width="26" height="26" /><rect x="98" y="52" width="26" height="26" /><rect x="52" y="98" width="26" height="26" /><rect x="92" y="92" width="10" height="10" /><rect x="108" y="108" width="14" height="14" /></g><rect x="170" y="30" width="86" height="160" rx="12" fill="#fbfbf7" stroke="#111" strokeWidth="5" /><rect x="182" y="52" width="62" height="96" fill="#ecece6" stroke="#111" strokeWidth="3" /><path d="M190 60h14M190 60v14M236 60h-14M236 60v14M190 140h14M190 140v-14M236 140h-14M236 140v-14" stroke="#c0272d" strokeWidth="4" /><path d="M150 88h14M138 70l14 18-14 18" stroke="#111" strokeWidth="5" fill="none" /><path d="M20 200 Q90 180 150 200" stroke="#111" strokeWidth="3" fill="none" strokeDasharray="4 7" /></svg>,
  <svg key="2" viewBox="0 0 300 220" aria-hidden="true"><path d="M150 50 Q100 30 40 40 V190 Q100 180 150 200 Q200 180 260 190 V40 Q200 30 150 50 Z" fill="#5a1a1e" stroke="#111" strokeWidth="5" strokeLinejoin="round" /><path d="M150 56 Q104 40 54 48 V180 Q104 172 150 188 Z" fill="#fbfbf7" stroke="#111" strokeWidth="3" /><path d="M150 56 Q196 40 246 48 V180 Q196 172 150 188 Z" fill="#fbfbf7" stroke="#111" strokeWidth="3" /><g stroke="#111" strokeWidth="3"><rect x="66" y="66" width="30" height="40" fill="#c0272d" /><rect x="104" y="66" width="30" height="40" fill="#c0272d" /><rect x="66" y="116" width="30" height="40" fill="none" strokeDasharray="4 4" /><rect x="104" y="116" width="30" height="40" fill="#c0272d" /><rect x="166" y="66" width="30" height="40" fill="#c0272d" /><rect x="204" y="66" width="30" height="40" fill="none" strokeDasharray="4 4" /><rect x="166" y="116" width="30" height="40" fill="none" strokeDasharray="4 4" /><rect x="204" y="116" width="30" height="40" fill="#c0272d" /></g></svg>,
  <svg key="3" viewBox="0 0 300 220" aria-hidden="true"><g stroke="#111" strokeWidth="5" fill="#fbfbf7" strokeLinejoin="round"><circle cx="70" cy="70" r="26" /><path d="M30 190 Q36 110 70 106 Q104 110 110 190 Z" /><circle cx="230" cy="70" r="26" /><path d="M190 190 Q196 110 230 106 Q264 110 270 190 Z" /></g><rect x="118" y="80" width="44" height="60" rx="5" fill="#1f4a9c" stroke="#111" strokeWidth="4" transform="rotate(-12 140 110)" /><path d="M114 60 L186 60 M176 50 L190 60 L176 70" stroke="#111" strokeWidth="5" fill="none" strokeLinecap="square" /><g stroke="#111" strokeWidth="3"><path d="M150 150 l-10 24 M164 150 l4 26 M136 146 l-22 16" /></g></svg>,
];
const ETAPES: [string, string][] = [
  ['Trouve un QR et scanne-le', "Ils sont cachés partout dans l'île. Chaque scan tire une carte."],
  ['Remplis ton Book', 'Le premier Hunter qui réunit toutes les cartes désignées gagne.'],
  ['Défie les autres Hunters', 'Sorts sur les joueurs proches, échanges, enchères, arène.'],
];
function Jouer({ i }: { i: number }) {
  const [h, p] = ETAPES[i]!;
  const anime = calme ? '' : ' etape-entre';
  return (
    <>
      <div className={`dessin${anime}`}>{DESSINS[i]}</div>
      <div className={anime.trim()} style={{ animationDelay: '.12s' }}>
        <h3>{h}</h3>
        <p>{p}</p>
        <div className="points-jouer">
          {[0, 1, 2].map((k) => (
            <i key={k} className={k === i ? 'on' : ''} />
          ))}
        </div>
      </div>
    </>
  );
}

// ---------- La case et sa rotation ----------
/** Plans montrés selon ce qu'il y a à montrer (pas de duel à un joueur, pas de fait sans fil). */
export function plansDisponibles(v: Vue): IdPlan[] {
  const l: IdPlan[] = ['course'];
  if (v.classement.length >= 2) l.push('duel');
  if (v.partie.zones.length) l.push('ile');
  if (v.fil.length) l.push('fait');
  l.push('jouer');
  return l;
}

export function Plateau({ v, arrete }: { v: Vue; arrete: boolean }) {
  const plans = plansDisponibles(v);
  const [iPlan, setIPlan] = useState(0);
  const [tiers, setTiers] = useState(0);
  const [tour, setTour] = useState(0);
  const avance = useRef<HTMLDivElement>(null);
  const debut = useRef(performance.now());
  const arretA = useRef<number | null>(null);
  const id = plans[iPlan % plans.length]!;

  // Le fait marquant : un fait nouveau relance le plan sur lui.
  const premier = v.fil[0];
  useEffect(() => {
    if (id === 'fait') {
      debut.current = performance.now();
      setTiers(0);
      setTour((t) => t + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [premier]);

  useEffect(() => {
    let raf = 0;
    const tic = () => {
      const t = performance.now();
      if (arrete) {
        arretA.current ??= t;
      } else {
        // Une cinématique ou une pause ne mangent pas le temps du plan.
        if (arretA.current !== null) debut.current += t - arretA.current;
        arretA.current = null;
        const k = (t - debut.current) / DUREE_PLAN;
        if (k >= 1) {
          debut.current = t;
          setIPlan((x) => (x + 1) % plans.length);
          setTiers(0);
          setTour((x) => x + 1);
        } else setTiers(Math.min(2, Math.floor(k * 3)));
        if (avance.current) avance.current.style.width = `${Math.min(1, k) * 100}%`;
      }
      raf = requestAnimationFrame(tic);
    };
    raf = requestAnimationFrame(tic);
    return () => cancelAnimationFrame(raf);
  }, [arrete, plans.length]);

  const enRaid = !!v.raid?.montre;
  const plan = (() => {
    switch (id) {
      case 'course':
        return <Course lignes={v.classement} n={v.nCartes} monte={v.monte} />;
      case 'duel':
        return <Duel lignes={v.classement} n={v.nCartes} />;
      case 'ile':
        return <PlanIle v={v} />;
      case 'fait': {
        const i = Math.min(tiers, Math.min(3, v.fil.length) - 1);
        return <Fait key={`f${tour}-${i}`} v={v} i={i} />;
      }
      case 'jouer':
        return <Jouer key={`j${tour}-${tiers}`} i={tiers} />;
    }
  })();

  return (
    <section className={`plateau heros${enRaid ? ' en-raid' : ''}`} aria-label="Plan en cours">
      <div key={`${id}-${tour}`} className={`plan p-${id} vu${calme ? '' : ' entre'}`} data-plan={id}>
        {plan}
      </div>
      {v.raid && <Raid r={v.raid} maintenant={instantVue(v)} />}
      <div className="avance" ref={avance} />
    </section>
  );
}
