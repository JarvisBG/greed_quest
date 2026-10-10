// Le Book fermé de l'accueil (prototype validé : docs/prototype/book-greed-island.html) : il flotte au-dessus de
// son ombre ; « Book ! » l'invoque (lignes de concentration, onomatopée, il monte, la couverture s'ouvre),
// puis l'onglet Book prend le relais.
import { FREE_SLOTS } from '@gq/engine';
import { Concentration, EmblemeBook } from '@gq/ui';
import { useRef, useState } from 'react';

export function BookFerme({ designees, total, libres, onOuvert }: { designees: number | null; total: number | null; libres: number | null; onOuvert: () => void }) {
  const zone = useRef<HTMLDivElement>(null);
  const [occupe, setOccupe] = useState(false);

  const invoquer = async () => {
    const z = zone.current;
    if (!z || occupe) return;
    setOccupe(true);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return onOuvert();
    navigator.vibrate?.(30);
    const $ = (s: string) => z.querySelector<HTMLElement>(s)!;
    const anim = (el: HTMLElement, k: Keyframe[], o: KeyframeAnimationOptions) => el.animate(k, { fill: 'forwards', ...o }).finished;
    await Promise.all([
      anim($('.gi-concentration'), [{ opacity: 0, transform: 'scale(1.25)' }, { opacity: 0.9, transform: 'scale(1)', offset: 0.3 }, { opacity: 0, transform: 'scale(.96)' }], { duration: 900, easing: 'ease-out' }),
      anim(
        $('.onomatopee'),
        [
          { opacity: 0, transform: 'translate(-50%,0) rotate(-8deg) scale(.4)' },
          { opacity: 1, transform: 'translate(-50%,0) rotate(-8deg) scale(1.06)', offset: 0.25 },
          { opacity: 1, transform: 'translate(-50%,0) rotate(-8deg) scale(1)', offset: 0.75 },
          { opacity: 0, transform: 'translate(-50%,-14px) rotate(-8deg) scale(1)' },
        ],
        { duration: 1000, easing: 'cubic-bezier(.16,1,.3,1)' },
      ),
      anim(
        $('.book-volume'),
        [
          { transform: 'translateY(0) scale(1) rotateX(4deg)' },
          { transform: 'translateY(-26px) scale(1.06) rotateX(10deg)', offset: 0.55 },
          { transform: 'translateY(-14px) scale(1.04) rotateX(6deg)' },
        ],
        { duration: 760, easing: 'cubic-bezier(.16,1,.3,1)' },
      ),
    ]);
    await anim($('.book-couv'), [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-165deg)' }], { duration: 700, easing: 'cubic-bezier(.45,.05,.2,1)' });
    onOuvert();
  };

  return (
    <section className="gi-case book-case gi-trame" aria-labelledby="t-book">
      <div className="book-hud">
        <h2 id="t-book" className="sous-titre">
          Book
        </h2>
        <span>
          Désignées{' '}
          <b>
            {designees ?? '–'}
            {total !== null && <small> / {total}</small>}
          </b>
        </span>
        <span>
          Libres{' '}
          <b>
            {libres ?? '–'}
            <small> / {FREE_SLOTS}</small>
          </b>
        </span>
      </div>
      <div className="book-zone" ref={zone}>
        <Concentration graine={7} />
        <div className="onomatopee" aria-hidden="true">
          BOOK !
        </div>
        <button className="book-volume" onClick={() => void invoquer()} aria-label="Invoquer le Book" tabIndex={-1}>
          <span className="book-pages" aria-hidden="true" />
          <span className="book-couv" aria-hidden="true">
            <EmblemeBook />
            <strong>BOOK</strong>
          </span>
        </button>
        <div className="book-ombre" aria-hidden="true" />
      </div>
      <button className="gi-btn-encre" onClick={() => void invoquer()} disabled={occupe}>
        Book !
      </button>
    </section>
  );
}
