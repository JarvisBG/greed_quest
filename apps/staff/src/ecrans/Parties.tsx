// Page « Mes parties » (accueil de la console) : toutes les parties où ce membre s'est connecté sur cet appareil, avec
// leur état, leur code et leurs QR d'accès ; ouvrir, se déconnecter, rejouer une partie terminée (même terrain, même
// code GM), créer une nouvelle partie, rejoindre une partie avec un code. Avec le code organisateur : retrouver toutes
// les parties (nouvel appareil) et les statistiques de toutes les parties (rapports des festivals).
import { useEffect, useState } from 'react';
import { ApiError } from '../lib/api';
import { api, session as store } from '../lib/client';
import { libelleEtat } from '../lib/format';
import type { SessionEquipe } from '../lib/session';
import type { PartiePublique } from '../lib/useEquipe';
import { Acces } from './Acces';
import { Connexion } from './Connexion';
import { Creation, type Depuis } from './gm/Creation';
import { StatsFestivals } from './Statistiques';

type Vue =
  | { quoi: 'liste' }
  | { quoi: 'code'; partie?: string }
  | { quoi: 'creer'; depuis?: Depuis }
  | { quoi: 'orga'; pour: 'toutes' | 'stats' }
  | { quoi: 'toutes' }
  | { quoi: 'stats' };
interface PartieServeur {
  id: string;
  nom: string;
  etat: string;
  creeLe: string;
  joueurs: number;
}

/** Code organisateur gardé le temps de l'onglet (pas sur l'appareil : c'est le secret de l'organisateur). */
const CLE_ORGA = 'gq.orga';
const lireOrga = () => {
  try {
    return sessionStorage.getItem(CLE_ORGA) ?? '';
  } catch {
    return '';
  }
};
const garderOrga = (code: string | null) => {
  try {
    if (code) sessionStorage.setItem(CLE_ORGA, code);
    else sessionStorage.removeItem(CLE_ORGA);
  } catch {
    /* stockage indisponible : le code sera redemandé */
  }
};

/** Demande du code organisateur, vérifié en lisant la liste des parties. */
function CodeOrga({ suite, retour }: { suite: (code: string, parties: PartieServeur[]) => void; retour: () => void }) {
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  return (
    <form
      className="modal-box"
      style={{ display: 'grid', gap: 14 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setEnvoi(true);
        setErreur(null);
        try {
          const r = await api.getAvec<{ parties: PartieServeur[] }>('/admin/parties', { 'x-code-admin': code });
          garderOrga(code);
          suite(code, r.parties);
        } catch (err) {
          setErreur(err instanceof ApiError ? err.message : 'Vérification impossible');
          setEnvoi(false);
        }
      }}
    >
      <div className="modal-box__head">
        <h3>
          <i className="fa-solid fa-key" aria-hidden="true" /> Code organisateur
        </h3>
      </div>
      <p className="info">Il ouvre la liste de toutes les parties et leurs statistiques, depuis n’importe quel appareil.</p>
      <label>
        Code organisateur
        <input type="password" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
      </label>
      {erreur && <p className="erreur">{erreur}</p>}
      <div className="segments">
        <button type="button" className="modal-btn modal-btn--ghost" onClick={retour}>
          Retour
        </button>
        <button type="submit" className="modal-btn modal-btn--primary" disabled={envoi || !code}>
          {envoi ? 'Vérification…' : 'Valider'}
        </button>
      </div>
    </form>
  );
}
/** État lu de chaque partie : `null` = introuvable (supprimée). */
type Infos = Record<string, PartiePublique | null>;

const COULEURS: Record<string, string> = {
  en_cours: 'var(--success)',
  phase_finale: 'var(--gold)',
  pause: 'var(--gold)',
  terminee: 'var(--ink-faint)',
};

