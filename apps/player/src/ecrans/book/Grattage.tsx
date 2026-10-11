// Loterie (objet) : le serveur a déjà tiré le gain ; le joueur gratte la pellicule argentée au doigt pour le découvrir.
// Au-delà de la moitié grattée (ou « Tout gratter »), la pellicule tombe et le gain frappe.
import { useEffect, useRef, useState } from 'react';

export function Grattage({ gain, onDecouvert }: { gain: number; onDecouvert: () => void }) {
  const toile = useRef<HTMLCanvasElement>(null);
  const [decouvert, setDecouvert] = useState(false);
  const fait = useRef(false);
  const dernier = useRef<{ x: number; y: number } | null>(null);
  const traits = useRef(0);

  const decouvrir = () => {
    if (fait.current) return;
    fait.current = true;
    setDecouvert(true);
    navigator.vibrate?.(gain > 0 ? [30, 40, 60] : 20);
    onDecouvert();
  };

  useEffect(() => {
    const cv = toile.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
    ctx.scale(dpr, dpr);
    // Pellicule argentée, trame de points et consigne imprimée.
    const g = ctx.createLinearGradient(0, 0, r.width, r.height);
    g.addColorStop(0, '#9aa1a8');
    g.addColorStop(0.45, '#e6e9ec');
    g.addColorStop(0.55, '#c3c8cd');
    g.addColorStop(1, '#8d949b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, r.width, r.height);
    ctx.fillStyle = 'rgba(17,17,17,.14)';
    for (let y = 3; y < r.height; y += 6) for (let x = (y / 6) % 2 ? 3 : 0; x < r.width; x += 6) ctx.fillRect(x, y, 1.4, 1.4);
    ctx.fillStyle = '#2a2d31';
    ctx.font = '400 20px "Dela Gothic One", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GRATTE ICI', r.width / 2, r.height / 2);
  }, []);

  const gratter = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (fait.current || (e.pointerType === 'mouse' && e.buttons !== 1)) return;
    const cv = e.currentTarget;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 34;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const d = dernier.current ?? { x, y };
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(x + 0.1, y);
    ctx.stroke();
    dernier.current = { x, y };
    // Part grattée mesurée de temps en temps (lecture des pixels sur une grille grossière).
    if (++traits.current % 8) return;
    const { data } = ctx.getImageData(0, 0, cv.width, cv.height);
    let vides = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 4 * 37) {
      total++;
      if (data[i]! < 40) vides++;
    }
    if (vides / total > 0.5) decouvrir();
  };

  return (
    <div className="grattage">
      {/* Le gain est sous la pellicule pendant le grattage ; il n'est annoncé qu'une fois découvert. */}
      <div className={`grattage-gain${decouvert ? ' frappe' : ''}`} aria-hidden={!decouvert}>
        {gain > 0 ? (
          <span>
            +{gain}
            <small>J</small>
          </span>
        ) : (
          <span className="rien">Rien cette fois</span>
        )}
      </div>
      {!decouvert && (
        <canvas
          ref={toile}
          className="grattage-pellicule"
          onPointerDown={(e) => {
            dernier.current = null;
            e.currentTarget.setPointerCapture(e.pointerId);
            gratter(e);
          }}
          onPointerMove={gratter}
          onPointerUp={() => (dernier.current = null)}
          aria-hidden="true"
        />
      )}
      {!decouvert && (
        <button className="gi-lien" onClick={decouvrir}>
          Tout gratter
        </button>
      )}
    </div>
  );
}
