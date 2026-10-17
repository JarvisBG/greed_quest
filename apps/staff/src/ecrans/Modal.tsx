// Fenêtre d'action, comme les « modal-box » d'Otaku Quest : titre avec icône, croix, contenu.
import type { ReactNode } from 'react';

export function Modal({ titre, icone, onFermer, large, children }: { titre: string; icone: string; onFermer: () => void; large?: boolean; children: ReactNode }) {
  return (
    <div className="modal-overlay show" onClick={(e) => e.target === e.currentTarget && onFermer()}>
      <div className={`modal-box${large ? ' large' : ''}`} role="dialog" aria-modal="true" aria-label={titre}>
        <div className="modal-box__head">
          <h3>
            <i className={`fa-solid ${icone}`} aria-hidden="true" /> {titre}
          </h3>
          <button type="button" className="modal-close" onClick={onFermer} aria-label="Fermer">
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