export function Parties({
  partieUrl,
  connecter,
  ouvrir,
}: {
  partieUrl: string | null;
  connecter: (partieId: string, code: string) => Promise<void>;
  ouvrir: (s: SessionEquipe) => void;
}) {
  const [liste, setListe] = useState(() => store.liste());
  // `?partie=X` sur une partie pas encore retenue ici : on arrive directement sur la connexion à X.
  const [vue, setVue] = useState<Vue>(() =>
    partieUrl && !liste.some((x) => x.partieId === partieUrl) ? { quoi: 'code', partie: partieUrl } : liste.length ? { quoi: 'liste' } : { quoi: 'code' },
  );
  const [infos, setInfos] = useState<Infos>({});
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [aOublier, setAOublier] = useState<string | null>(null);
  const [orga, setOrga] = useState(lireOrga);
  const [toutes, setToutes] = useState<PartieServeur[] | null>(null);

  useEffect(() => {
    for (const s of liste) {
      void api.get<{ partie: PartiePublique }>(`/parties/${s.partieId}`).then(
        (r) => setInfos((i) => ({ ...i, [s.partieId]: r.partie })),
        (e) => e instanceof ApiError && e.status === 404 && setInfos((i) => ({ ...i, [s.partieId]: null })),
      );
    }
  }, [liste]);

  const oublier = (id: string) => {
    store.oublier(id);
    setListe(store.liste());
    setAOublier(null);
  };
  const retour = () => setVue({ quoi: 'liste' });

  /** Toutes les parties ou les statistiques : code organisateur demandé une fois par onglet. */
  const avecOrga = async (pour: 'toutes' | 'stats') => {
    if (!orga) return setVue({ quoi: 'orga', pour });
    if (pour === 'stats') return setVue({ quoi: 'stats' });
    try {
      setToutes((await api.getAvec<{ parties: PartieServeur[] }>('/admin/parties', { 'x-code-admin': orga })).parties);
      setVue({ quoi: 'toutes' });
    } catch {
      garderOrga(null);
      setOrga('');
      setVue({ quoi: 'orga', pour });
    }
  };

  if (vue.quoi === 'code') return <Connexion partieInitiale={vue.partie ?? ''} connecter={connecter} retour={retour} creer={() => setVue({ quoi: 'creer' })} />;
  if (vue.quoi === 'creer') return <Creation depuis={vue.depuis} connecter={connecter} retour={retour} />;
  if (vue.quoi === 'orga') {
    const pour = vue.pour;
    return (
      <CodeOrga
        retour={retour}
        suite={(code, ps) => {
          setOrga(code);
          setToutes(ps);
          setVue({ quoi: pour });
        }}
      />
    );
  }
  if (vue.quoi === 'stats') return <StatsFestivals codeOrga={orga} retour={retour} />;

  return (
    <div className="parties">
      <div className="parties__tete">
        <div>
          <div className="eyebrow">
            <i className="fa-solid fa-hexagon-nodes" aria-hidden="true" /> GREED ISLAND · Console de l’équipe
          </div>
          <h1>Mes parties</h1>
        </div>
        <div className="parties__actions">
          <button type="button" className="modal-btn modal-btn--primary" onClick={() => setVue({ quoi: 'creer' })}>
            <i className="fa-solid fa-plus" aria-hidden="true" /> Nouvelle partie
          </button>
          <button type="button" className="modal-btn modal-btn--ghost" onClick={() => setVue({ quoi: 'code' })}>
            <i className="fa-solid fa-right-to-bracket" aria-hidden="true" /> Rejoindre avec un code
          </button>
        </div>
      </div>
      <div className="parties__orga">
        <span className="vide">Organisateur :</span>
        <button type="button" className="lien" onClick={() => void avecOrga('toutes')}>
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true" /> Retrouver toutes les parties
        </button>
        <button type="button" className="lien" onClick={() => void avecOrga('stats')}>
          <i className="fa-solid fa-chart-column" aria-hidden="true" /> Statistiques de toutes les parties
        </button>
      </div>

      {vue.quoi === 'toutes' && toutes && (
        <div className="panel-card">
          <div className="section-head">
            <h3>
              <i className="fa-solid fa-server" aria-hidden="true" /> Toutes les parties ({toutes.length})
            </h3>
            <button type="button" className="lien" onClick={retour}>
              Fermer
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tableau-simple">
              <thead>
                <tr>
                  <th>Partie</th>
                  <th>Code</th>
                  <th>Créée le</th>
                  <th>État</th>
                  <th>Joueurs</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {toutes.map((t) => {
                  const ici = liste.find((s) => s.partieId === t.id);
                  return (
                    <tr key={t.id}>
                      <td>{t.nom}</td>
                      <td>
                        <code>{t.id}</code>
                      </td>
                      <td>{new Date(t.creeLe).toLocaleDateString('fr-FR')}</td>
                      <td>{libelleEtat(t.etat)}</td>
                      <td>{t.joueurs}</td>
                      <td>
                        <button type="button" className="lien" onClick={() => (ici ? ouvrir(ici) : setVue({ quoi: 'code', partie: t.id }))}>
                          {ici ? 'Ouvrir' : 'Se connecter'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {liste.map((s) => {
        const p = infos[s.partieId];
        const etat = p === undefined ? 'Chargement…' : p ? libelleEtat(p.etat) : 'Introuvable';
        const gm = s.role === 'gm';
        const finie = p?.etat === 'terminee';
        return (
          <div key={s.partieId} className={`panel-card partie-ligne${finie ? ' finie' : ''}`}>
            <div className="partie-ligne__haut">
              <div className="partie-ligne__nom">
                <h3>{p?.nom ?? s.partieId}</h3>
                <p>
                  <span style={{ color: (p && COULEURS[p.etat]) || 'var(--cyan)' }}>
                    ● {etat}
                    {p && !finie && p.inscriptionsOuvertes ? ' · inscriptions ouvertes' : ''}
                  </span>
                  <span>
                    {gm ? 'Game Master' : 'PNJ'} · {s.nom}
                  </span>
                </p>
              </div>
              <code className="partie-ligne__code" title="Code de la partie">
                {s.partieId}
              </code>
            </div>
            {aOublier === s.partieId ? (
              <div className="pile">
                <p>
                  Se déconnecter de <strong>{p?.nom ?? s.partieId}</strong> sur cet appareil ? Pour y revenir, il faudra retaper ton code. La partie elle-même
                  n’est pas touchée.
                </p>
                <div className="modal-actions">
                  <button type="button" className="modal-btn modal-btn--ghost" onClick={() => setAOublier(null)}>
                    Annuler
                  </button>
                  <button type="button" className="modal-btn modal-btn--danger" onClick={() => oublier(s.partieId)}>
                    Se déconnecter
                  </button>
                </div>
              </div>
            ) : (
              <div className="partie-ligne__actions">
                {p !== null && (
                  <button type="button" className={`modal-btn ${finie ? 'modal-btn--ghost' : 'modal-btn--primary'}`} onClick={() => ouvrir(s)}>
                    <i className="fa-solid fa-door-open" aria-hidden="true" /> {finie ? 'Voir le bilan' : 'Ouvrir'}
                  </button>
                )}
                {gm && p && finie && (
                  <button
                    type="button"
                    className="modal-btn modal-btn--primary"
                    onClick={() =>
                      setVue({
                        quoi: 'creer',
                        depuis: { id: s.partieId, nom: p.nom, gm: s.nom },
                      })
                    }
                  >
                    <i className="fa-solid fa-rotate-right" aria-hidden="true" /> Rejouer
                  </button>
                )}
                {p && !finie && (
                  <button type="button" className="modal-btn modal-btn--ghost" onClick={() => setOuverte((o) => (o === s.partieId ? null : s.partieId))}>
                    <i className="fa-solid fa-qrcode" aria-hidden="true" /> {ouverte === s.partieId ? 'Masquer les accès' : 'Codes et QR'}
                  </button>
                )}
                <button type="button" className="modal-btn modal-btn--ghost danger" onClick={() => setAOublier(s.partieId)}>
                  <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" /> Se déconnecter
                </button>
              </div>
            )}
            {ouverte === s.partieId && p && <Acces partieId={s.partieId} />}
          </div>
        );
      })}
      <p className="vide">Seules les parties où tu t’es connecté sur cet appareil apparaissent ici.</p>
    </div>
  );
}
