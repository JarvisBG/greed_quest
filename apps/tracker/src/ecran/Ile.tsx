// L'île dessinée (parchemin, contours à la plume), reprise du prototype. Amendement RG-6.5 (2026-10-15) : halos
// flous décalés par le serveur, zone qui s'allume au scan, vraies positions seulement à la fin.
// RG-10.12 : les Hunters ne sont qu'une heatmap anonyme décalée de 2 min.
import { useEffect, useMemo, useRef, useState } from 'react';
import { calme } from '../lib/son';
import type { Plan } from '../lib/plan';
import type { Point } from '../lib/types';

const HALO_M = 40;

function Defs({ p }: { p: string }) {
  return (
    <defs>
      <pattern id={`${p}hachure`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M0 0v7" stroke="#1b150c" strokeWidth="1" opacity=".22" />
      </pattern>
      <filter id={`${p}plume`} x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="4" />
        <feDisplacementMap in="SourceGraphic" scale="3.2" />
      </filter>
      <radialGradient id={`${p}halo`}>
        <stop offset="0" stopColor="#d9a11a" stopOpacity=".85" />
        <stop offset=".6" stopColor="#d9a11a" stopOpacity=".45" />
        <stop offset="1" stopColor="#d9a11a" stopOpacity="0" />
      </radialGradient>
      <filter id={`${p}flou`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="7" />
      </filter>
    </defs>
  );
}

function QrGlyphe() {
  return (
    <g>
      <rect x="-5" y="-5" width="10" height="10" fill="#fff" stroke="#1b150c" strokeWidth="1.4" />
      <rect x="-3.6" y="-3.6" width="3" height="3" fill="#1b150c" />
      <rect x=".6" y="-3.6" width="3" height="3" fill="#1b150c" />
      <rect x="-3.6" y=".6" width="3" height="3" fill="#1b150c" />
      <rect x="1.2" y="1.2" width="1.8" height="1.8" fill="#1b150c" />
    </g>
  );
}

export interface IleProps {
  plan: Plan;
  /** Préfixe des identifiants SVG (deux îles sur la page). */
  p: string;
  balisesParZone?: Record<string, number>;
  heatmap?: Point[];
  halos?: Point[];
  halosN?: number;
  revelees?: Point[];
  /** Zones sous Double gain (étiquette rouge) et zones maudites (trait rouge en tirets). */
  doubleGain?: string[];
  maudites?: string[];
  flash?: { zoneId: string; n: number } | null;
}

export function IleSvg({ plan, p, balisesParZone, heatmap = [], halos = [], halosN = 0, revelees, doubleGain = [], maudites = [], flash }: IleProps) {
  const svg = useRef<SVGSVGElement>(null);
  const r = Math.max(10, HALO_M * plan.parMetre);
  const trait = plan.largeur / 420;

  // Rotation des halos : ils s'éteignent, puis se rallument ailleurs.
  const groupe = useRef<SVGGElement>(null);
  const [pts, setPts] = useState(halos);
  const dernierN = useRef(halosN);
  useEffect(() => {
    const g = groupe.current;
    if (dernierN.current === halosN || !g || calme) {
      dernierN.current = halosN;
      setPts(halos);
      return;
    }
    dernierN.current = halosN;
    let fini = false;
    g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1400, fill: 'forwards' }).finished.then(() => {
      if (fini) return;
      setPts(halos);
      g.getAnimations().forEach((x) => x.cancel());
      g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1400 });
    }, () => undefined);
    return () => {
      fini = true;
    };
  }, [halosN, halos]);

  useEffect(() => {
    if (!flash || !svg.current) return;
    for (const el of svg.current.querySelectorAll(`[data-flash="${CSS.escape(flash.zoneId)}"]`)) {
      el.classList.remove('on');
      void (el as SVGElement).getBoundingClientRect();
      el.classList.add('on');
    }
  }, [flash]);

  useEffect(() => {
    if (!revelees || calme || !svg.current) return;
    svg.current.querySelectorAll<SVGGElement>('.vraie').forEach((g, i) => {
      const t = g.getAttribute('transform') ?? '';
      g.animate([{ opacity: 0, transform: `${t} scale(3)` }, { opacity: 1, transform: t }], { duration: 500, delay: 500 + i * 120, fill: 'both', easing: 'cubic-bezier(.2,1.4,.4,1)' });
    });
  }, [revelees]);

  const proj = useMemo(() => (q: Point) => plan.projeter(q), [plan]);

  return (
    <svg ref={svg} viewBox={`0 0 ${plan.largeur} ${plan.hauteur.toFixed(1)}`} role="img" aria-label="Carte de l'île">
      <Defs p={p} />
      <rect width={plan.largeur} height={plan.hauteur} fill={`url(#${p}hachure)`} opacity=".5" />
      {plan.zones.map((z) => {
        const pts = z.points.map((q) => q.join(',')).join(' ');
        return (
          <g key={z.id}>
            <polygon className="zone-flash" data-flash={z.id} points={pts} />
            <g className={`zone ${z.ville ? 'zone-ville' : 'zone-sauvage'}${maudites.includes(z.id) ? ' zone-maudite' : ''}`}>
              <polygon className="zone-forme" points={pts} filter={`url(#${p}plume)`} />
            </g>
          </g>
        );
      })}
      {heatmap.length > 0 && (
        <g filter={`url(#${p}flou)`} opacity=".9">
          {heatmap.map((h, i) => {
            const [x, y] = proj(h);
            return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={9 * trait} fill="#c0272d" />;
          })}
        </g>
      )}
      {!revelees && (
        <g className="halos" ref={groupe}>
          {pts.map((h, i) => {
            const [x, y] = proj(h);
            return (
              <g className="halo" key={i}>
                <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r={r} fill={`url(#${p}halo)`} />
                <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r={r * 0.8} fill="none" stroke="#8a6a12" strokeWidth={1.2 * trait} strokeDasharray="3 4" opacity=".8" />
              </g>
            );
          })}
        </g>
      )}
      {revelees && (
        <g>
          {revelees.map((b, i) => {
            const [x, y] = proj(b);
            return (
              <g className="vraie" key={i} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(1.7 * trait).toFixed(2)})`}>
                <QrGlyphe />
              </g>
            );
          })}
        </g>
      )}
      {plan.zones.map((z) => {
        const [cx, cy] = z.centre;
        const n = balisesParZone?.[z.id] ?? 0;
        const w = n >= 10 ? 28 : 22;
        return (
          <g key={z.id}>
            <g transform={`translate(${cx} ${cy - 6}) scale(${trait})`}>
              <text className="zone-nom" textAnchor="middle">
                {z.nom}
              </text>
              {balisesParZone && (
                <g transform="translate(0 7)">
                  <rect x={-w / 2} width={w} height="20" {...(n ? { fill: '#1b150c' } : { fill: '#f1e6c8', stroke: '#1b150c', strokeWidth: 1.6 })} />
                  <text textAnchor="middle" y="15" style={{ font: '800 15px var(--f-chiffre)', fill: n ? '#f1e6c8' : '#1b150c' }}>
                    {n}
                  </text>
                </g>
              )}
            </g>
            {doubleGain.includes(z.id) && (
              <g className="ev-etiquette" transform={`translate(${cx - 46 * trait} ${z.haut + 6 * trait}) scale(${trait})`}>
                <rect width="92" height="17" />
                <text x="6" y="12.5">
                  Double gain
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
