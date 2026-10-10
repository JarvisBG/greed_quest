// Entrée : rejoindre une partie (code saisi, ou lien du QR d'accueil qui ouvre l'app sur `?partie=`).
import { Concentration, DosCarte } from '@gq/ui';
import { useState } from 'react';

export function Entree({ onChoix }: { onChoix: (id: string) => void }) {
  const [id, setId] = useState('');
  return (
    <div className="planche">
      <section className="gi-case entree-titre">
        <Concentration graine={11} />
        <h1>
          Greed
          <br />
          Island
        </h1>
        <DosCarte className="entree-dos" />
        <p className="recitatif">La chasse aux cartes de Hunter × Hunter, sur le terrain.</p>
      </section>
      <form
        className="gi-case"
        onSubmit={(e) => {
          e.preventDefault();
          if (id.trim()) onChoix(id.trim());
        }}
      >
        <h2 className="sous-titre">Rejoindre une partie</h2>
        <p className="doux">Scanne le QR d’accueil affiché par l’organisation, ou saisis le code de la partie.</p>
        <div className="champ-groupe">
          <label htmlFor="code-partie">Code de la partie</label>
          <input id="code-partie" className="gi-champ" value={id} onChange={(e) => setId(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        </div>
        <button type="submit" className="gi-btn-encre" disabled={!id.trim()}>
          Rejoindre
        </button>
      </form>
    </div>
  );
}
