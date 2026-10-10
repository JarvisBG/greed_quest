// RG-5.4 : scène de la divination par l'eau, dessinée au canvas (prototype validé : docs/prototype/nen-divination.html).
// Un verre sur une table, une feuille ; au Ren, l'aura du type jaillit et l'eau réagit selon le type.
// Tout est calculé à chaque image dans un repère fixe de 360 × 640 (9:16), mis à l'échelle de l'écran.
import type { NenType } from '@gq/shared';

type Rvb = [number, number, number];

/** Repères de la séquence, en secondes après le Ren. */
export const TEMPS = { effet: 0.65, dureeEffet: 2.6, carton: 3.45, wing: 4.1, hexagone: 6.6, fin: 8.0 };

const W = 360;
const H = 640;
const CX = 180;
const BORD = 268;
const FOND = 452;
const R_HAUT = 66;
const R_BAS = 50;
const EP = 4.5;
const FOND_INT = FOND - 14;
const NIVEAU = 318;
const TABLE = 448;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sortie = (t: number) => 1 - Math.pow(1 - clamp(t), 4);
const doux = (t: number) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};
const hexVersRvb = (h: string): Rvb => {
  const n = parseInt(h.trim().slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgba = (c: Rvb, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (a: Rvb, b: Rvb, t: number): Rvb => [Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))];
const rayon = (y: number) => lerp(R_HAUT, R_BAS, (y - BORD) / (FOND - BORD));
const rayonInt = (y: number) => rayon(y) - EP;

/** Tirage pseudo-aléatoire reproductible : décor identique d'une fois sur l'autre (rien à voir avec le jeu). */
function hasard(graine: number) {
  let s = graine;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

interface Particule {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vie: number;
  max: number;
  t: number;
}

export interface Scene {
  /** Le joueur fait son Ren : la séquence démarre. */
  lancer(): void;
  arreter(): void;
}

export function creerScene(cv: HTMLCanvasElement, type: NenType, couleurType: string, calme: boolean): Scene {
  const ctx = cv.getContext('2d')!;
  const ORDRE: NenType[] = ['renforcement', 'transformation', 'materialisation', 'specialisation', 'manipulation', 'emission'];
  const alea = hasard(1234 + ORDRE.indexOf(type) * 97);
  const ct = hexVersRvb(couleurType);

  // Lueur de l'aura, pré-rendue une fois.
  const lueur = document.createElement('canvas');
  lueur.width = lueur.height = 64;
  {
    const g = lueur.getContext('2d')!;
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, rgba(ct, 0.9));
    rg.addColorStop(0.35, rgba(ct, 0.45));
    rg.addColorStop(1, rgba(ct, 0));
    g.fillStyle = rg;
    g.fillRect(0, 0, 64, 64);
  }

  const veines = Array.from({ length: 26 }, () => ({ y: TABLE + 8 + alea() * 190, a: 0.04 + alea() * 0.08, o: alea() * 6, f: 0.01 + alea() * 0.02 }));
  const lignes = Array.from({ length: 110 }, () => ({ a: alea() * Math.PI * 2, w: 0.004 + alea() * 0.014, r: 120 + alea() * 90 }));
  const cristaux = Array.from({ length: 11 }, (_, i) => ({
    x: CX + (alea() - 0.5) * 70,
    y: lerp(NIVEAU + 30, FOND_INT - 14, alea()),
    r: 5 + alea() * 9,
    rot: alea() * Math.PI,
    t0: 0.05 + i * 0.07,
    chute: 10 + alea() * 30,
  }));
  const bulles = Array.from({ length: 34 }, () => ({ x: CX + (alea() - 0.5) * 80, t0: alea() * 0.85, v: 0.5 + alea() * 0.6, r: 1.4 + alea() * 2.8, w: alea() * 6 }));
  const paillettes = Array.from({ length: 26 }, () => ({ x: CX + (alea() - 0.5) * 90, y: lerp(NIVEAU + 6, FOND_INT - 6, alea()), t0: alea(), p: 0.6 + alea() * 0.8 }));
  const aura: Particule[] = [];

  let t0: number | null = null;
  let dernier = performance.now();
  let image = 0;

  function emettre(dt: number, force: number) {
    const n = Math.floor(force * dt * 85 + alea());
    for (let i = 0; i < n; i++) {
      const cote = alea() < 0.5 ? -1 : 1;
      const y = lerp(BORD - 10, TABLE, alea());
      aura.push({ x: CX + cote * (rayon(clamp(y, BORD, FOND)) + 6 + alea() * 26), y, vx: cote * (4 + alea() * 14), vy: -(40 + alea() * 70), vie: 0, max: 1 + alea() * 1.1, t: 8 + alea() * 15 });
    }
  }

  function etoile(x: number, y: number, r: number, c: string) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.22, y - r * 0.22);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x + r * 0.22, y + r * 0.22);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r * 0.22, y + r * 0.22);
    ctx.lineTo(x - r, y);
    ctx.lineTo(x - r * 0.22, y - r * 0.22);
    ctx.closePath();
    ctx.fill();
  }

  function cristal(x: number, y: number, r: number, rot: number, p: number, now: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.5, rgba(mix(ct, [255, 255, 255], 0.35), 0.9));
    g.addColorStop(1, rgba(mix(ct, [0, 40, 60], 0.4), 0.95));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.35);
    ctx.lineTo(r * 0.72, -r * 0.3);
    ctx.lineTo(r * 0.5, r);
    ctx.lineTo(-r * 0.5, r);
    ctx.lineTo(-r * 0.72, -r * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.35);
    ctx.lineTo(0, r);
    ctx.moveTo(-r * 0.72, -r * 0.3);
    ctx.lineTo(r * 0.72, -r * 0.3);
    ctx.stroke();
    ctx.restore();
    if (p > 0.6) etoile(x + r * 0.5, y - r, 2 + r * 0.35 * Math.abs(Math.sin(now / 300 + x)), 'rgba(255,255,255,0.9)');
  }

  function surface(niveau: number, eauHaut: Rvb, e: number) {
    const rx = rayonInt(niveau);
    const ry = 7;
    const g = ctx.createLinearGradient(0, niveau - ry, 0, niveau + ry);
    g.addColorStop(0, rgba(mix(eauHaut, [255, 255, 255], 0.55), 0.95));
    g.addColorStop(1, rgba(eauHaut, 0.75));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(CX, niveau, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Ronds sur l'eau : la feuille qui tourne (Manipulation), le frémissement (Transformation).
    const ronds = type === 'manipulation' ? 4 : type === 'transformation' ? 3 : 0;
    for (let i = 0; i < ronds; i++) {
      const p = (e * (type === 'manipulation' ? 3 : 4) - i / ronds) % 1;
      if (e * 3 < i / ronds || e <= 0 || e >= 1) continue;
      const r = 8 + p * (rx - 6);
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - p)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(CX, niveau, r, r * 0.11, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function feuille(niveau: number, e: number, now: number) {
    let ang = -0.5;
    let x = CX + 4;
    let ech = 1;
    let flet = 0;
    const bob = Math.sin((now / 1000) * 1.6) * 0.8;
    if (type === 'manipulation') {
      const p = doux(e);
      ang += p * Math.PI * 4.5;
      x += Math.sin(p * Math.PI * 3) * 9;
    }
    if (type === 'specialisation') {
      flet = doux(e / 0.7);
      ech = lerp(1, 0.72, flet);
      ang += flet * 0.6;
    }
    const y = Math.max(niveau, BORD - 14) - 1 + bob;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.42);
    ctx.rotate(ang);
    ctx.scale(ech, ech * lerp(1, 0.55, flet));
    ctx.fillStyle = 'rgba(10,40,60,0.25)';
    ctx.beginPath();
    ctx.ellipse(3, 6, 27, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    const vert1 = mix([126, 206, 104], [150, 100, 40], flet);
    const vert2 = mix([38, 120, 52], [70, 40, 18], flet);
    const g = ctx.createLinearGradient(-26, -10, 26, 10);
    g.addColorStop(0, rgba(vert1, 1));
    g.addColorStop(1, rgba(vert2, 1));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-28, 0);
    ctx.bezierCurveTo(-12, -17 + flet * 6, 14, -15 + flet * 5, 30, 0);
    ctx.bezierCurveTo(14, 15 - flet * 5, -12, 17 - flet * 6, -28, 0);
    ctx.fill();
    ctx.strokeStyle = rgba(mix([20, 70, 30], [40, 22, 8], flet), 0.9);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-34, 1);
    ctx.lineTo(28, 0);
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      if (!i) continue;
      ctx.beginPath();
      ctx.moveTo(i * 8, 0);
      ctx.lineTo(i * 8 + 8, -8);
      ctx.moveTo(i * 8, 0);
      ctx.lineTo(i * 8 + 8, 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  function dessiner(now: number) {
    const dt = Math.min(0.05, (now - dernier) / 1000);
    dernier = now;
    const s = t0 === null ? -1 : (now - t0) / 1000;
    const ren = s >= 0;
    const e = ren ? clamp((s - TEMPS.effet) / TEMPS.dureeEffet) : 0;
    const force = ren ? clamp(s / 0.4) * (1 - 0.45 * clamp((s - 4) / 2)) : 0;
    let g: CanvasGradient;

    ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    ctx.save();
    // Secousse du Ren, caméra rapprochée du verre qui avance lentement.
    const choc = ren ? Math.max(0, 1 - s / 0.45) : 0;
    const zoom = ren ? lerp(1.22, 1.3, sortie(s / 3)) : 1.22;
    ctx.translate(W / 2 + (alea() - 0.5) * 9 * choc, 360 + (alea() - 0.5) * 9 * choc);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -372);

    // Pièce sombre, lampe en haut à gauche.
    g = ctx.createRadialGradient(110, 120, 10, 160, 260, 520);
    g.addColorStop(0, '#4a3524');
    g.addColorStop(0.45, '#1f1610');
    g.addColorStop(1, '#0a0705');
    ctx.fillStyle = g;
    ctx.fillRect(-40, -40, W + 80, H + 80);
    if (force > 0) {
      g = ctx.createRadialGradient(CX, 340, 10, CX, 340, 260);
      g.addColorStop(0, rgba(ct, 0.42 * force));
      g.addColorStop(1, rgba(ct, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-40, -40, W + 80, H + 80);
    }

    // Table en bois.
    g = ctx.createLinearGradient(0, TABLE, 0, H);
    g.addColorStop(0, '#6b4429');
    g.addColorStop(0.25, '#4a2f1c');
    g.addColorStop(1, '#1a100a');
    ctx.fillStyle = g;
    ctx.fillRect(-40, TABLE, W + 80, H - TABLE + 40);
    ctx.strokeStyle = 'rgba(255,220,170,0.28)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-40, TABLE + 0.5);
    ctx.lineTo(W + 40, TABLE + 0.5);
    ctx.stroke();
    for (const v of veines) {
      ctx.strokeStyle = `rgba(20,10,4,${v.a})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let x = -40; x <= W + 40; x += 12) ctx.lineTo(x, v.y + Math.sin(x * v.f + v.o) * 3);
      ctx.stroke();
    }
    if (force > 0) {
      g = ctx.createRadialGradient(CX, TABLE + 20, 4, CX, TABLE + 20, 170);
      g.addColorStop(0, rgba(ct, 0.3 * force));
      g.addColorStop(1, rgba(ct, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-40, TABLE, W + 80, 200);
    }

    // Couleur de l'eau (l'Émission la change).
    const tEau = type === 'emission' ? doux(e * 1.15) : 0;
    const eauHaut = mix([168, 214, 240], mix(ct, [255, 255, 255], 0.25), tEau);
    const eauBas = mix([52, 120, 178], mix(ct, [60, 10, 0], 0.35), tEau);

    // Niveau de l'eau (le Renforcement la fait monter puis déborder).
    let niveau = NIVEAU;
    let debord = 0;
    if (type === 'renforcement') {
      niveau = lerp(NIVEAU, BORD - 12, sortie(e / 0.55));
      debord = clamp((e - 0.38) / 0.62);
    }

    // Ombre et caustique sous le verre.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(CX + 26, FOND + 2, 74, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    g = ctx.createRadialGradient(CX + 34, FOND + 6, 2, CX + 34, FOND + 6, 60);
    g.addColorStop(0, rgba(eauHaut, 0.55));
    g.addColorStop(1, rgba(eauHaut, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(CX + 34, FOND + 6, 60, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Flaque (Renforcement).
    if (debord > 0.25) {
      const rf = 30 + 120 * sortie((debord - 0.25) / 0.75);
      g = ctx.createRadialGradient(CX, FOND + 4, 4, CX, FOND + 4, rf);
      g.addColorStop(0, rgba(eauHaut, 0.5));
      g.addColorStop(0.85, rgba(eauHaut, 0.32));
      g.addColorStop(1, rgba(eauHaut, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(CX, FOND + 4, rf, rf * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(CX, FOND + 4, rf * 0.92, rf * 0.11, 0, Math.PI * 1.05, Math.PI * 1.6);
      ctx.stroke();
    }

    // Paroi arrière du verre.
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(CX, BORD, R_HAUT, 9, 0, Math.PI, Math.PI * 2);
    ctx.stroke();

    // Eau, découpée dans l'intérieur du verre.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(CX - rayonInt(BORD), BORD);
    ctx.lineTo(CX - rayonInt(FOND_INT), FOND_INT - 6);
    ctx.quadraticCurveTo(CX - rayonInt(FOND_INT), FOND_INT + 2, CX - rayonInt(FOND_INT) + 10, FOND_INT + 3);
    ctx.lineTo(CX + rayonInt(FOND_INT) - 10, FOND_INT + 3);
    ctx.quadraticCurveTo(CX + rayonInt(FOND_INT), FOND_INT + 2, CX + rayonInt(FOND_INT), FOND_INT - 6);
    ctx.lineTo(CX + rayonInt(BORD), BORD);
    ctx.closePath();
    ctx.clip();
    const nv = Math.max(niveau, BORD);
    g = ctx.createLinearGradient(0, nv, 0, FOND_INT);
    g.addColorStop(0, rgba(eauHaut, 0.62));
    g.addColorStop(1, rgba(eauBas, 0.86));
    ctx.fillStyle = g;
    ctx.fillRect(CX - 80, nv, 160, FOND_INT - nv + 10);
    if (type === 'emission' && e > 0) {
      // Nuage de couleur qui se diffuse.
      for (let i = 0; i < 5; i++) {
        const p = sortie(e * 1.3 - i * 0.08);
        if (p <= 0) continue;
        const r = 8 + p * 90;
        const y = nv + 18 + i * 22 * p;
        g = ctx.createRadialGradient(CX + Math.sin(i * 2.1) * 14 * p, y, 0, CX, y, r);
        g.addColorStop(0, rgba(ct, 0.55 * (1 - p * 0.5)));
        g.addColorStop(1, rgba(ct, 0));
        ctx.fillStyle = g;
        ctx.fillRect(CX - 90, nv - 10, 180, 220);
      }
    }
    if ((type === 'transformation' || type === 'specialisation') && e > 0) {
      // Paillettes : violettes (Transformation), dorées (Spécialisation).
      const c: Rvb = type === 'transformation' ? mix(ct, [255, 255, 255], 0.4) : [255, 236, 160];
      for (const p of paillettes) {
        const v = Math.sin((now / 1000) * 6 * p.p + p.t0 * 20) * 0.5 + 0.5;
        const a = clamp((e - p.t0 * 0.5) * 3) * v;
        if (a > 0.02) etoile(p.x, p.y, 2 + v * 3.5, rgba(c, a));
      }
    }
    if (type === 'transformation' && e > 0) {
      // Bulles qui montent.
      for (const b of bulles) {
        if (e * 2.2 * b.v < b.t0) continue;
        const p = (e * 2.2 * b.v - b.t0) % 1;
        const y = lerp(FOND_INT - 4, nv + 3, p);
        const x = b.x + Math.sin(p * 9 + b.w) * 3;
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, b.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(x - b.r * 0.35, y - b.r * 0.35, b.r * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (type === 'materialisation' && e > 0) {
      // Cristaux qui naissent puis descendent.
      for (const k of cristaux) {
        const p = sortie((e - k.t0) / 0.3);
        if (p <= 0) continue;
        cristal(k.x, k.y + k.chute * doux((e - k.t0) / (1 - k.t0)), k.r * p, k.rot + e * 0.6, p, now);
      }
    }
    if (niveau >= BORD - 0.5) surface(niveau, eauHaut, e);
    ctx.restore();

    // Bombé au-dessus du bord et coulures (Renforcement).
    if (type === 'renforcement' && niveau < BORD) {
      const h = BORD - niveau;
      g = ctx.createLinearGradient(0, BORD - h, 0, BORD);
      g.addColorStop(0, rgba(mix(eauHaut, [255, 255, 255], 0.3), 0.85));
      g.addColorStop(1, rgba(eauHaut, 0.7));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(CX, BORD, R_HAUT + 1.5, h + 8, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(CX, BORD, R_HAUT + 1.5, h + 8, 0, Math.PI * 1.15, Math.PI * 1.55);
      ctx.stroke();
      const coulures: [number, number, number][] = [
        [-1, 0, 11],
        [1, 0.12, 13],
        [-1, 0.3, 7],
        [1, 0.42, 8],
      ];
      for (const [cote, retard, larg] of coulures) {
        const p = sortie(clamp((debord - retard) / 0.5));
        if (p <= 0) continue;
        const bas = lerp(BORD, FOND + 2, p);
        const decal = retard > 0.2 ? cote * -10 : 0;
        ctx.fillStyle = rgba(mix(eauHaut, [255, 255, 255], 0.2), 0.88);
        ctx.beginPath();
        for (let y = BORD - 2; y <= bas; y += 4) ctx.lineTo(CX + cote * (rayon(y) + 1) + decal * 0.2, y);
        for (let y = bas; y >= BORD - 2; y -= 4) {
          const w = larg * (0.45 + 0.55 * Math.sin(((y - BORD) / (bas - BORD + 1)) * Math.PI * 0.9 + 0.3));
          ctx.lineTo(CX + cote * (rayon(y) + 1 + w) + decal * 0.2, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        if (p < 1) {
          ctx.beginPath();
          ctx.arc(CX + cote * (rayon(bas) + larg * 0.6), bas, larg * 0.75, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Gouttes qui tombent du bord en continu.
          const k = ((now / 1000) * 1.4 + retard * 3) % 1;
          ctx.beginPath();
          ctx.ellipse(CX + cote * (rayon(BORD) + larg * 0.9), lerp(BORD + 6, FOND, k * k), 2.6, 3.6, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(CX + cote * (rayon(BORD + 10) + larg * 0.7), BORD + 10);
        ctx.lineTo(CX + cote * (rayon(lerp(BORD, bas, 0.6)) + larg * 0.5), lerp(BORD, bas, 0.6));
        ctx.stroke();
      }
    }

    feuille(niveau, e, now);

    // Verre au premier plan : corps, fond épais, reflets, bord.
    g = ctx.createLinearGradient(CX - R_HAUT, 0, CX + R_HAUT, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.16)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.03)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.02)');
    g.addColorStop(1, 'rgba(255,255,255,0.12)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(CX - R_HAUT, BORD);
    ctx.lineTo(CX - R_BAS, FOND);
    ctx.lineTo(CX + R_BAS, FOND);
    ctx.lineTo(CX + R_HAUT, BORD);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CX - R_HAUT, BORD);
    ctx.lineTo(CX - R_BAS, FOND - 6);
    ctx.moveTo(CX + R_HAUT, BORD);
    ctx.lineTo(CX + R_BAS, FOND - 6);
    ctx.stroke();
    g = ctx.createLinearGradient(0, FOND_INT, 0, FOND);
    g.addColorStop(0, 'rgba(255,255,255,0.32)');
    g.addColorStop(1, 'rgba(255,255,255,0.1)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(CX, FOND - 3, R_BAS, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(CX, FOND - 3, R_BAS, 7, 0, 0, Math.PI);
    ctx.stroke();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(CX - R_HAUT + 15, BORD + 26);
    ctx.lineTo(CX - R_BAS + 12, FOND - 34);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(CX - R_HAUT + 27, BORD + 40);
    ctx.lineTo(CX - R_BAS + 23, BORD + 92);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(CX + R_HAUT - 11, BORD + 30);
    ctx.lineTo(CX + R_BAS - 9, FOND - 40);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(CX, BORD, R_HAUT, 9, 0, 0, Math.PI);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(CX, BORD, R_HAUT - EP, 7.5, 0, 0, Math.PI);
    ctx.stroke();

    // Aura : particules additives autour du verre.
    if (ren) emettre(dt, force);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = aura.length - 1; i >= 0; i--) {
      const p = aura[i]!;
      p.vie += dt;
      if (p.vie > p.max) {
        aura.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt + Math.sin(p.vie * 5 + p.t) * 0.4;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      const k = p.vie / p.max;
      const taille = p.t * (0.6 + k * 0.9);
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.5;
      ctx.drawImage(lueur, p.x - taille, p.y - taille, taille * 2, taille * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Lignes de vitesse du Ren.
    if (ren && s < 0.9) {
      const a = 1 - s / 0.9;
      ctx.fillStyle = `rgba(255,248,235,${0.55 * a})`;
      ctx.beginPath();
      for (const l of lignes) {
        const r0 = l.r - 30 * (1 - a);
        const pt = (ang: number, r: number) => [CX + Math.cos(ang) * r, 340 + Math.sin(ang) * r * 1.4] as const;
        const [x0, y0] = pt(l.a, r0);
        const [x1, y1] = pt(l.a - l.w, 480);
        const [x2, y2] = pt(l.a + l.w, 480);
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.closePath();
      }
      ctx.fill();
    }
    ctx.restore();

    // Flash du Ren et vignette.
    if (ren && s < 0.25) {
      ctx.fillStyle = `rgba(255,250,240,${0.7 * (1 - s / 0.25)})`;
      ctx.fillRect(0, 0, W, H);
    }
    g = ctx.createRadialGradient(W / 2, 330, 180, W / 2, 330, 470);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function boucle(now: number) {
    dessiner(now);
    image = requestAnimationFrame(boucle);
  }

  function taille() {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
  }
  const observateur = new ResizeObserver(taille);
  observateur.observe(cv);
  taille();
  image = requestAnimationFrame(boucle);

  return {
    lancer() {
      // Mouvement réduit : on saute directement à l'état final, aura comprise.
      t0 = calme ? performance.now() - TEMPS.fin * 1000 : performance.now();
      if (calme) for (let i = 0; i < 120; i++) emettre(1 / 60, 0.6);
    },
    arreter() {
      cancelAnimationFrame(image);
      observateur.disconnect();
    },
  };
}
