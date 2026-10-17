// Alertes anti-triche (RG-15) : le serveur alerte, l'humain décide. Chaque alerte mène au joueur visé, avec le
// raccourci de sanction adapté (photo partagée → annulation des gains de cette balise).
import { heure, joueursAlerte, libelleAlerte, type Alerte } from '../lib/format';
import type { Equipe } from '../lib/useEquipe';
import type { Cible } from './Joueur';

export function Alertes({ eq, viserJoueur }: { eq: Equipe; viserJoueur: (c: Cible) => void }) {
  return (
    <section className="pile">
      <h1>Alertes</h1>
      {eq.alertes.length === 0 && <p className="info">Aucune alerte pour l’instant.</p>}
      <ul className="fil">
        {eq.alertes.map((a, i) => (
          <li key={a.id ?? `direct-${i}`} className={a.id === undefined ? 'nouvelle' : ''}>
            <span className="quand">{a.creeLe ? heure(a.creeLe) : ''}</span>
            <p className="detail">{libelleAlerte(nommer(a, eq.pseudos))}</p>
            <div className="sous-onglets">
              {joueursAlerte(a).map((id) => (
                <button
                  key={id}
                  type="button"
                  className="secondaire"
                  onClick={() => viserJoueur({ joueurId: id, ...(a.type === 'photo_partagee' && typeof a.baliseId === 'string' ? { baliseId: a.baliseId } : {}) })}
                >
                  {a.type === 'photo_partagee' ? 'Annuler les gains de ' : 'Voir '}
                  {eq.pseudos.get(id) ?? 'ce joueur'}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Complète les pseudos quand l'alerte ne donne que des identifiants. */
function nommer(a: Alerte, pseudos: Map<string, string>): Alerte {
  if (a.pseudo || a.pseudos) return a;
  const ids = joueursAlerte(a);
  const noms = ids.map((id) => pseudos.get(id)).filter((x): x is string => !!x);
  return noms.length === 0 ? a : noms.length === 1 ? { ...a, pseudo: noms[0]! } : { ...a, pseudos: noms };
}
