// Petites aides d'animation (Web Animations), reprises du prototype. Mouvement réduit : on saute à l'image finale.
import { calme } from './son';

export const SORTIE = 'cubic-bezier(.16,1,.3,1)';

export function A(el: Element | null | undefined, k: Keyframe[], o: KeyframeAnimationOptions = {}): Animation | null {
  if (!el) return null;
  if (calme) return el.animate(k.slice(-1), { duration: 1, fill: 'both' });
  return el.animate(k, { fill: 'both', easing: SORTIE, ...o });
}

/** Attente annulable (une cinématique démontée s'arrête net). */
export function attendre(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((ok) => {
    const t = setTimeout(ok, calme ? Math.min(ms, 400) : ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      ok();
    });
  });
}

/** Secousse de la cinématique (l'écran garde sa mise à l'échelle). */
export function secouer(el: HTMLElement | null) {
  if (calme || !el) return;
  el.classList.remove('secoue');
  void el.offsetWidth;
  el.classList.add('secoue');
  setTimeout(() => el.classList.remove('secoue'), 520);
}
