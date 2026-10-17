// Paramètres et préréglages (RG-14), GM seulement : pour chaque paramètre, valeur auto (selon J), mode et valeur
// appliquée (RG-14.6) ; réglage Auto / Valeur fixe / Multiplicateur (RG-14.2), sans effet rétroactif (RG-14.3) ;
// préréglages système et du GM, appliqués après confirmation, ou créés depuis les réglages actuels (RG-14.5).
import type { ParamKey, ParamSetting, ResolvedParam } from '@gq/engine';
import { useEffect, useState } from 'react';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/client';
import type { Equipe } from '../../lib/useEquipe';
import { Modal } from '../Modal';

interface Def {
  nom: string;
  unite: string;
  aide: string;
}
// Libellés en clair (pas d'identifiant de règle à l'écran).
const DEFS: Record<ParamKey, Def> = {
  dureePartieMin: { nom: 'Durée de la partie', unite: 'min', aide: 'Temps de jeu total (le chrono s’arrête en pause).' },
  cartesDesignees: { nom: 'Cartes désignées (N)', unite: 'cartes', aide: 'Nombre de cartes à réunir dans le Book. Se fixe avant le démarrage.' },
  kitJenny: { nom: 'Jenny du kit de départ', unite: 'J', aide: 'Jenny donnés à chaque joueur à l’inscription.' },
  bonusExamenJ: { nom: 'Bonus de l’Examen', unite: 'J', aide: 'Jenny gagnés en réussissant l’Examen d’entrée.' },
  specialisationPct: { nom: 'Chance de Spécialisation', unite: '%', aide: 'Chance d’obtenir le Nen Spécialisation au test.' },
  rattrapageJParMin: { nom: 'Rattrapage', unite: 'J/min', aide: 'Jenny par minute donnés aux joueurs à 0 carte. 0 = désactivé.' },
  balisesActives: { nom: 'Balises actives', unite: 'balises', aide: 'Balises allumées en même temps (jamais plus que les balises posées).' },
  stockBalise: { nom: 'Stock par balise', unite: 'tirages', aide: 'Tirages possibles sur une balise avant qu’elle s’épuise.' },
  partRaresPct: { nom: 'Part de balises rares', unite: '%', aide: 'Chance qu’une balise activée soit rare.' },
  kBoucle: { nom: 'Boucle', unite: 'balises', aide: 'Balises différentes à scanner avant de revenir sur la même.' },
  objetsReplisPct: { nom: 'Objet sur carte épuisée', unite: '%', aide: 'Chance de recevoir un objet en plus des jenny quand la carte tirée est épuisée.' },
  chanceCarteGmPct: { nom: 'Carte de Maître du jeu au scan', unite: '%', aide: 'Chance, à chaque scan, qu’une carte de Maître du jeu encore libre tombe.' },
  limiteSS: { nom: 'Exemplaires SS', unite: 'ex.', aide: 'Nombre maximal d’exemplaires de la carte SS en jeu.' },
  limiteS: { nom: 'Exemplaires S', unite: 'ex.', aide: 'Exemplaires maximum par carte de rang S.' },
  limiteA: { nom: 'Exemplaires A', unite: 'ex.', aide: 'Exemplaires maximum par carte de rang A.' },
  limiteB: { nom: 'Exemplaires B', unite: 'ex.', aide: 'Exemplaires maximum par carte de rang B.' },
  limiteCD: { nom: 'Exemplaires C et D', unite: 'ex.', aide: 'Exemplaires maximum par carte de rang C ou D.' },
  porteeSortsM: { nom: 'Portée des sorts', unite: 'm', aide: 'Distance maximale entre le lanceur et sa cible. À adapter au lieu.' },
  margeGpsMaxM: { nom: 'Marge GPS acceptée', unite: 'm', aide: 'Au-delà de cette imprécision, la position du joueur est refusée.' },
  ciblableMin: { nom: 'Ciblable sans position', unite: 'min', aide: 'Temps pendant lequel un joueur sans nouvelle position reste ciblable ; ensuite, alerte.' },
  coffreMin: { nom: 'Durée du Coffre', unite: 'min', aide: 'Temps pendant lequel le Coffre protège une carte.' },
  zetsuMin: { nom: 'Durée du Zetsu', unite: 'min', aide: 'Temps d’invisibilité du Zetsu.' },
  retourMin: { nom: 'Durée du Retour', unite: 'min', aide: 'Temps de la visite à distance d’une ville déjà visitée.' },
  rechargeRenforcementMin: { nom: 'Recharge Renforcement', unite: 'min', aide: 'Délai avant de réutiliser le pouvoir de Renforcement.' },
  rechargeEmissionMin: { nom: 'Recharge Émission', unite: 'min', aide: 'Délai avant de réutiliser le pouvoir d’Émission.' },
  rechargeManipulationMin: { nom: 'Recharge Manipulation', unite: 'min', aide: 'Délai avant de réutiliser le pouvoir de Manipulation.' },
  reserveMaterialisationMin: { nom: 'Réserve Matérialisation', unite: 'min', aide: 'Intervalle du tirage bonus de réserve de la Matérialisation.' },
  rechargeSpeMin: { nom: 'Recharge Spécialisation', unite: 'min', aide: 'Délai avant de réutiliser un pouvoir de Spécialisation.' },
  paquetsParVague: { nom: 'Paquets par vague', unite: 'paquets', aide: 'Paquets de sorts en vente à Masadora toutes les 20 min.' },
  pvBoss: { nom: 'PV du boss de raid', unite: 'PV', aide: 'Points de vie du boss au lancement d’un raid.' },
  agendaIntervalleMin: { nom: 'Agenda automatique', unite: 'min', aide: 'Une proposition d’évènement toutes les N minutes. 0 = désactivé.' },
  areneMiseJ: { nom: 'Mise de l’arène', unite: 'J', aide: 'Jenny à payer pour entrer dans l’arène de Soufrabi.' },
  areneDelaiMin: { nom: 'Délai entre deux combats', unite: 'min', aide: 'Temps d’attente d’un joueur entre deux tentatives à l’arène.' },
};
const GROUPES: { titre: string; icone: string; cles: ParamKey[] }[] = [
  { titre: 'Partie', icone: 'fa-hourglass-half', cles: ['dureePartieMin', 'cartesDesignees', 'kitJenny', 'bonusExamenJ', 'specialisationPct', 'rattrapageJParMin'] },
  { titre: 'Balises et tirages', icone: 'fa-tower-broadcast', cles: ['balisesActives', 'stockBalise', 'partRaresPct', 'kBoucle', 'objetsReplisPct', 'chanceCarteGmPct'] },
  { titre: 'Exemplaires en jeu', icone: 'fa-layer-group', cles: ['limiteSS', 'limiteS', 'limiteA', 'limiteB', 'limiteCD'] },
  { titre: 'Sorts et terrain', icone: 'fa-wand-magic-sparkles', cles: ['porteeSortsM', 'margeGpsMaxM', 'ciblableMin', 'coffreMin', 'zetsuMin', 'retourMin'] },
  { titre: 'Pouvoirs de Nen', icone: 'fa-fire', cles: ['rechargeRenforcementMin', 'rechargeEmissionMin', 'rechargeManipulationMin', 'reserveMaterialisationMin', 'rechargeSpeMin'] },
  { titre: 'Lieux et évènements', icone: 'fa-bolt', cles: ['paquetsParVague', 'pvBoss', 'agendaIntervalleMin', 'areneMiseJ', 'areneDelaiMin'] },
];
const MODES: Record<ParamSetting['mode'], string> = { auto: 'Auto', verrouille: 'Valeur fixe', multiplicateur: 'Multiplicateur' };

