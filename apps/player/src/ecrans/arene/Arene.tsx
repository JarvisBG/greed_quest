// Page ⑮ (prototype validé le 2026-10-12 : docs/prototype/arene.html) : l'arène de Soufrabi.
// Amendement 2026-10-09 : côté joueur, l'arène est passive. Le PNJ scanne la licence, prélève la mise et arbitre ;
// l'app montre l'affiche (mise, chances, quand revenir), puis « COMBAT EN COURS » tant que le verdict n'est pas tombé.
import { useEffect, useState } from 'react';
import { minSecArene, statutArene, texteDernier, type EtatArene } from '../../lib/arene';
import { IconeRetour } from '../Icones';

interface Props {
  etat: { etat: EtatArene; recuA: number } | null;
  jenny: number;
  recharger: () => void;
  onLicence: () => void;
  onRetour: () => void;
}

function IconeLicence() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9h4M7 13h4M14 9h3v6h-3z" />
    </svg>
  );
}

/** Une seconde qui passe : les décomptes avancent sans requête. */
export function useSeconde() {
  const [, tic] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tic((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
}

export function Arene({ etat, jenny, recharger, onLicence, onRetour }: Props) {
  useSeconde();
  useEffect(() => {
    recharger();
  }, []);
  const e = etat?.etat ?? null;
  const ecoule = etat ? Date.now() - etat.recuA : 0;
  const statut = e ? statutArene(e, jenny, ecoule) : null;
  const dernier = e ? texteDernier(e.dernier) : null;

  return (
    <div className="ar-page">
      <div className="mas-tete">
        <button className="mas-retour" onClick={onRetour}>
          <IconeRetour />
          Accueil
        </button>
        <div className="enseigne">
          <div className="planche">
            <h1>SOUFRABI</h1>
            <span>l’arène</span>
          </div>
        </div>
      </div>

      {!e && <p className="doux">Chargement de l’arène…</p>}

      {e && statut === 'combat' && e.enCours && (
        <section className="ar-combat" aria-live="polite">
          <h2>COMBAT EN COURS</h2>
          <span className="chrono-combat">{minSecArene(e.enCours.depuisMs + ecoule)}</span>
          <span className="engagee">
            Mise engagée <b>{e.enCours.mise} J</b>
          </span>
          <p>Le PNJ arbitre ton défi. Le verdict tombera ici, où que tu sois dans l’app.</p>
        </section>
      )}

      {e && statut !== 'combat' && (
        <section className="ar-affiche" aria-labelledby="ar-t-affiche">
          <span className="surtitre">— le PNJ de l’arène t’attend —</span>
          <h2 id="ar-t-affiche">DÉFI DE L’ARÈNE</h2>
          <div className="issues">
            <div className="gagne">
              <span className="t">Victoire</span>
              <div className="chances" aria-label={`Une carte A ${e.chances.A ?? 0} %, S ${e.chances.S ?? 0} %, SS ${e.chances.SS ?? 0} %`}>
                {(['A', 'S', 'SS'] as const).map((r) => (
                  <span key={r} className="chance">
                    <i className={`ar-sceau r-${r}`}>{r}</i>
                    {e.chances[r] ?? 0} %
                  </span>
                ))}
              </div>
              <p>une carte de haut rang</p>
            </div>
            <div className="perd">
              <span className="t">Mise</span>
              <span className="mise">
                {e.mise}
                <small>J</small>
              </span>
              <p>perdue en cas de défaite</p>
            </div>
          </div>
          <div className="statut" aria-live="polite">
            {statut === 'attente' && (
              <div className="attente">
                <span>Prochaine tentative dans</span>
                <b>{minSecArene(e.prochaineDansMs - ecoule)}</b>
              </div>
            )}
            {statut === 'pauvre' && (
              <span className="ligne">
                Il te faut {e.mise} J pour entrer : tu en as {jenny}.
              </span>
            )}
            {statut === 'pret' && <span className="ligne">Prêt au combat. Montre ta licence au PNJ de l’arène : il prélève la mise et lance le défi.</span>}
            {dernier && (
              <span className="dernier">
                Dernier combat : <b>{dernier}</b>
              </span>
            )}
            {statut !== 'attente' && (
              <button className={`ar-gros${statut === 'pauvre' ? ' secondaire' : ''}`} onClick={onLicence}>
                <IconeLicence />
                {statut === 'pauvre' ? 'Ma licence' : 'Montrer ma licence'}
              </button>
            )}
          </div>
        </section>
      )}

      {e && (
        <p className="doux ar-regle">
          Une tentative toutes les {e.delaiMin} min, comptées depuis ton entrée. Si le PNJ annule une entrée par erreur, ta mise t’est rendue. Book plein : la carte gagnée s’ajoute quand même.
        </p>
      )}
    </div>
  );
}

/** Bandeau du combat en cours, sous la barre, sur toutes les autres pages ; le toucher ramène à l'arène. */
export function BandeauCombat({ etat, onOuvrir }: { etat: { etat: EtatArene; recuA: number } | null; onOuvrir: () => void }) {
  useSeconde();
  const c = etat?.etat.enCours;
  if (!c || !etat) return null;
  return (
    <button className="ar-bandeau" onClick={onOuvrir}>
      <i className="poing" aria-hidden="true" />
      Combat en cours à Soufrabi
      <b>{minSecArene(c.depuisMs + Date.now() - etat.recuA)}</b>
    </button>
  );
}
