// Connexion de l'équipe par code (RG-3) : le GM crée les codes des PNJ. Le code de la partie reste modifiable, même
// arrivé par un lien `?partie=` (sinon on reste coincé sur l'ancienne partie).
import { codePartie } from '@gq/shared';
import { useState } from 'react';
import { ApiError } from '../lib/api';

export function Connexion({
  partieInitiale,
  connecter,
  creer,
  retour,
}: {
  partieInitiale: string;
  connecter: (partieId: string, code: string) => Promise<void>;
  creer: () => void;
  retour?: (() => void) | undefined;
}) {
  const [partie, setPartie] = useState(partieInitiale);
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
          await connecter(codePartie(partie), code);
        } catch (err) {
          setErreur(err instanceof ApiError ? err.message : 'Connexion impossible');
        } finally {
          setEnvoi(false);
        }
      }}
    >
      <div className="modal-box__head">
        <h3>
          <i className="fa-solid fa-hexagon-nodes" aria-hidden="true" /> GREED ISLAND · Équipe
        </h3>
      </div>
      <p className="info">Arbitres (PNJ) et Game Masters : connecte-toi à une partie avec ton code.</p>
      <label>
        Code de la partie
        <input value={partie} onChange={(e) => setPartie(e.target.value)} placeholder="Ex. KX7P2M" autoCapitalize="characters" autoComplete="off" />
      </label>
      <label>
        Ton code (GM ou PNJ)
        <input type="password" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="current-password" />
      </label>
      {erreur && <p className="erreur">{erreur}</p>}
      <button type="submit" className="modal-btn modal-btn--primary" disabled={envoi || !partie.trim() || code.length < 4}>
        {envoi ? 'Connexion…' : 'Se connecter'}
      </button>
      <button type="button" className="lien" onClick={creer}>
        Organisateur : créer une nouvelle partie
      </button>
      {retour && (
        <button type="button" className="lien" onClick={retour}>
          ← Mes parties
        </button>
      )}
    </form>
  );
}
