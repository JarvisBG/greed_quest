// Le Book ouvert (prototype validé docs/prototype/book-greed-island.html) : à gauche l'intérieur de la couverture
// ou le revers de la page précédente, à droite la page courante ; on tourne les pages au doigt (aller-retour libre,
// élan) ou avec les flèches. RG-8.5 : pages d'emplacements désignés (papier blanc, filet rouge, numéro de l'anime
// en creux dans chaque pochette vide) puis pages d'emplacements libres (papier tramé gris, filet d'encre, sans numéro),
// et la page des objets (papier crème, filet jaune ; 8 places à part des libres, rangées dans le Book comme dans l'anime).
import { FREE_SLOTS } from '@gq/engine';
import { Carte, DosCarte, numeroCarte } from '@gq/ui';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { numeroSort, OBJETS, SORTS } from '../../lib/format';
import { etiquetteDe, genreDePage, nombreDePages, rangDePage, titreDePage, type Emplacement, type LivreRecu } from '../../lib/livre';
import type { ObjetRecu, Sujet } from './Fiche';

const POCHES_PAR_PAGE = 12; // grille 3 × 4 : 10 pochettes (RG-8.5) et le folio

interface Tour {
  sens: 1 | -1;
  cible: number;
}

export function Feuillets({ livre, onPoche }: { livre: LivreRecu; onPoche: (s: Sujet) => void }) {
  const n = nombreDePages(livre);
  const [courante, setCourante] = useState(0);
  const [tour, setTour] = useState<Tour | null>(null);
  const prog = useRef(0);
  const feuille = useRef<HTMLDivElement>(null);
  const dessous = useRef<HTMLDivElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const appui = useRef<{ x: number; y: number; id: number; actif: boolean; vx: number; tx: number; tt: number } | null>(null);
  const glisse = useRef(false);
  const occupe = useRef(false);
  const calme = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches).current;
  const p = Math.min(courante, n - 1);

  const tourCourant = useRef<Tour | null>(null);
  tourCourant.current = tour;

  // Le bord libre de la page suit le doigt : angle = arccos(1 − 2 × avancée).
  const poser = (x: number) => {
    prog.current = Math.max(0, Math.min(1, x));
    const t = tourCourant.current;
    if (!t || !feuille.current || !dessous.current) return;
    const avance = t.sens > 0 ? prog.current : 1 - prog.current;
    const angle = (-Math.acos(1 - 2 * avance) * 180) / Math.PI;
    const s = Math.sin(avance * Math.PI);
    feuille.current.style.transform = `translateZ(2px) rotateY(${angle}deg) skewY(${-s * 4}deg)`;
    feuille.current.querySelector<HTMLElement>('.ombre-page')!.style.opacity = (s * 0.9).toFixed(3);
    dessous.current.querySelector<HTMLElement>('.ombre-page')!.style.opacity = ((1 - avance) * s * 1.1).toFixed(3);
  };
  useLayoutEffect(() => {
    if (tour) poser(prog.current);
  }, [tour]);

  const commencer = (sens: 1 | -1): boolean => {
    const cible = p + sens;
    if (cible < 0 || cible >= n || tourCourant.current) return false;
    prog.current = 0;
    const t = { sens, cible };
    tourCourant.current = t;
    setTour(t);
    return true;
  };
  const finir = (garder: boolean) =>
    new Promise<void>((fini) => {
      const t = tourCourant.current;
      if (!t) return fini();
      const depart = prog.current;
      const arrivee = garder ? 1 : 0;
      const duree = calme ? 1 : 460 * Math.max(0.35, Math.abs(arrivee - depart));
      const t0 = performance.now();
      const pas = (now: number) => {
        const x = Math.min(1, (now - t0) / duree);
        poser(depart + (arrivee - depart) * (1 - Math.pow(1 - x, 3)));
        if (x < 1) return void requestAnimationFrame(pas);
        if (garder) setCourante(t.cible);
        tourCourant.current = null;
        setTour(null);
        fini();
      };
      requestAnimationFrame(pas);
    });
  const tourner = async (sens: 1 | -1) => {
    if (occupe.current || !commencer(sens)) return;
    occupe.current = true;
    await new Promise((r) => requestAnimationFrame(r));
    await finir(true);
    occupe.current = false;
  };

  const surAppui = (e: React.PointerEvent) => {
    glisse.current = false;
    if (occupe.current || tourCourant.current) return;
    appui.current = { x: e.clientX, y: e.clientY, id: e.pointerId, actif: false, vx: 0, tx: e.clientX, tt: performance.now() };
  };
  const surMouvement = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = appui.current;
    if (!a || e.pointerId !== a.id) return;
    const dx = e.clientX - a.x;
    const dy = e.clientY - a.y;
    if (!a.actif) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      if (!commencer(dx < 0 ? 1 : -1)) {
        appui.current = null;
        return;
      }
      a.actif = true;
      glisse.current = true;
      occupe.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* pointeur déjà relâché */
      }
    }
    const now = performance.now();
    a.vx = (e.clientX - a.tx) / Math.max(1, now - a.tt);
    a.tx = e.clientX;
    a.tt = now;
    const w = e.currentTarget.getBoundingClientRect().width;
    const t = tourCourant.current;
    if (t) poser((t.sens > 0 ? -dx : dx) / w);
  };
  const lacher = async (e: React.PointerEvent) => {
    const a = appui.current;
    if (!a || e.pointerId !== a.id) return;
    appui.current = null;
    if (!a.actif) return;
    const t = tourCourant.current;
    const elan = t && t.sens > 0 ? -a.vx : a.vx;
    await finir(elan > 0.5 || (prog.current > 0.45 && elan > -0.3));
    occupe.current = false;
  };

  // Ce qu'on voit à gauche : la garde de la couverture, ou le revers de la page précédente.
  const gauche = tour && tour.sens < 0 ? tour.cible : p;
  const tournee = tour ? (tour.sens > 0 ? p : tour.cible) : 0;
  const genre = genreDePage(livre, p);
  const { rang, sur } = rangDePage(livre, p);

  return (
    <>
      <div className={`livre-zone ouvert${livre.gele ? ' gele' : ''}`} ref={zone}>
        <div className="livre-pos">
          <div className="livre flotte">
            <div
              className="feuillets"
              onPointerDown={surAppui}
              onPointerMove={surMouvement}
              onPointerUp={(e) => void lacher(e)}
              onPointerCancel={(e) => void lacher(e)}
              onClickCapture={(e) => {
                if (glisse.current) {
                  e.stopPropagation();
                  glisse.current = false;
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') void tourner(1);
                if (e.key === 'ArrowLeft') void tourner(-1);
              }}
            >
              {gauche === 0 ? (
                <div className="page gauche interieur" aria-hidden="true" />
              ) : (
                <div className={`page gauche verso p-${genreDePage(livre, gauche - 1)}`} aria-hidden="true">
                  <Contenu livre={livre} i={gauche - 1} verso />
                </div>
              )}
              <div className={`page droite p-${genre}`} style={tour ? { visibility: 'hidden' } : undefined}>
                <Contenu livre={livre} i={p} onPoche={onPoche} />
              </div>
              {tour && (
                <>
                  <div className={`page dessous droite p-${genreDePage(livre, tour.sens > 0 ? tour.cible : p)}`} ref={dessous} aria-hidden="true">
                    <Contenu livre={livre} i={tour.sens > 0 ? tour.cible : p} />
                    <span className="ombre-page" />
                  </div>
                  <div className="feuille-tournee" ref={feuille} aria-hidden="true">
                    <div className={`page recto droite p-${genreDePage(livre, tournee)}`}>
                      <Contenu livre={livre} i={tournee} />
                      <span className="ombre-page" />
                    </div>
                    <div className={`page verso p-${genreDePage(livre, tournee)}`}>
                      <Contenu livre={livre} i={tournee} verso />
                    </div>
                  </div>
                </>
              )}
            </div>
            <Tranche livre={livre} depuis={p} />
          </div>
        </div>
        <div className="livre-ombre" aria-hidden="true" />
        {livre.gele && (
          <div className="tampon-gel" aria-hidden="true">
            Gelé
          </div>
        )}
      </div>
      <nav className="pages-nav" aria-label="Pages du Book">
        <button className="btn-page" onClick={() => void tourner(-1)} disabled={p === 0} aria-label="Page précédente">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5 8 12l7 7" />
          </svg>
        </button>
        <span aria-live="polite">
          {NOMS[genre]} · page <b>{p + 1}</b> / {n}
          <span className="sr">
            {' '}
            ({rang} sur {sur})
          </span>
        </span>
        <button className="btn-page" onClick={() => void tourner(1)} disabled={p >= n - 1} aria-label="Page suivante">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 5 7 7-7 7" />
          </svg>
        </button>
      </nav>
    </>
  );
}

