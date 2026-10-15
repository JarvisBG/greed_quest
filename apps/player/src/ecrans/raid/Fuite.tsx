// Page ⑯ : temps écoulé, le boss s'enfuit en riant (≈ 3,8 s, toucher pour fermer). Il tourne les talons et file en
// sautillant (l'affiche s'envole en tournoyant), des « HA » qui sautent, tampon « ENFUIE », la phrase du jeu.
import { useEffect, useRef } from 'react';
import { accord, texteFuite, type IssueRaid } from '../../lib/raid';
import { FiltreEncre, Tampon } from '../masadora/Paquet';
import { VisuelBoss } from './Boss';

export function Fuite({ issue, onFini }: { issue: Extract<IssueRaid, { type: 'fuite' }>; onFini: () => void }) {
  const { boss, pv } = issue;
  const piste = useRef<HTMLDivElement>(null);
  const silhouette = useRef<HTMLDivElement>(null);
  const rappel = useRef(onFini);
  rappel.current = onFini;

  useEffect(() => {
    navigator.vibrate?.([60, 50, 60]);
    const fin = setTimeout(() => rappel.current(), 3800);
    const minuteries: number[] = [];
    let anim: Animation | undefined;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      anim =
        boss.rendu === 'affiche'
          ? silhouette.current?.animate(
              [{ transform: 'none' }, { transform: 'translate(10vw, -4%) rotate(8deg)', offset: 0.25 }, { transform: 'translate(40vw, -14%) rotate(-10deg)', offset: 0.55 }, { transform: 'translate(95vw, -30%) rotate(40deg)' }],
              { duration: 2600, easing: 'ease-in', fill: 'forwards' },
            )
          : silhouette.current?.animate(
              [
                { transform: 'translateX(0) scaleX(1)' },
                { transform: 'translateX(0) scaleX(-1)', offset: 0.12 },
                { transform: 'translateX(18vw) scaleX(-1) translateY(-6%)', offset: 0.3 },
                { transform: 'translateX(36vw) scaleX(-1)', offset: 0.48 },
                { transform: 'translateX(54vw) scaleX(-1) translateY(-6%)', offset: 0.66 },
                { transform: 'translateX(90vw) scaleX(-1)' },
              ],
              { duration: 2800, easing: 'ease-in', fill: 'forwards' },
            );
      for (let i = 0; i < 5; i++)
        minuteries.push(
          window.setTimeout(() => {
            const h = document.createElement('span');
            h.className = 'ha';
            h.textContent = 'HA';
            h.style.left = `${46 + i * 9}%`;
            h.style.top = `${4 + (i % 2) * 14}%`;
            piste.current?.append(h);
            h.animate([{ opacity: 0, scale: 0.4, rotate: `${(i % 2 ? 1 : -1) * 14}deg` }, { opacity: 1, scale: 1.1, offset: 0.25 }, { opacity: 0, scale: 1, translate: '0 -22px' }], { duration: 900, fill: 'forwards' });
          }, 300 + i * 380),
        );
    }
    const clavier = (e: KeyboardEvent) => {
      if (['Enter', ' ', 'Escape'].includes(e.key)) {
        e.preventDefault();
        rappel.current();
      }
    };
    addEventListener('keydown', clavier);
    return () => {
      clearTimeout(fin);
      minuteries.forEach(clearTimeout);
      anim?.cancel();
      removeEventListener('keydown', clavier);
    };
  }, []);

  return (
    <div className={`rd-fuite ${boss.rendu}`} role="status" onClick={() => rappel.current()}>
      <FiltreEncre />
      <div ref={piste} className="piste">
        <div ref={silhouette} className="f-boss" aria-hidden="true">
          <VisuelBoss boss={boss} />
        </div>
      </div>
      <div className="tampon">
        <Tampon mots={[accord(boss, 'enfui').toUpperCase()]} taille={24} />
      </div>
      <p>{texteFuite(boss, pv)}</p>
      <small>Touche pour fermer</small>
    </div>
  );
}
