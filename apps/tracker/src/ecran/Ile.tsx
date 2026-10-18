// L'île dessinée, même dessin que l'app joueur (île v3 validée le 2026-10-17 : mer et côte, territoires au lavis
// qui se touchent, frontières en pointillé). Amendement RG-6.5 (2026-10-15) : halos flous décalés par le serveur,
// territoire qui s'allume au scan, vraies positions seulement à la fin.
// RG-10.12 : les Hunters ne sont qu'une heatmap anonyme décalée de 2 min.
import { ICONES_ZONE } from '@gq/ui/ile';
import { useEffect, useMemo, useRef, useState } from 'react';
import { calme } from '../lib/son';
import type { Plan } from '../lib/plan';
import type { Point } from '../lib/types';

const HALO_M = 40;

function Defs({ p }: { p: string }) {
  return (
    <defs>
      <pattern id={`${p}maudite`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M0 0v8" stroke="#a8231f" strokeWidth="2.4" opacity=".6" />
      </pattern>
      <filter id={`${p}plume`} x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="4" />
        <feDisplacementMap in="SourceGraphic" scale="3" />
      </filter>
      {/* Grain d'aquarelle et dérive : les mêmes que l'app joueur. */}
      <filter id={`${p}lavis`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".045 .06" numOctaves="3" seed="9" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 1.25" result="a" />
        <feComposite in="SourceGraphic" in2="a" operator="in" />
      </filter>
      <filter id={`${p}derive`} x="-15%" y="-15%" width="130%" height="130%">
        <feTurbulence type="fractalNoise" baseFrequency=".013" numOctaves="2" seed="11" />
        <feDisplacementMap in="SourceGraphic" scale="28" xChannelSelector="R" yChannelSelector="G" />
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
  const ile = plan.ile;

  return (
    <svg ref={svg} viewBox={`0 0 ${plan.largeur} ${plan.hauteur.toFixed(1)}`} role="img" aria-label="Carte de l'île">
      <Defs p={p} />
      <rect className="mer-fond" x={-200} y={-200} width={plan.largeur + 400} height={plan.hauteur + 400} />
      {ile && (
        <>
          <clipPath id={`${p}ile`}>
            <path d={ile.littoral} />
          </clipPath>
          <g>
            {[30, 20, 11].map((w, i) => (
              <g key={w}>
                <path d={ile.littoral} className="cotes-ondes" strokeWidth={w} opacity={0.16 + i * 0.06} />
                <path d={ile.littoral} className="cotes-mer" strokeWidth={w - 1.6} />
              </g>
            ))}
          </g>
          {ile.vagues.map(([x, y], i) => (
            <path key={i} className="vague" d={`M${(x - 9).toFixed(1)} ${y.toFixed(1)}q4.5 -4 9 0t9 0`} />
          ))}
          {ile.ilots.map(([x, y, t], i) => (
            <ellipse key={i} className="ilot" cx={x} cy={y} rx={t} ry={t * 0.7} filter={`url(#${p}plume)`} />
          ))}
          <g className="cartouche" transform="translate(30 24)">
            <text>GREED ISLAND</text>
            <path d="M0 7h104" />
          </g>
          <path className="terre" d={ile.littoral} />
          <g clipPath={`url(#${p}ile)`}>
            <g filter={`url(#${p}derive)`}>
              {plan.zones.map((z, i) => {
                const t = ile.territoires[i]!;
                return (
                  <g key={z.id}>
                    <g opacity=".62" filter={`url(#${p}lavis)`}>
                      <path className="terr-lavis" d={t} fill={ile.lavis[i]} stroke={ile.lavis[i]} />
                    </g>
                    {maudites.includes(z.id) && <path d={t} fill={`url(#${p}maudite)`} />}
                    <path className="zone-flash" data-flash={z.id} d={t} />
                  </g>
                );
              })}
              <path className="frontiere-ombre" d={ile.frontieres} />
              <path className="frontiere" d={ile.frontieres} />
            </g>
          </g>
          <path className="cote" d={ile.littoral} filter={`url(#${p}plume)`} />
        </>
      )}
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
        const w = n >= 10 ? 34 : 28;
        const bas = Math.max(...z.points.map((q) => q[1]));
        return (
          <g key={z.id}>
            <g transform={`translate(${cx.toFixed(1)} ${(cy - 4).toFixed(1)})`}>
              <g transform="translate(0 -24)">
                <circle r="13" className="ville-rond" />
                <path d={ICONES_ZONE[z.type]} className="ville-trait" />
              </g>
              <text className="zone-nom" textAnchor="middle" y="4">
                {z.nom}
              </text>
              {balisesParZone && (
                <g className={`zone-compte${n ? '' : ' vide'}`} transform="translate(0 11)">
                  <rect x={-w / 2} width={w} height="17" rx="2" />
                  <path className="ond" d={`M${-w / 2 + 6} 11.5a3.5 3.5 0 0 1 7 0M${-w / 2 + 7.8} 11.5a1.7 1.7 0 0 1 3.4 0`} />
                  <text x={w / 2 - 5} textAnchor="end" y="13">
                    {n}
                  </text>
                </g>
              )}
            </g>
            {doubleGain.includes(z.id) && (
              <g className="ev-etiquette" transform={`translate(${(cx - 46).toFixed(1)} ${(bas - 8).toFixed(1)})`}>
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
