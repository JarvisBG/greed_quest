// Aura du Ten autour de la licence (prototype validé le 2026-10-10 : docs/prototype/licence-presentation.html).
// Canvas plein écran : flammes de la couleur du type de Nen qui montent du bord de la carte, voile qui vacille.
// Effet pur : ne lit que la position de la carte, ne décide rien.

export interface Aura {
  /** Jaillissement : `n` flammes projetées vers l'extérieur. */
  eclat(n: number): void;
  /** Flammes émises par seconde tant que la valeur est > 0. */
  emettre(parSeconde: number): void;
  /** Voile qui épouse la carte : 1 = plein, retombe à 0 en `ms`. */
  voile(ms?: number): void;
  arreter(): void;
}

interface Flamme { x: number; y: number; vx: number; vy: number; t: number; vie: number; max: number; ph: number }

export function creerAura(cv: HTMLCanvasElement, couleur: string, carte: () => DOMRect): Aura {
  const ctx = cv.getContext('2d')!;
  let dpr = 1;
  const taille = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
  };
  taille();
  addEventListener('resize', taille);

  // Lueur de la couleur de l'aura (couleur en #rrggbb).
  const lueur = document.createElement('canvas');
  lueur.width = lueur.height = 64;
  const g = lueur.getContext('2d')!;
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, couleur);
  rg.addColorStop(0.35, `${couleur}88`);
  rg.addColorStop(1, `${couleur}00`);
  g.fillStyle = rg;
  g.fillRect(0, 0, 64, 64);

  let flammes: Flamme[] = [];
  let taux = 0;
  let voile = 0;
  let voileDebut = 0;
  let voileDuree = 0;
  let image = 0;
  let dernier = 0;

  const pointDuBord = (b: DOMRect): [number, number, number, number] => {
    let t = Math.random() * 2 * (b.width + b.height);
    if (t < b.width) return [b.left + t, b.top, 0, -1];
    t -= b.width;
    if (t < b.height) return [b.right, b.top + t, 1, 0];
    t -= b.height;
    if (t < b.width) return [b.right - t, b.bottom, 0, 1];
    t -= b.width;
    return [b.left, b.bottom - t, -1, 0];
  };
  const jaillir = (n: number, force: boolean) => {
    const b = carte();
    for (let i = 0; i < n; i++) {
      const [x, y, nx, ny] = pointDuBord(b);
      const v = force ? 220 + Math.random() * 380 : 30 + Math.random() * 60;
      flammes.push({
        x,
        y,
        vx: nx * v + (Math.random() - 0.5) * 30,
        vy: ny * v - (force ? 0 : 90 + Math.random() * 120),
        t: force ? 3 + Math.random() * 6 : 4 + Math.random() * 7,
        vie: 0,
        max: force ? 0.5 + Math.random() * 0.6 : 0.55 + Math.random() * 0.6,
        ph: Math.random() * 6,
      });
    }
  };

  const boucle = (now: number) => {
    const dt = Math.min(0.05, (now - dernier) / 1000);
    dernier = now;
    if (taux) jaillir(Math.round(taux * dt), false);
    if (voileDuree) voile = Math.max(0, 1 - (now - voileDebut) / voileDuree);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalCompositeOperation = 'lighter';
    if (voile > 0) {
      const b = carte();
      ctx.save();
      ctx.globalAlpha = voile * (0.85 + Math.sin(now / 55) * 0.08 + Math.random() * 0.07);
      ctx.shadowColor = couleur;
      ctx.shadowBlur = 34;
      ctx.strokeStyle = couleur;
      ctx.lineWidth = 5;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(b.left - 3, b.top - 3, b.width + 6, b.height + 6, 18);
      else ctx.rect(b.left - 3, b.top - 3, b.width + 6, b.height + 6);
      ctx.stroke();
      ctx.stroke();
      ctx.restore();
    }
    for (let i = flammes.length - 1; i >= 0; i--) {
      const p = flammes[i]!;
      p.vie += dt;
      const a = 1 - p.vie / p.max;
      if (a <= 0) {
        flammes.splice(i, 1);
        continue;
      }
      p.vx *= 0.93;
      p.vy = p.vy * 0.96 - 40 * dt;
      p.x += (p.vx + Math.sin(p.vie * 9 + p.ph) * 22) * dt;
      p.y += p.vy * dt;
      const t = p.t * (0.5 + a * 0.6);
      ctx.globalAlpha = a * 0.8;
      ctx.drawImage(lueur, p.x - t * 1.6, p.y - t * 4, t * 3.2, t * 7);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    image = flammes.length || taux || voile > 0 ? requestAnimationFrame(boucle) : 0;
  };
  const lancer = () => {
    if (image) return;
    dernier = performance.now();
    image = requestAnimationFrame(boucle);
  };

  return {
    eclat(n) {
      jaillir(n, true);
      lancer();
    },
    emettre(parSeconde) {
      taux = parSeconde;
      if (taux) lancer();
    },
    voile(ms = 0) {
      if (ms) {
        voileDebut = performance.now();
        voileDuree = ms;
      } else {
        voile = 1;
        voileDuree = 0;
      }
      lancer();
    },
    arreter() {
      cancelAnimationFrame(image);
      image = 0;
      flammes = [];
      taux = 0;
      voile = 0;
      voileDuree = 0;
      ctx.clearRect(0, 0, cv.width, cv.height);
      removeEventListener('resize', taille);
    },
  };
}
