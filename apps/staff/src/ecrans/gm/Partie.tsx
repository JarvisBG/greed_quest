// Tableau de bord du GM (RG-4) : les actions possibles selon l'état de la partie, confirmées en deux temps, et les
// chiffres utiles (joueurs, J, Clear en attente, alertes). Un refus du serveur (catalogue incomplet…) s'affiche tel quel.
import { useState } from 'react';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/client';
import { libelleEtat } from '../../lib/format';
import type { Equipe } from '../../lib/useEquipe';

type ActionCycle = 'ouvrir_inscriptions' | 'demarrer' | 'pause' | 'reprendre' | 'phase_finale' | 'terminer' | 'fermer_inscriptions';

const LIBELLES: Record<ActionCycle, string> = {
  ouvrir_inscriptions: 'Ouvrir les inscriptions',
  fermer_inscriptions: 'Fermer les inscriptions',
  demarrer: 'Démarrer la partie',
  pause: 'Mettre en pause',
  reprendre: 'Reprendre la partie',
  phase_finale: 'Lancer la phase finale',
  terminer: 'Terminer la partie',
};

/** Actions proposées pour chaque état (le serveur revérifie). */
export function actionsPossibles(etat: string, inscriptionsOuvertes: boolean): ActionCycle[] {
  const inscr: ActionCycle[] = inscriptionsOuvertes ? ['fermer_inscriptions'] : ['ouvrir_inscriptions'];
  switch (etat) {
    case 'brouillon':
      return ['ouvrir_inscriptions', 'demarrer'];
    case 'inscriptions':
      return ['demarrer', 'fermer_inscriptions'];
    case 'en_cours':
      return ['pause', 'phase_finale', ...inscr, 'terminer'];
    case 'pause':
      return ['reprendre', 'terminer'];
    case 'phase_finale':
      return ['pause', 'terminer'];
    default:
      return [];
  }
}

export function Partie({ eq }: { eq: Equipe }) {
  const base = `/parties/${eq.session!.partieId}`;
  const [choisie, setChoisie] = useState<ActionCycle | null>(null);
  const [motif, setMotif] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const p = eq.partie;
  if (!p) return <p className="info">Chargement…</p>;

  const actifs = eq.joueurs.filter((j) => j.statut === 'actif').length;
  const clears = eq.joueurs.filter((j) => j.livreGele).length;

  async function confirmer() {
    if (!choisie) return;
    setEnvoi(true);
    try {
      await api.post(`${base}/cycle`, { action: choisie, ...(motif.trim() ? { motif: motif.trim() } : {}) });
      setMessage({ ok: true, texte: `C’est fait : ${LIBELLES[choisie].toLowerCase()}.` });
      setChoisie(null);
      setMotif('');
    } catch (e) {
      setMessage({ ok: false, texte: e instanceof ApiError ? e.message : 'Action impossible' });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <section className="pile">
      <h1>Partie</h1>
      <div className="carte">
        <p>
          État : <strong>{libelleEtat(p.etat)}</strong>
          {p.inscriptionsOuvertes ? ' · inscriptions ouvertes' : ' · inscriptions fermées'}
        </p>
        <p>
          {eq.joueurs.length} inscrits · {actifs} actifs{eq.j !== null ? ` · J = ${eq.j}` : ''}
        </p>
        {clears > 0 && <p className="ok">{clears} Clear en attente : voir l’onglet Clear.</p>}
        <p className="info">{eq.alertes.length} alerte{eq.alertes.length > 1 ? 's' : ''} au total (onglet Alertes).</p>
      </div>

      <div className="carte">
        <h2>Que faire ?</h2>
        {choisie ? (
          <>
            <p>
              Confirmer : <strong>{LIBELLES[choisie]}</strong> ?
            </p>
            <label>
              Motif (facultatif, noté dans le journal)
              <input value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={200} />
            </label>
            <button type="button" disabled={envoi} onClick={() => void confirmer()}>
              {envoi ? 'Envoi…' : `Oui, ${LIBELLES[choisie].toLowerCase()}`}
            </button>
            <button type="button" className="secondaire" onClick={() => setChoisie(null)}>
              Revenir
            </button>
          </>
        ) : (
          <div className="choix">
            {actionsPossibles(p.etat, p.inscriptionsOuvertes).map((a) => (
              <button key={a} type="button" className={a === 'terminer' ? 'secondaire danger' : 'secondaire'} onClick={() => (setMessage(null), setChoisie(a))}>
                {LIBELLES[a]}
              </button>
            ))}
            {p.etat === 'terminee' && <p className="info">La partie est terminée : classement final dans l’onglet Clear.</p>}
          </div>
        )}
        {message && <p className={message.ok ? 'ok' : 'erreur'}>{message.texte}</p>}
      </div>
    </section>
  );
}
