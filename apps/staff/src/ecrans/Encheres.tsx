// Enchères d'Antokiba (RG-11.4) : le PNJ met une carte du catalogue en vente (3 min), suit les offres en direct et
// clôt les ventes terminées. Le GM peut aussi vendre une carte de Maître du jeu libre (RG-8.16).
import { useEffect, useState } from 'react';
import { ApiError } from '../lib/api';
import { api } from '../lib/client';
import { chercherCartes, formatRebours, numeroCarte } from '../lib/format';
import type { Equipe } from '../lib/useEquipe';

interface Lot {
  id: string;
  carte: { nom: string; numero: number | null; rang: string | null; gm?: string };
  resteMs: number;
  prixDepart: number;
  meilleureOffre: { montant: number; pseudo: string } | null;
}

export function Encheres({ eq }: { eq: Equipe }) {
  const base = `/parties/${eq.session!.partieId}`;
  const [lots, setLots] = useState<{ lot: Lot; lu: number }[]>([]);
  const [q, setQ] = useState('');
  const [choix, setChoix] = useState<string>('');
  const [prix, setPrix] = useState(10);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [, tic] = useState(0);

  const charger = () => api.get<{ encheres: Lot[] }>(`${base}/encheres`).then((r) => setLots(r.encheres.map((lot) => ({ lot, lu: Date.now() }))), () => {});
  useEffect(() => void charger(), [base, eq.version.enchere, eq.version.enchere_close]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(() => tic((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  async function faire(p: Promise<string>) {
    try {
      setMessage({ ok: true, texte: await p });
    } catch (e) {
      setMessage({ ok: false, texte: e instanceof ApiError ? e.message : 'Action impossible' });
    }
    void charger();
  }

  const gm = eq.session!.role === 'gm';
  const cartes = chercherCartes(eq.catalogue, q).slice(0, 30);
  const ouvrir = () => {
    const corps = choix.startsWith('gm:') ? { carteGm: choix.slice(3), prixDepart: prix } : { carteId: choix, prixDepart: prix };
    void faire(api.post(`${base}/encheres`, corps).then(() => 'Vente ouverte pour 3 minutes.'));
    setChoix('');
  };

  return (
    <section className="pile">
      <div className="carte">
        <h2>Mettre une carte en vente</h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher : numéro ou nom" autoCapitalize="off" />
        <select value={choix} onChange={(e) => setChoix(e.target.value)}>
          <option value="">Choisir la carte…</option>
          {gm && <option value="gm:jarvis">Carte de Maître du jeu : Jarvis tout-puissant</option>}
          {gm && <option value="gm:ange">Carte de Maître du jeu : Le Sceau d’Ange</option>}
          {cartes.map((c) => (
            <option key={c.id} value={c.id}>
              {numeroCarte(c.numero)} {c.nom} ({c.rang})
            </option>
          ))}
        </select>
        <label>
          Prix de départ (J)
          <input type="number" min={1} value={prix} onChange={(e) => setPrix(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
        </label>
        <button type="button" disabled={!choix} onClick={ouvrir}>
          Ouvrir la vente (3 min)
        </button>
        {message && <p className={message.ok ? 'ok' : 'erreur'}>{message.texte}</p>}
      </div>
      <h2>Ventes en cours</h2>
      {lots.length === 0 && <p className="info">Aucune vente en cours.</p>}
      <ul className="fil">
        {lots.map(({ lot, lu }) => {
          const reste = lot.resteMs - (Date.now() - lu);
          return (
            <li key={lot.id}>
              <strong>
                {lot.carte.numero !== null ? `${numeroCarte(lot.carte.numero)} ` : ''}
                {lot.carte.nom}
              </strong>{' '}
              <span className="quand">· {reste > 0 ? formatRebours(reste) : 'terminée'}</span>
              <p className="detail">{lot.meilleureOffre ? `Meilleure offre : ${lot.meilleureOffre.montant} J par ${lot.meilleureOffre.pseudo}` : `Pas encore d’offre (départ ${lot.prixDepart} J)`}</p>
            </li>
          );
        })}
      </ul>
      <button type="button" className="secondaire" onClick={() => void faire(api.post(`${base}/encheres/cloturer`).then(() => 'Ventes terminées closes.'))}>
        Clore les ventes terminées
      </button>
    </section>
  );
}
