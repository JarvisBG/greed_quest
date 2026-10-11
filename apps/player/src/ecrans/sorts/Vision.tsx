// Vision de Voyance / Clairvoyance (page ⑧ ; demande de Sivraj du 2026-10-11 : voir les cartes de l'autre joueur
// directement à la suite du sort). La page du Book de la cible s'ouvre dans la nuit, avec le papier et les
// pochettes du vrai Book ; ses cartes se révèlent une à une ; on la feuillette, toucher une carte donne son nom.
import { Carte, numeroCarte } from '@gq/ui';
import { useEffect, useRef, useState } from 'react';
import type { PocheVision } from '../../lib/sorts';

interface Props {
  titre: string;
  cible: string;
  libres: boolean;
  /** Places des emplacements libres (« 7 / 15 »). */
  places: number;
  pages: PocheVision[][];
  onFermer: () => void;
}

export function Vision({ titre, cible, libres, places, pages, onFermer }: Props) {
  const [i, setI] = useState(0);
  const [choisie, setChoisie] = useState<number | null>(null);
  const page = useRef<HTMLDivElement>(null);
  const fermer = useRef<HTMLButtonElement>(null);
  const premiere = useRef(true);
  const poches = pages[i] ?? [];
  const pleines = pages.flat().filter((p) => p.type === 'carte').length;
  const restes = 12 - poches.length;
  const span = restes % 3 || 3;

  useEffect(() => fermer.current?.focus({ preventScroll: true }), []);
  // Les cartes se révèlent une à une, comme si la lumière les déposait.
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const delai = premiere.current ? 260 : 0;
    premiere.current = false;
    page.current?.querySelectorAll('.poche .gi-carte').forEach((el, k) =>
      el.animate([{ opacity: 0, transform: 'translateY(-8px) scale(1.06)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: delai + k * 70, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }),
    );
  }, [i]);

  const p = choisie !== null ? poches[choisie] : undefined;
  const legende =
    p?.type === 'carte'
      ? `${numeroCarte(p.numero)} · ${p.nom}, rang ${p.rang}${p.n > 1 ? ` (×${p.n})` : ''}${p.contrefacon ? ', contrefaçon' : ''}`
      : pleines
        ? 'Touche une carte pour lire son nom.'
        : `${cible} n’a aucune carte ici.`;
  const aller = (k: number) => {
    setI(k);
    setChoisie(null);
  };

  return (
    <div className="lancer-vision" role="dialog" aria-label={titre} onPointerDown={(e) => e.stopPropagation()}>
      <p className="lancer-vision-titre">{titre}</p>
      <div ref={page} className={`page lancer-vision-page ${libres ? 'p-libre' : 'p-designee'}`}>
        <div className="page-tete">
          <span>{libres ? 'Libres' : 'Fixes'}</span>
          <span>
            {libres ? (
              <>
                {pleines}
                <small> / {places}</small>
              </>
            ) : (
              `${numeroCarte(firstNum(poches))} – ${numeroCarte(lastNum(poches))}`
            )}
          </span>
        </div>
        <div className="poches">
          {poches.map((x, k) => {
            if (x.type === 'vide') return <span key={k} className="poche" aria-hidden="true" />;
            if (x.type === 'absente')
              return (
                <span key={k} className="poche" aria-label={`${numeroCarte(x.numero)}, pas dans son Book`}>
                  <span className="poche-num">
                    {numeroCarte(x.numero)}
                    <em>{x.rang}</em>
                  </span>
                </span>
              );
            return (
              <button key={k} className="poche" aria-pressed={choisie === k} aria-label={`${numeroCarte(x.numero)}, ${x.nom}, rang ${x.rang}`} onClick={() => setChoisie(k)}>
                <Carte genre="designee" numero={x.numero} nom={x.nom} rang={x.rang} />
                {x.contrefacon && <span className="badge-poche rouge">Contrefaçon</span>}
              </button>
            );
          })}
          {restes > 0 && (
            <span className="page-folio" style={{ gridColumn: `span ${span}` }} aria-hidden="true">
              {i + 1}
            </span>
          )}
          {Array.from({ length: Math.max(0, restes - span) }, (_, k) => (
            <span key={`c${k}`} className="case-vide" aria-hidden="true" />
          ))}
        </div>
      </div>
      <p className="lancer-vision-legende" aria-live="polite">
        {legende}
      </p>
      <div className="lancer-vision-bas">
        <button onClick={() => aller(i - 1)} disabled={i === 0} aria-label="Page précédente">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m15 5-7 7 7 7" />
          </svg>
        </button>
        <span>
          {i + 1} / {pages.length}
        </span>
        <button onClick={() => aller(i + 1)} disabled={i >= pages.length - 1} aria-label="Page suivante">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 5 7 7-7 7" />
          </svg>
        </button>
        <button ref={fermer} className="fermer" onClick={onFermer}>
          Fermer
        </button>
      </div>
    </div>
  );
}

const nums = (l: PocheVision[]) => l.map((p) => (p.type === 'vide' ? null : p.numero)).filter((n): n is number => n !== null);
const firstNum = (l: PocheVision[]) => nums(l)[0] ?? null;
const lastNum = (l: PocheVision[]) => nums(l).at(-1) ?? null;
