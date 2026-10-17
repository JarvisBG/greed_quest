// Page Joueurs, comme celle d'Otaku Quest : recherche et filtre, tableau, et la fiche du joueur dans une fenêtre
// (sanctions, expertise ; corrections pour le GM). Jamais de position (RG-10.12).
import { useState } from 'react';
import { libelleNen, libelleStatut, type JoueurVue } from '../lib/format';
import type { Equipe } from '../lib/useEquipe';
import { Joueur, type Cible } from './Joueur';
import { Modal } from './Modal';

const PILLS: Record<string, string> = { actif: 'online', gele: 'gele', inactif: 'offline', disqualifie: 'ko', abandon: 'ko' };

export function Joueurs({ eq, cible, setCible }: { eq: Equipe; cible: Cible | null; setCible: (c: Cible | null) => void }) {
  const [q, setQ] = useState('');
  const [statut, setStatut] = useState('');
  const liste = eq.joueurs.filter((j) => j.pseudo.toLowerCase().includes(q.trim().toLowerCase()) && (!statut || j.statut === statut));
  const ouvert = cible ? (eq.joueurs.find((j) => j.id === cible.joueurId) ?? cible.vue) : undefined;

  return (
    <div className="page">
      <div className="toolbar">
        <div className="search-wrap">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un pseudo…" autoComplete="off" />
        </div>
        <select className="filter-select" value={statut} onChange={(e) => setStatut(e.target.value)}>
          <option value="">Tous les statuts</option>
          {['actif', 'gele', 'inactif', 'abandon', 'disqualifie'].map((s) => (
            <option key={s} value={s}>
              {libelleStatut(s as JoueurVue['statut'])}
            </option>
          ))}
        </select>
      </div>
      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Joueur</th>
                <th>Nen</th>
                <th>Statut</th>
                <th>Jenny</th>
                <th>Clear</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {liste.map((j) => (
                <tr key={j.id} className="cliquable" onClick={() => setCible({ joueurId: j.id })}>
                  <td>
                    <div className="player-cell">
                      <div className="player-cell__avatar">{j.pseudo.charAt(0).toUpperCase()}</div>
                      <div className="player-cell__name">{j.pseudo}</div>
                    </div>
                  </td>
                  <td>{libelleNen(j.nen)}</td>
                  <td>
                    <span className={`status-pill ${PILLS[j.statut] ?? 'offline'}`}>
                      <span className="dot" /> {libelleStatut(j.statut)}
                    </span>
                  </td>
                  <td>{j.jenny ?? '—'} J</td>
                  <td>{j.livreGele ? <span className="rank-pill">Clear annoncé</span> : ''}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="view" aria-label={`Voir ${j.pseudo}`}>
                        <i className="fa-solid fa-eye" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-foot">
          <span>
            {liste.length} joueur{liste.length > 1 ? 's' : ''} affiché{liste.length > 1 ? 's' : ''} sur {eq.joueurs.length}
          </span>
        </div>
      </div>
      {cible && ouvert && (
        <Modal titre="Profil joueur" icone="fa-id-card" large onFermer={() => setCible(null)}>
          <Joueur eq={eq} cible={cible} setCible={setCible} />
        </Modal>
      )}
    </div>
  );
}
