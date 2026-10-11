// Lumière de l'invocation du Book (prototype docs/prototype/book-invocation.html) : une spirale d'or aspirée
// vers le Book, puis un éclat quand il prend sa matière. Leçons du scanner : canvas à 1,5 pixel par point au plus,
// particules plafonnées, halo pré-dessiné (pas de shadowBlur).

interface Spirale { type: 's'; a: number; r: number; v: number; t: number; cx: number; cy: number; vie: number }
interface Eclat { type: 'e'; x: number; y: number; vx: number; vy: number; t: number; vie: number; max: number }
type Particule = Spirale | Eclat;

const MAX = 300;

export interface Lumiere {
  spirale(n: number): void;
  eclat(n: number): void;
  arreter(): void;
}

export function creerLumiere(toile: HTMLCanvasElement): Lumiere {
  const ctx = toile.getContext('2d');
  const dpr = Math.min(1.5, devicePixelRatio || 1);
  const L = innerWidth;
  const H = innerHeight;
  toile.width = Math.round(L * dpr);
  toile.height = Math.round(H * dpr);
  const lueur = document.createElement('canvas');
  lueur.width = lueur.height = 48;
  const g = lueur.getContext('2d');
  if (g) {
    const r = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    r.addColorStop(0, 'rgba(255,240,200,1)');
    r.addColorStop(0.3, 'rgba(255,200,90,.7)');
    r.addColorStop(1, 'rgba(255,160,40,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 48, 48);
  }
  let parts: Particule[] = [];
  let image = 0;
  let dernier = 0;
  const cx = L / 2;
  const cy = H * 0.48;

  const boucle = (now: number) => {
    const dt = Math.min(0.05, Math.max(0, (now - dernier) / 1000));
    dernier = now;
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, L, H);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]!;
      p.vie += dt;
      let x: number;
      let y: number;
      let a: number;
      if (p.type === 's') {
        p.r *= Math.pow(0.18, dt * p.v);
        p.a += dt * (2.2 + 140 / (p.r + 20));
        x = p.cx + Math.cos(p.a) * p.r;
        y = p.cy + Math.sin(p.a) * p.r * 0.9;
        a = Math.min(1, p.vie * 3) * Math.min(1, p.r / 30);
        if (p.r < 4) {
          parts.splice(i, 1);
          continue;
        }
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.94;
        p.vy = p.vy * 0.94 + 30 * dt;
        x = p.x;
        y = p.y;
        a = 1 - p.vie / p.max;
        if (a <= 0) {
          parts.splice(i, 1);
          continue;
        }
      }
      ctx.globalAlpha = a;
      ctx.drawImage(lueur, x - p.t * 2, y - p.t * 2, p.t * 4, p.t * 4);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    image = parts.length ? requestAnimationFrame(boucle) : 0;
  };
  const lancer = () => {
    if (image) return;
    dernier = performance.now();
    image = requestAnimationFrame(boucle);
  };
  const place = (n: number) => Math.max(0, Math.min(n, MAX - parts.length));

  return {
    spirale(n) {
      const R = Math.max(L, H) * 0.6;
      for (let i = 0; i < place(n); i++) {
        parts.push({ type: 's', a: Math.random() * Math.PI * 2, r: R * (0.5 + Math.random() * 0.5), v: 0.9 + Math.random() * 0.8, t: 3 + Math.random() * 7, cx, cy, vie: 0 });
      }
      lancer();
    },
    eclat(n) {
      for (let i = 0; i < place(n); i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 120 + Math.random() * 420;
        parts.push({ type: 'e', x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 2 + Math.random() * 6, vie: 0, max: 0.6 + Math.random() * 0.8 });
      }
      lancer();
    },
    arreter() {
      parts = [];
      cancelAnimationFrame(image);
      image = 0;
      ctx?.clearRect(0, 0, toile.width, toile.height);
    },
  };
}
