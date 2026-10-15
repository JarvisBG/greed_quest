// Page ⑱ : le classement final (RG-4.6, RG-13.5 à 13.7 ; prototype validé : docs/prototype/fin-partie.html).
// Ruban du Clear, podium des trois premiers (marches d'encre, plaques or / argent / bronze), « Ta partie » (tes vraies
// cartes, points, jenny, dernière carte, tampon de ta place), liste à partir de la 4e (ex æquo, abandon), ta ligne
// épinglée au-dessus des onglets quand elle est hors de l'écran, « Comment on départage ».
import { useEffect, useState, type CSSProperties } from 'react';
import { exaequo, heureJeu, ordinal, podium, sousTitre, tailleNom, texteContrefacons, type Classement as Cl, type LigneFin } from '../../lib/fin';
import { Sceau } from '../clear/Sceau';
import { FiltreEncre } from '../masadora/Paquet';
import { TamponPlace } from './Dessins';

function Ligne({ l, c, id }: { l: LigneFin; c: Cl; id?: string }) {
  return (
    <li className={`fp-ligne${l.moi ? ' moi' : ''}`} id={id}>
      <span className="pl">
        {ordinal(l.place)}
        {exaequo(c.lignes, l.place) && <small>ex æquo</small>}
      </span>
      <span className="ps">
        {l.pseudo}
        {l.moi && <span className="sr"> (toi)</span>}
        {l.abandon && <em>abandon</em>}
      </span>
      <span className="nb">
        {l.cartes}
        <small>/{c.designees}</small>
      </span>
      <span className="pt">{l.points}</span>
    </li>
  );
}

export function Classement({ c, onLots }: { c: Cl; onLots?: () => void }) {
  const moi = c.moi;
  const maLigne = c.lignes.find((l) => l.moi) ?? null;
  const total = c.lignes.length;
  const reste = c.lignes.filter((l, i) => i >= 3);
  const largeur = Math.min(innerWidth - 32, 448) / 3.2;
  const note = moi ? texteContrefacons(moi.contrefacons) : null;
  // Ta ligne épinglée au-dessus des onglets tant qu'elle n'est pas à l'écran.
  const [epingle, setEpingle] = useState(false);
  const enListe = maLigne !== null && c.lignes.indexOf(maLigne) >= 3;
  useEffect(() => {
    const el = document.getElementById('fp-ma-ligne');
    if (!el) return setEpingle(false);
    const obs = new IntersectionObserver(([e]) => setEpingle(!e!.isIntersecting), { rootMargin: '0px 0px -150px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [enListe]);

  return (
    <div className="planche fp-page">
      <FiltreEncre />
      <div className="fp-tete">
        <h1 className="titre-ecran">Classement final</h1>
        <p>{sousTitre(c)}</p>
      </div>
      {c.gagnant && (
        <div className="fp-ruban">
          <span className="fp-mini-sceau">
            <Sceau bas="GAGNÉ" />
          </span>
          <span>
            <b>Clear réussi</b> par {c.gagnant}
            {c.termineeA !== null && ` à ${heureJeu(c.termineeA)} de jeu`}
          </span>
        </div>
      )}
      {onLots && (
        <button className="gi-btn-trait" onClick={onLots}>
          Revoir mes lots
        </button>
      )}

      <section className="fp-podium" aria-label="Podium">
        {podium(c.lignes).map(({ ligne, marche }) => (
          <div key={marche} className={`fp-marche p${marche}${ligne.moi ? ' moi' : ''}`}>
            {ligne.moi && <span className="toi">TOI</span>}
            {c.gagnant === ligne.pseudo && (
              <span className="fp-sceau-clear" title="Clear">
                <Sceau bas="GAGNÉ" />
              </span>
            )}
            <div className="qui">
              <b style={{ '--fs': `${tailleNom(ligne.pseudo, largeur, marche === 1 ? 21 : 17).toFixed(1)}px` } as CSSProperties}>{ligne.pseudo}</b>
              <span>
                {ligne.cartes}/{c.designees} · {ligne.points} pts
              </span>
            </div>
            <div className="fp-bloc">
              <strong>{ligne.place}</strong>
            </div>
          </div>
        ))}
      </section>

      {moi && (
        <section className="fp-fiche" aria-labelledby="fp-fiche-t">
          <h2 id="fp-fiche-t">
            Ta partie{moi.abandon && <span className="fp-abandon"> · abandon</span>}
          </h2>
          <dl>
            <div>
              <dt>Cartes désignées</dt>
              <i />
              <dd>
                {moi.cartes}/{c.designees}
              </dd>
            </div>
            <div>
              <dt>Points de rang</dt>
              <i />
              <dd>{moi.points}</dd>
            </div>
            <div>
              <dt>Jenny</dt>
              <i />
              <dd>{moi.jenny} J</dd>
            </div>
            <div>
              <dt>Dernière carte</dt>
              <i />
              <dd>{moi.derniereCarteA === null ? '—' : heureJeu(moi.derniereCarteA)}</dd>
            </div>
          </dl>
          {note && <p className="note">{note}</p>}
          <div className="fp-tampon-place" role="img" aria-label={`Ta place : ${ordinal(moi.place)} sur ${total}`}>
            <TamponPlace grand={ordinal(moi.place)} petit={`SUR ${total}`} haut="TA PLACE" />
          </div>
        </section>
      )}

      {reste.length > 0 && (
        <>
          <div className="fp-liste-tete" aria-hidden="true">
            <span>Place</span>
            <span>Hunter</span>
            <span>Cartes</span>
            <span>Points</span>
          </div>
          <ol className="fp-classement" aria-label="Classement complet">
            {reste.map((l) => (
              <Ligne key={l.pseudo} l={l} c={c} {...(l.moi ? { id: 'fp-ma-ligne' } : {})} />
            ))}
          </ol>
        </>
      )}

      <details className="fp-depart">
        <summary>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 5 7 7-7 7" />
          </svg>
          Comment on départage
        </summary>
        <ol>
          <li>Le plus de cartes désignées différentes (les vraies seulement : une contrefaçon ne compte pas).</li>
          <li>Puis la somme de leurs rangs : SS 6, S 5, A 4, B 3, C 2, D 1.</li>
          <li>Puis le plus de jenny.</li>
          <li>Puis celui qui a obtenu sa dernière carte désignée le plus tôt.</li>
        </ol>
      </details>

      {maLigne && enListe && (
        <div
          className={`fp-epingle${epingle ? '' : ' cache'}`}
          aria-hidden="true"
          onClick={() => document.getElementById('fp-ma-ligne')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })}
        >
          <ol className="fp-classement">
            <Ligne l={maLigne} c={c} />
          </ol>
        </div>
      )}
    </div>
  );
}
