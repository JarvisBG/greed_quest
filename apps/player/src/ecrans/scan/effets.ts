// Effets du tirage (prototype validé le 2026-10-10 : docs/prototype/scanner-tirage.html).
// Canvas plein écran : fumée de l'apparition, lumière qui fuit des bords de la carte encore de dos,
// étincelles et onde à l'impact. Effet pur : ne lit que la position de la carte. Les rayons des hauts rangs sont un
// élément de la page animé par le navigateur (Tirage.tsx) : repeindre tout l'écran à chaque image était trop lent sur téléphone.

export interface Effets {
  /** Nuage de fumée (« pouf ») où la carte apparaît. */
  fumee(x: number, y: number, n: number): void;
  etincelles(x: number, y: number, n: number, couleur: string, force?: number): void;
  onde(x: number, y: number, couleur: string, ampleur?: number): void;
  /** Lumière qui fuit des bords de la carte : intensité 0 à 1, étincelles émises par seconde. */
  fuite(intensite: number, couleur: string, parSeconde?: number): void;
  vider(): void;
  arreter(): void;
}

interface Particule { fumee: boolean; x: number; y: number; vx: number; vy: number; r: number; couleur: string; vie: number; max: number }
interface Onde { x: number; y: number; couleur: string; vie: number; rmax: number }

const ONDE_S = 0.55;
/** Plafond de particules : un SS en émettait plus de 1 000 à la fois, trop pour un téléphone. */
const MAX_PARTICULES = 300;

export function creerEffets(cv: HTMLCanvasElement, carte: () => DOMRect): Effets {
  const ctx = cv.getContext('2d')!;
  let dpr = 1;
  const taille = () => {
    // Lueurs douces : 1,5 pixel par point suffit (un téléphone en a 3, quatre fois plus de pixels à remplir).
    dpr = Math.min(1.5, devicePixelRatio || 1);
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
  };
  taille();
  addEventListener('resize', taille);

  // Une lueur ronde par couleur (couleurs en #rrggbb), dessinée une fois.
  const lueurs = new Map<string, HTMLCanvasElement>();
  const lueur = (c: string) => {
    let l = lueurs.get(c);
    if (l) return l;
    l = document.createElement('canvas');
    l.width = l.height = 64;
    const g = l.getContext('2d')!;
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, c);
    rg.addColorStop(0.35, `${c}99`);
    rg.addColorStop(1, `${c}00`);
    g.fillStyle = rg;
    g.fillRect(0, 0, 64, 64);
    lueurs.set(c, l);
    return l;
  };

  let parts: Particule[] = [];
  let ondes: Onde[] = [];
  let fuite = 0;
  let fuiteCouleur = '#ffffff';
  let fuiteTaux = 0;
  let image = 0;
  let dernier = 0;

  const bordAuHasard = (b: DOMRect): [number, number, number, number] => {
    let t = Math.random() * 2 * (b.width + b.height);
    if (t < b.width) return [b.left + t, b.top, 0, -1];
    t -= b.width;
    if (t < b.height) return [b.right, b.top + t, 1, 0];
    t -= b.height;
    if (t < b.width) return [b.right - t, b.bottom, 0, 1];
    t -= b.width;
    return [b.left, b.bottom - t, -1, 0];
  };

  const boucle = (now: number) => {
    const dt = Math.max(0, Math.min(0.05, (now - dernier) / 1000));
    dernier = now;
    const b = carte();
    if (fuiteTaux) {
      const n = Math.min(Math.round(fuiteTaux * dt), MAX_PARTICULES - parts.length);
      for (let i = 0; i < n; i++) {
        const [x, y, nx, ny] = bordAuHasard(b);
        const v = 40 + Math.random() * 120;
        parts.push({ fumee: false, x, y, vx: nx * v, vy: ny * v - 30, r: 2 + Math.random() * 3, couleur: fuiteCouleur, vie: 0, max: 0.35 + Math.random() * 0.4 });
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    if (fuite > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // Halo en trois traits (sans flou d'ombre, trop lent sur téléphone).
      const a0 = fuite * (0.8 + Math.random() * 0.2);
      ctx.strokeStyle = fuiteCouleur;
      ctx.beginPath();
      ctx.roundRect(b.left - 2, b.top - 2, b.width + 4, b.height + 4, 14);
      for (const [l, a] of [[30, 0.12], [14, 0.3], [4, 1]] as const) {
        ctx.lineWidth = l;
        ctx.globalAlpha = a0 * a;
        ctx.stroke();
      }
      ctx.restore();
    }

    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]!;
      p.vie += dt;
      const a = 1 - p.vie / p.max;
      if (a <= 0) {
        parts.splice(i, 1);
        continue;
      }
      if (p.fumee) {
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.r += 60 * dt;
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = '#d9dce2';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        p.vx *= 0.94;
        p.vy = p.vy * 0.94 + 60 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const t = p.r * (0.4 + a * 0.8);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a;
        ctx.drawImage(lueur(p.couleur), p.x - t * 3, p.y - t * 3, t * 6, t * 6);
      }
    }

    for (let i = ondes.length - 1; i >= 0; i--) {
      const o = ondes[i]!;
      o.vie += dt;
      const k = o.vie / ONDE_S;
      if (k >= 1) {
        ondes.splice(i, 1);
        continue;
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = o.couleur;
      ctx.lineWidth = 10 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.rmax * (1 - Math.pow(1 - k, 3)), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const vivant = parts.length || ondes.length || fuiteTaux || fuite > 0.01;
    image = vivant ? requestAnimationFrame(boucle) : 0;
  };
  // Relancée à chaque émission : la boucle s'arrête d'elle-même quand il n'y a plus rien à dessiner.
  const lancer = () => {
    if (image) return;
    dernier = performance.now();
    image = requestAnimationFrame(boucle);
  };

  return {
    fumee(x, y, n) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 60 + Math.random() * 260;
        parts.push({ fumee: true, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 - 30, r: 14 + Math.random() * 26, couleur: '', vie: 0, max: 0.55 + Math.random() * 0.5 });
      }
      lancer();
    },
    etincelles(x, y, n, couleur, force = 1) {
      n = Math.min(n, MAX_PARTICULES - parts.length);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = (240 + Math.random() * 620) * force;
        parts.push({ fumee: false, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 2 + Math.random() * 4, couleur, vie: 0, max: 0.45 + Math.random() * 0.7 });
      }
      lancer();
    },
    onde(x, y, couleur, ampleur = 1.4) {
      ondes.push({ x, y, couleur, vie: 0, rmax: Math.max(innerWidth, innerHeight) * 0.55 * ampleur });
      lancer();
    },
    fuite(intensite, couleur, parSeconde = 0) {
      fuite = intensite;
      fuiteCouleur = couleur;
      fuiteTaux = parSeconde;
      lancer();
    },
    vider() {
      parts = [];
      ondes = [];
      fuite = 0;
      fuiteTaux = 0;
    },
    arreter() {
      cancelAnimationFrame(image);
      image = 0;
      removeEventListener('resize', taille);
    },
  };
}
