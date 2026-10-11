// Le Book fermé de l'accueil (prototype validé : docs/prototype/book-greed-island.html) : il flotte au-dessus de
// son ombre ; « Book ! » ouvre l'onglet Book, où la cinématique d'invocation se joue (ecrans/book/Invocation.tsx).
import { FREE_SLOTS } from '@gq/engine';
import { EmblemeBook } from '@gq/ui';

export function BookFerme({ designees, total, libres, onOuvert }: { designees: number | null; total: number | null; libres: number | null; onOuvert: () => void }) {
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
      <div className="book-zone">
        <button className="book-volume" onClick={onOuvert} aria-label="Invoquer le Book" tabIndex={-1}>
          <span className="book-pages" aria-hidden="true" />
          <span className="book-couv" aria-hidden="true">
            <EmblemeBook />
            <strong>BOOK</strong>
          </span>
        </button>
        <div className="book-ombre" aria-hidden="true" />
      </div>
      <button className="gi-btn-encre" onClick={onOuvert}>
        Book !
      </button>
    </section>
  );
}
