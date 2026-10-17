// Connexion de l'équipe par code (RG-3) : le GM crée les codes des PNJ.
import { useState } from 'react';
import { ApiError } from '../lib/api';

export function Connexion({ partieUrl, connecter, creer }: { partieUrl: string | null; connecter: (partieId: string, code: string) => Promise<void>; creer: () => void }) {
  const [partie, setPartie] = useState(partieUrl ?? '');
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
          await connecter(partie.trim(), code);
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
      <p className="info">Arbitres (PNJ) et Game Masters : connecte-toi avec ton code.</p>
      {!partieUrl && (
        <label>
          Partie
          <input value={partie} onChange={(e) => setPartie(e.target.value)} placeholder="Identifiant de la partie" autoCapitalize="off" />
        </label>
      )}
      <label>
        Code
        <input type="password" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="current-password" />
      </label>
      {erreur && <p className="erreur">{erreur}</p>}
      <button type="submit" className="modal-btn modal-btn--primary" disabled={envoi || !partie.trim() || code.length < 4}>
        {envoi ? 'Connexion…' : 'Se connecter'}
      </button>
      <button type="button" className="lien" onClick={creer}>
        Organisateur : créer une nouvelle partie
      </button>
    </form>
  );
}