interface Prereglage {
  id: string;
  nom: string;
  description: string;
  systeme: boolean;
}

const nombre = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const libelleMode = (s: ParamSetting) => (s.mode === 'multiplicateur' ? `× ${nombre(s.coef)}` : MODES[s.mode]);

export function Parametres({ eq }: { eq: Equipe }) {
  const base = `/parties/${eq.session!.partieId}`;
  const [params, setParams] = useState<ResolvedParam[]>([]);
  const [prereglages, setPrereglages] = useState<Prereglage[]>([]);
  const [edite, setEdite] = useState<ResolvedParam | null>(null);
  const [aAppliquer, setAAppliquer] = useState<Prereglage | null>(null);
  const [creation, setCreation] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const demarree = eq.partie ? !['brouillon', 'inscriptions'].includes(eq.partie.etat) : false;

  const charger = () => api.get<{ parametres: ResolvedParam[] }>(`${base}/parametres`).then((r) => setParams(r.parametres), () => {});
  const chargerPrereglages = () => api.get<{ prereglages: Prereglage[] }>(`${base}/prereglages`).then((r) => setPrereglages(r.prereglages), () => {});
  useEffect(() => void charger(), [base, eq.version.parametre, eq.version.j]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => void chargerPrereglages(), [base]); // eslint-disable-line react-hooks/exhaustive-deps

  const parCle = new Map(params.map((p) => [p.key, p]));

  async function appliquer(p: Prereglage) {
    try {
      await api.post(`${base}/prereglages/appliquer`, { id: p.id });
      setMessage({ ok: true, texte: `Préréglage « ${p.nom} » appliqué.` });
    } catch (e) {
      setMessage({ ok: false, texte: e instanceof ApiError ? e.message : 'Application impossible' });
    }
    setAAppliquer(null);
    void charger();
  }

  return (
    <div className="page">
      <div className="panel-card">
        <div className="section-head">
          <h3>
            <i className="fa-solid fa-sliders" aria-hidden="true" /> Préréglages
          </h3>
        </div>
        <p className="info">Un préréglage remplace tous les réglages ci-dessous. Les changements ne valent que pour la suite (rien n’est recalculé en arrière).</p>
        <div className="actions-liste">
          {prereglages.map((p) => (
            <button key={p.id} type="button" className="modal-btn modal-btn--ghost" onClick={() => setAAppliquer(p)}>
              <i className={`fa-solid ${p.systeme ? 'fa-box' : 'fa-user-pen'}`} aria-hidden="true" />
              <span>
                <strong>{p.nom}</strong>
                {p.description && <span className="vide"> · {p.description}</span>}
              </span>
            </button>
          ))}
          <button type="button" className="modal-btn modal-btn--primary" onClick={() => setCreation(true)}>
            <i className="fa-solid fa-floppy-disk" aria-hidden="true" /> Enregistrer les réglages actuels comme préréglage
          </button>
        </div>
        {message && <p className={`msg ${message.ok ? 'ok' : 'ko'}`}>{message.texte}</p>}
      </div>

      {GROUPES.map((g) => (
        <div key={g.titre} className="table-card">
          <div className="section-head" style={{ padding: '16px 18px 0' }}>
            <h3>
              <i className={`fa-solid ${g.icone}`} aria-hidden="true" /> {g.titre}
            </h3>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Paramètre</th>
                  <th>Auto</th>
                  <th>Réglage</th>
                  <th>Appliqué</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {g.cles.map((k) => {
                  const p = parCle.get(k);
                  const d = DEFS[k];
                  const fige = k === 'cartesDesignees' && demarree;
                  return (
                    <tr key={k} className={p && !fige ? 'cliquable' : ''} onClick={() => p && !fige && setEdite(p)}>
                      <td>
                        <div className="player-cell__name">{d.nom}</div>
                        <div className="vide">{d.aide}</div>
                      </td>
                      <td>{p ? `${nombre(p.auto)} ${d.unite}` : '—'}</td>
                      <td>{p ? <span className={`status-pill ${p.setting.mode === 'auto' ? 'online' : 'gele'}`}>{libelleMode(p.setting)}</span> : '—'}</td>
                      <td>
                        <strong>{p ? `${nombre(p.applied)} ${d.unite}` : '—'}</strong>
                      </td>
                      <td>
                        <div className="row-actions">
                          {fige ? (
                            <span className="vide">Figé</span>
                          ) : (
                            <button type="button" className="view" aria-label={`Régler ${d.nom}`}>
                              <i className="fa-solid fa-pen" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {edite && <Reglage base={base} p={edite} fermer={() => (setEdite(null), void charger())} />}
      {aAppliquer && (
        <Modal titre="Appliquer un préréglage" icone="fa-sliders" onFermer={() => setAAppliquer(null)}>
          <div className="delete-warning">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
            <p>
              Tous les réglages seront remplacés par ceux de « {aAppliquer.nom} ». Les balises, les stocks et les recharges déjà en cours ne changent pas ; seules les
              prochaines activations suivront les nouveaux réglages.
            </p>
          </div>
          <div className="segments">
            <button type="button" className="modal-btn modal-btn--ghost" onClick={() => setAAppliquer(null)}>
              Annuler
            </button>
            <button type="button" className="modal-btn modal-btn--primary" onClick={() => void appliquer(aAppliquer)}>
              Confirmer
            </button>
          </div>
        </Modal>
      )}
      {creation && <Creation base={base} fermer={(texte) => (setCreation(false), texte && setMessage({ ok: true, texte }), void chargerPrereglages())} />}
    </div>
  );
}

function Reglage({ base, p, fermer }: { base: string; p: ResolvedParam; fermer: () => void }) {
  const d = DEFS[p.key];
  const [mode, setMode] = useState<ParamSetting['mode']>(p.setting.mode);
  // Saisies gardées telles quelles (« 1, » en cours de frappe) et bornées seulement à l'usage.
  const [saisieValeur, setSaisieValeur] = useState(String(p.setting.mode === 'verrouille' ? p.setting.value : p.applied));
  const [saisieCoef, setSaisieCoef] = useState(String(p.setting.mode === 'multiplicateur' ? p.setting.coef : 1));
  const lire = (t: string) => Number(t.replace(',', '.')) || 0;
  const valeur = Math.max(0, lire(saisieValeur));
  const coef = Math.min(10, Math.max(0, lire(saisieCoef)));
  const [erreur, setErreur] = useState<string | null>(null);
  const pas = Number.isInteger(p.auto) ? 1 : 0.1;
  // Même calcul que le serveur (resolveParam) pour montrer le résultat avant d'enregistrer.
  const resultat = mode === 'auto' ? p.auto : mode === 'verrouille' ? valeur : Math.round(p.auto * coef);

  async function enregistrer() {
    const reglage: ParamSetting = mode === 'auto' ? { mode } : mode === 'verrouille' ? { mode, value: valeur } : { mode, coef };
    try {
      await api.put(`${base}/parametres`, { cle: p.key, reglage });
      fermer();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Réglage impossible');
    }
  }

  return (
    <Modal titre={d.nom} icone="fa-pen" onFermer={fermer}>
      <p className="info">{d.aide}</p>
      <p className="info">
        Valeur auto aujourd’hui (J = {p.J}) : <strong>{`${nombre(p.auto)} ${d.unite}`}</strong>
      </p>
      <div className="segments" style={{ margin: '14px 0' }}>
        {(Object.keys(MODES) as ParamSetting['mode'][]).map((m) => (
          <button key={m} type="button" className={`modal-btn modal-btn--ghost${mode === m ? ' choisi' : ''}`} onClick={() => setMode(m)}>
            {MODES[m]}
          </button>
        ))}
      </div>
      {mode === 'auto' && <p className="info">La valeur suit le nombre de joueurs actifs.</p>}
      {mode === 'verrouille' && (
        <label>
          Valeur ({d.unite})
          <input type="number" min={0} step={pas} value={saisieValeur} onChange={(e) => setSaisieValeur(e.target.value)} onBlur={() => setSaisieValeur(String(valeur))} />
        </label>
      )}
      {mode === 'multiplicateur' && (
        <label>
          Coefficient (× la valeur auto, de 0 à 10)
          <input type="number" min={0} max={10} step={0.1} value={saisieCoef} onChange={(e) => setSaisieCoef(e.target.value)} onBlur={() => setSaisieCoef(String(coef))} />
        </label>
      )}
      <p className="info" style={{ margin: '14px 0' }}>
        Valeur appliquée : <strong>{`${nombre(Math.max(0, resultat))} ${d.unite}`}</strong> (pour la suite seulement)
      </p>
      {erreur && <p className="msg ko">{erreur}</p>}
      <div className="segments">
        <button type="button" className="modal-btn modal-btn--ghost" onClick={fermer}>
          Annuler
        </button>
        <button type="button" className="modal-btn modal-btn--primary" onClick={() => void enregistrer()}>
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}

function Creation({ base, fermer }: { base: string; fermer: (texte?: string) => void }) {
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  async function creer() {
    try {
      await api.post(`${base}/prereglages`, { nom: nom.trim(), description: description.trim() });
      fermer(`Préréglage « ${nom.trim()} » enregistré.`);
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Enregistrement impossible');
    }
  }

  return (
    <Modal titre="Nouveau préréglage" icone="fa-floppy-disk" onFermer={() => fermer()}>
      <p className="info">Les réglages actuels de la partie sont gardés sous ce nom, pour les prochaines parties.</p>
      <label style={{ marginTop: 12 }}>
        Nom
        <input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={60} placeholder="Ex. Parc de la Villette" />
      </label>
      <label style={{ margin: '12px 0' }}>
        Description
        <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder="Facultatif" />
      </label>
      {erreur && <p className="msg ko">{erreur}</p>}
      <div className="segments">
        <button type="button" className="modal-btn modal-btn--ghost" onClick={() => fermer()}>
          Annuler
        </button>
        <button type="button" className="modal-btn modal-btn--primary" disabled={!nom.trim()} onClick={() => void creer()}>
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}