const NOMS = { designee: 'Désignées', libre: 'Libres', objets: 'Objets' } as const;
const TRANCHE = { designee: '#fbfbf7', libre: '#a9a69c', objets: '#e2cf8f' } as const;

/** Tranche des feuillets qui restent à droite : une bande par page, à la couleur de son papier. */
function Tranche({ livre, depuis }: { livre: LivreRecu; depuis: number }) {
  const bandes = Array.from({ length: nombreDePages(livre) - depuis }, (_, k) => TRANCHE[genreDePage(livre, depuis + k)]);
  const pas = 3;
  const fond = `linear-gradient(90deg, ${bandes.map((c, k) => `${c} ${k * pas}px ${k * pas + 2}px, #6f6c64 ${k * pas + 2}px ${(k + 1) * pas}px`).join(', ')})`;
  const largeur = bandes.length * pas + 2;
  const style: CSSProperties = { width: largeur, right: -largeur + 1, background: fond };
  return <span className="tranche" style={style} aria-hidden="true" />;
}

function Contenu({ livre, i, verso, onPoche }: { livre: LivreRecu; i: number; verso?: boolean; onPoche?: (s: Sujet) => void }) {
  const genre = genreDePage(livre, i);
  const objets = genre === 'objets';
  const poches = objets ? livre.placesObjets : (livre.pages[i] ?? []).length;
  const restes = POCHES_PAR_PAGE - poches;
  const span = restes % 3 || 3;
  return (
    <>
      <div className="page-tete">
        <span>{NOMS[genre]}</span>
        <span>
          {genre === 'designee' ? (
            titreDePage(livre, i)
          ) : (
            <>
              {objets ? livre.objets.length : livre.libresUtilises}
              <small> / {objets ? livre.placesObjets : FREE_SLOTS}</small>
            </>
          )}
        </span>
      </div>
      <div className="poches">
        {objets
          ? Array.from({ length: livre.placesObjets }, (_, k) => {
              const o = livre.objets[k];
              if (verso) return <span key={k} className="poche">{o && <DosCarte />}</span>;
              return o ? <PocheObjet key={o.itemId} o={o} onPoche={onPoche} /> : <span key={k} className="poche" aria-hidden="true" />;
            })
          : (livre.pages[i] ?? []).map((e, k) => (verso ? <Revers key={k} e={e} /> : <Poche key={e.etat === 'plein' ? e.itemId : `v${k}`} e={e} onPoche={onPoche} />))}
        {restes > 0 && (
          <span className="page-folio" style={{ gridColumn: `span ${span}` }} aria-hidden="true">
            {verso ? '' : i + 1}
          </span>
        )}
        {Array.from({ length: Math.max(0, restes - span) }, (_, k) => (
          <span key={`c${k}`} className="case-vide" aria-hidden="true" />
        ))}
      </div>
    </>
  );
}

