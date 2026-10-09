// Accueil : profil, licence (RG-5.2), évènements en cours (RG-12 : bannières, raid), accès aux lieux
// (boutique de Masadora RG-9, enchères d'Antokiba RG-11.4), Examen reporté, options, notifications.
import { useEffect, useState } from 'react';
import { api } from '../lib/client';
import { eveilDisponible } from '../lib/eveil';
import { formatChrono, libelleEtat, NENS } from '../lib/format';
import type { Moi, Notif, Partie } from '../lib/useJeu';

export interface Evenement {
  id: string;
  type: string;
  texte: string | null;
  resteMs: number;
  pv?: number;
  pvMax?: number;
}

export type SousEcran = 'licence' | 'boutique' | 'encheres' | 'raid';

/** Évènements en cours, rechargés à chaque évènement reçu. */
export function useEvenements(partieId: string, version: number) {
  const [ev, setEv] = useState<{ liste: Evenement[]; recuA: number }>({ liste: [], recuA: 0 });
  useEffect(() => {
    if (!partieId) return;
    api.get<{ evenements: Evenement[] }>(`/parties/${partieId}/evenements`).then(
      (r) => setEv({ liste: r.evenements, recuA: Date.now() }),
      () => undefined,
    );
  }, [partieId, version]);
  return ev;
}

export function Accueil({
  partie,
  moi,
  evenements,
  notifs,
  ecranAllume,
  onEcranAllume,
  onExamen,
  onOuvrir,
}: {
  partie: Partie;
  moi: Moi;
  evenements: { liste: Evenement[]; recuA: number };
  notifs: Notif[];
  ecranAllume: boolean;
  onEcranAllume: (oui: boolean) => void;
  onExamen: () => void;
  onOuvrir: (s: SousEcran) => void;
}) {
  const [maintenant, setMaintenant] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const encours = evenements.liste.filter((e) => e.resteMs - (maintenant - evenements.recuA) > 0);
  const raid = encours.find((e) => e.type === 'raid');

  return (
    <>
      <div className="carte">
        <h1>{moi.pseudo}</h1>
        <p>
          {partie.nom} · {libelleEtat(partie.etat)}
        </p>
        {moi.nen && <p className="info">Nen : {NENS[moi.nen].nom}</p>}
        <button onClick={() => onOuvrir('licence')}>Ma licence</button>
      </div>
      {encours.length > 0 && (
        <section>
          <h2>En ce moment</h2>
          <ul className="fil">
            {encours.map((e) => (
              <li key={e.id} className="evenement">
                <span>{e.texte ?? 'Évènement en cours'}</span>
                <span className="chrono">{formatChrono(e.resteMs - (maintenant - evenements.recuA))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {raid && (
        <div className="carte raid-appel">
          <h2>Raid en cours !</h2>
          <div className="jauge vie" aria-hidden="true">
            <span style={{ width: `${raid.pvMax ? ((raid.pv ?? 0) / raid.pvMax) * 100 : 0}%` }} />
          </div>
          <button onClick={() => onOuvrir('raid')}>Combattre</button>
        </div>
      )}
      <div className="lieux">
        <button className="secondaire" onClick={() => onOuvrir('boutique')}>
          Boutique de Masadora
        </button>
        <button className="secondaire" onClick={() => onOuvrir('encheres')}>
          Enchères d’Antokiba
        </button>
      </div>
      {!moi.examenFait && (
        <div className="carte">
          <p>L’Examen Hunter t’attend : des jenny à gagner.</p>
          <button className="secondaire" onClick={onExamen}>
            Passer l’Examen
          </button>
        </div>
      )}
      {eveilDisponible() && (
        <label className="carte case">
          <input type="checkbox" checked={ecranAllume} onChange={(e) => onEcranAllume(e.target.checked)} />
          <span>
            Garder l’écran allumé
            <span className="detail info"> Ta position reste à jour, mais la batterie se vide plus vite.</span>
          </span>
        </label>
      )}
      <section>
        <h2>Notifications</h2>
        {notifs.length === 0 && <p className="info">Rien pour l'instant.</p>}
        <ul className="fil">
          {notifs.map((n) => (
            <li key={n.n}>{n.texte}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
