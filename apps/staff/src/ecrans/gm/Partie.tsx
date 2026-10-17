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
    <div>
      <p className="info" style={{ marginBottom: 12 }}>
        Partie : <strong>{libelleEtat(p.etat)}</strong>
        {p.inscriptionsOuvertes ? ' · inscriptions ouvertes' : ' · inscriptions fermées'}
      </p>
      {choisie ? (
        <div className="pile">
          <p>
            Confirmer : <strong>{LIBELLES[choisie]}</strong> ?
          </p>
          <label>
            Motif (facultatif, noté dans le journal)
            <input value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={200} />
          </label>
          <div className="modal-actions">
            <button type="button" className="modal-btn modal-btn--ghost" onClick={() => setChoisie(null)}>
              Annuler
            </button>
            <button type="button" className={`modal-btn ${choisie === 'terminer' ? 'modal-btn--danger' : 'modal-btn--primary'}`} disabled={envoi} onClick={() => void confirmer()}>
              {envoi ? 'Envoi…' : 'Confirmer'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {actionsPossibles(p.etat, p.inscriptionsOuvertes).map((a) => (
            <button key={a} type="button" className={`modal-btn ${a === 'terminer' ? 'modal-btn--danger' : 'modal-btn--ghost'}`} style={{ flex: '0 1 auto' }} onClick={() => (setMessage(null), setChoisie(a))}>
              {LIBELLES[a]}
            </button>
          ))}
          {p.etat === 'terminee' && <p className="info">La partie est terminée : classement final dans la page Clear.</p>}
        </div>
      )}
      {message && <p className={`msg ${message.ok ? 'ok' : 'ko'}`} style={{ marginTop: 10 }}>{message.texte}</p>}
      <p className="vide" style={{ marginTop: 12 }}>Le changement est envoyé tout de suite à tous les téléphones et à l’écran géant.</p>
    </div>
  );
}