/** Revers d'une pochette : une carte rangée montre son dos. */
function Revers({ e }: { e: Emplacement }) {
  return <span className="poche">{e.etat === 'plein' && <DosCarte />}</span>;
}

function PocheObjet({ o, onPoche }: { o: ObjetRecu; onPoche?: ((s: Sujet) => void) | undefined }) {
  const d = OBJETS[o.objet];
  return (
    <button className="poche" onClick={onPoche ? () => onPoche({ type: 'objet', o }) : undefined} tabIndex={onPoche ? 0 : -1} aria-label={`Objet ${d.nom}${o.engage ? ', dans un échange' : ''}`}>
      <Carte genre="objet" numero={numeroSort(d.numero)} nom={d.nom} />
      {o.engage && <span className="badge-poche">Échange</span>}
    </button>
  );
}

function Poche({ e, onPoche }: { e: Emplacement; onPoche?: ((s: Sujet) => void) | undefined }) {
  const ouvrir = onPoche ? () => onPoche({ type: 'poche', e }) : undefined;
  const tab = onPoche ? 0 : -1;
  if (e.etat === 'vide' && !e.designe) return <span className="poche" aria-hidden="true" />;
  if (e.etat === 'vide') {
    const num = numeroCarte(e.carte.numero);
    return (
      <button className="poche" onClick={ouvrir} tabIndex={tab} aria-label={`${num} ${e.carte.nom}, rang ${e.carte.rang ?? '?'}, pas encore trouvée`}>
        <span className="poche-num">
          {num}
          <em>{e.carte.rang}</em>
        </span>
      </button>
    );
  }
  if (e.etat === 'perdu') {
    const num = numeroCarte(e.carte.numero);
    return (
      <button className="poche perdue" onClick={ouvrir} tabIndex={tab} aria-label={`${num} ${e.carte.nom} : ${e.message}`}>
        <span className="poche-num">
          {num}
          <span>{e.message}</span>
        </span>
      </button>
    );
  }
  if (e.kind === 'sort') {
    const s = SORTS[e.sort];
    return (
      <button className="poche" onClick={ouvrir} tabIndex={tab} aria-label={`Sort ${s.nom}`}>
        <Carte genre="sort" numero={numeroSort(s.numero)} nom={s.nom} />
      </button>
    );
  }
  const etiquette = etiquetteDe(e);
  const nom = e.apparence === 'grisee' ? `Contrefaçon de ${e.nom}` : e.nom;
  return (
    <button className="poche" onClick={ouvrir} tabIndex={tab} aria-label={`${numeroCarte(e.numero)} ${nom}, rang ${e.rang ?? '?'}${etiquette ? `, ${etiquette.texte.toLowerCase()}` : ''}`}>
      <Carte genre="designee" numero={e.numero} nom={nom} rang={e.rang} limite={e.limite ?? null} grisee={e.apparence === 'grisee'} />
      {etiquette && <span className={`badge-poche${etiquette.alerte ? ' rouge' : ''}`}>{etiquette.texte}</span>}
    </button>
  );
}
