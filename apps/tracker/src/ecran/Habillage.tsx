// Habillage de la retransmission : bandeau du haut (chrono, état, un évènement à la fois), ligne du bas (trois
// premiers, dernière annonce du jeu), accueil avant le démarrage, pause, fin de partie figée.
import { Carte } from '@gq/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { A, attendre } from '../lib/anim';
import { construirePlan } from '../lib/plan';
import { bruiter, calme, dire } from '../lib/son';
import { chrono, etiquette, ligneAnnonce, mmss, trier } from '../lib/textes';
import { instantVue, restantMaintenant, type Vue } from '../lib/useEcran';
import type { EtatPartie } from '../lib/types';
import { IleSvg } from './Ile';

const ETATS: Record<EtatPartie, string> = {
  brouillon: 'Bientôt',
  inscriptions: 'Inscriptions',
  en_cours: 'En cours',
  phase_finale: 'Phase finale',
  pause: 'Pause',
  terminee: 'Terminée',
};

export function Haut({ v }: { v: Vue }) {
  const etat = v.partie.etat;
  const [iEv, setIEv] = useState(0);
  // Un seul évènement à la fois dans l'habillage ; s'il y en a plusieurs, ils alternent (6 s).
  useEffect(() => {
    const t = setInterval(() => setIEv((i) => i + 1), 6000);
    return () => clearInterval(t);
  }, []);
  const t = instantVue(v);
  const evs = v.raid ? [] : v.evs.filter((e) => e.finA > t);
  const e = evs.length ? evs[iEv % evs.length] : null;
  const zone = e?.zoneId ? v.partie.zones.find((z) => z.id === e.zoneId)?.nom : null;
  return (
    <header className="haut" aria-label="État de la partie">
      <div className="marque">
        <b>Greed Island</b>
        <span className={`pastille${etat === 'phase_finale' ? ' finale' : etat === 'pause' ? ' pause' : ''}`}>
          <i />
          <span>{ETATS[etat]}</span>
        </span>
        <span className={`reco${v.enLigne ? '' : ' on'}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" aria-hidden="true">
            <path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5" />
          </svg>
          Reconnexion…
        </span>
      </div>
      <div className="evs" aria-label="Évènements en cours">
        {e && (
          <div key={`${e.id}-${iEv % evs.length}`} className={`ev entre${etiquette(e).maudite ? ' maudite' : ''}`}>
            <b>{etiquette(e).titre}</b>
            {zone && <span>{zone}</span>}
            <time>{mmss(e.finA - t)}</time>
          </div>
        )}
      </div>
      <div className={`chrono${etat === 'phase_finale' ? ' rouge' : ''}`} aria-label="Temps restant">
        {chrono(restantMaintenant(v))}
      </div>
    </header>
  );
}

export function Bas({ v }: { v: Vue }) {
  const tete = trier(v.classement).slice(0, 3);
  const txt = useRef<HTMLSpanElement>(null);
  const premier = v.fil[0];
  useEffect(() => {
    const el = txt.current;
    if (!el) return;
    el.classList.remove('neuf');
    void el.offsetWidth;
    el.classList.add('neuf');
  }, [premier]);
  return (
    <footer className="bas">
      <div className="tete3" aria-label="Les trois premiers">
        {tete.map((l, i) => (
          <span key={l.pseudo} className={`m${i + 1}${v.monte?.pseudo === l.pseudo ? ' monte' : ''}`}>
            <i>{i + 1}</i>
            {l.pseudo}
          </span>
        ))}
      </div>
      <div className="annonce" aria-live="polite">
        <span className="txt" ref={txt}>
          {premier ? ligneAnnonce(premier) : 'Bienvenue dans Greed Island'}
        </span>
      </div>
    </footer>
  );
}

/** Avant le démarrage : les cartes rares à gagner, en alternance avec chaque Hunter qui entre. */
export function Accueil({ v, onEntree }: { v: Vue; onEntree: () => void }) {
  const [iVitrine, setIVitrine] = useState(0);
  const entree = useRef<HTMLDivElement>(null);
  const qui = v.entrees[0];
  useEffect(() => {
    if (qui) return;
    const t = setInterval(() => setIVitrine((i) => i + 1), 5200);
    return () => clearInterval(t);
  }, [qui]);
  const carte = v.vitrine.length ? v.vitrine[iVitrine % v.vitrine.length]! : null;
  const vitrine = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (calme) return;
    A(vitrine.current?.querySelector('.gi-carte'), [{ transform: 'rotateY(-90deg) scale(.9)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 900 });
  }, [iVitrine]);

  useEffect(() => {
    if (!qui) return;
    const el = entree.current;
    const ctl = new AbortController();
    bruiter('souffle');
    dire('Un nouveau joueur entre dans Greed Island !', { delai: 300 });
    (async () => {
      A(el, [{ transform: 'translateY(-50%) rotate(-3deg) translateX(110%)' }, { transform: 'translateY(-50%) rotate(-3deg)' }], { duration: 600 });
      await attendre(2600, ctl.signal);
      if (ctl.signal.aborted) return;
      await A(el, [{ transform: 'translateY(-50%) rotate(-3deg)' }, { transform: 'translateY(-50%) rotate(-3deg) translateX(-110%)' }], { duration: 500, easing: 'cubic-bezier(.6,0,.8,.4)' })?.finished.catch(() => undefined);
      if (!ctl.signal.aborted) onEntree();
    })();
    return () => ctl.abort();
    // Une entrée à la fois : on rejoue seulement quand le Hunter change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qui, v.entrees.length]);

  return (
    <div className="accueil on">
      <div className="acc-gauche">
        <h1>
          Greed
          <br />
          Island<small>Une chasse aux cartes grandeur nature</small>
        </h1>
        <div className="compte">
          <b>{v.classement.length}</b>
          <span>
            Hunter{v.classement.length > 1 ? 's' : ''}
            <br />
            inscrit{v.classement.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="arrivants">
          {v.arrivants.map((p, i) => (
            <span key={`${p}-${i}`}>{p}</span>
          ))}
        </div>
      </div>
      <div className="vitrine" ref={vitrine}>
        {carte && (
          <>
            <Carte key={iVitrine} genre="designee" numero={carte.numero} nom={carte.nom} rang={carte.rang} limite={carte.limite} texte={carte.texte} />
            <p>
              Une des {v.nCartes} cartes à gagner dans l'île · rang {carte.rang}
            </p>
          </>
        )}
      </div>
      {qui && (
        <div className="entree on" ref={entree} key={`${qui}-${v.entrees.length}`}>
          <b>{qui}</b>
          <span>entre dans Greed Island</span>
        </div>
      )}
    </div>
  );
}

export function Pause() {
  return (
    <div className="pause-voile on">
      <div className="tampon">
        <b>PAUSE</b>
        <span>Le chrono est arrêté</span>
      </div>
    </div>
  );
}

/** Fin de partie (figée) : le classement final, puis la révélation des QR, en alternance (18 s). */
export function FinFigee({ v }: { v: Vue }) {
  const [vue, setVue] = useState<'classement' | 'ile'>('classement');
  const ref = useRef<HTMLDivElement>(null);
  const plan = useMemo(() => construirePlan(v.partie.zones), [v.partie.zones]);
  const revelees = v.balisesRevelees.length > 0;
  useEffect(() => {
    if (!revelees) return;
    const t = setInterval(() => setVue((x) => (x === 'classement' ? 'ile' : 'classement')), 18_000);
    return () => clearInterval(t);
  }, [revelees]);
  useEffect(() => {
    if (calme || vue !== 'classement') return;
    ref.current?.querySelectorAll('.fl').forEach((el, i) => A(el, [{ transform: 'translateY(30px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600, delay: 200 + i * 90 }));
  }, [vue]);
  const top = trier(v.classement).slice(0, 10);
  return (
    <div className="fin on" ref={ref}>
      {vue === 'classement' ? (
        <div className={`fv fv-classement vu${calme ? '' : ' entre'}`} key="c">
          <h1>Classement final</h1>
          <div className="final">
            {top.map((l, i) => (
              <div key={l.pseudo} className={`fl${i < 3 ? ` m${i + 1}` : ''}`}>
                <span className="r">{i + 1}</span>
                <span className="p">{l.pseudo}</span>
                <span className="n">
                  {l.cartes}
                  <small> / {v.nCartes}</small>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={`fv fv-ile vu${calme ? '' : ' entre'}`} key="i">
          <div>
            <h1>Voilà où se cachaient les QR</h1>
            <p>Les {v.balisesRevelees.length} balises de la partie, à leur vraie place.</p>
          </div>
          <div className="ile-cadre" style={{ aspectRatio: `${plan.largeur} / ${plan.hauteur}` }}>
            <IleSvg plan={plan} p="f" revelees={v.balisesRevelees} />
          </div>
        </div>
      )}
    </div>
  );
}
