// Lignes de concentration du manga (集中線), pour les moments forts : invocation du Book, carte tirée.
import { useMemo, type CSSProperties } from 'react';

export function lignesConcentration(graine: number, n = 120): string {
  let s = Math.max(1, Math.floor(graine)) % 2147483647;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const r0 = 46 + r() * 22;
    const w = 0.004 + r() * 0.02;
    const p = (ang: number, rad: number) => `${(Math.cos(ang) * rad).toFixed(1)} ${(Math.sin(ang) * rad).toFixed(1)}`;
    d += `M${p(a, r0)}L${p(a - w, 160)}L${p(a + w, 160)}Z`;
  }
  return d;
}

export function Concentration({ graine = 7, className, style }: { graine?: number; className?: string; style?: CSSProperties }) {
  const d = useMemo(() => lignesConcentration(graine), [graine]);
  return (
    <div className={`gi-concentration${className ? ` ${className}` : ''}`} style={style} aria-hidden="true">
      <svg viewBox="-100 -100 200 200" preserveAspectRatio="xMidYMid slice">
        <path d={d} fill="#111" />
      </svg>
    </div>
  );
}
