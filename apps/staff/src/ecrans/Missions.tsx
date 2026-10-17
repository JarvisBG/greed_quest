// Missions secrètes (RG-12) : le joueur montre sa preuve au PNJ, qui valide ; rien n'est envoyé au serveur.
import { useEffect, useState } from 'react';
import { ApiError } from '../lib/api';
import { api } from '../lib/client';
import { formatRebours } from '../lib/format';
import type { Equipe } from '../lib/useEquipe';

interface Mission {
  id: string;
  type: string;
  resteMs: number;
  data?: { joueurId: string; objectif: string; recompenseJenny: number };
}

export function Missions({ eq }: { eq: Equipe }) {
  const base = `/parties/${eq.session!.partieId}`;
  const [missions, setMissions] = useState<Mission[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  const charger = () =>
    api.get<{ evenements: Mission[] }>(`${base}/evenements`).then((r) => setMissions(r.evenements.filter((e) => e.type === 'mission_secrete' && e.data)), () => {});
  useEffect(() => void charger(), [base, eq.version.evenement, eq.version.evenement_fin]); // eslint-disable-line react-hooks/exhaustive-deps

  async function valider(m: Mission, pseudo: string) {
    try {
      const r = await api.post<{ jenny: number }>(`${base}/evenements/${m.id}/valider`);
      setMessage({ ok: true, texte: `Mission validée : ${pseudo} reçoit ${r.jenny} J.` });
    } catch (e) {
      setMessage({ ok: false, texte: e instanceof ApiError ? e.message : 'Validation impossible' });
    }
    void charger();
  }

  return (
    <section className="pile">
      <p className="info">Le joueur te montre la preuve (photo, objet…) : si c’est bon, valide.</p>
      {message && <p className={message.ok ? 'ok' : 'erreur'}>{message.texte}</p>}
      {missions.length === 0 && <p className="info">Aucune mission secrète en cours.</p>}
      <ul className="fil">
        {missions.map((m) => {
          const pseudo = eq.pseudos.get(m.data!.joueurId) ?? 'Un joueur';
          return (
            <li key={m.id} className="pile">
              <strong>
                {pseudo} <span className="quand">· reste {formatRebours(m.resteMs)}</span>
              </strong>
              <p className="detail">
                {m.data!.objectif} · récompense {m.data!.recompenseJenny} J
              </p>
              <button type="button" onClick={() => void valider(m, pseudo)}>
                Preuve vue : valider
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
