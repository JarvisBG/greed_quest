// Page ⑱ : après l'abandon (RG-5.7), le joueur suit la partie en spectateur jusqu'au classement final : bandeau gris
// sous la barre, accueil réduit à son Book figé (consultable) et aux annonces de l'île.
import { FREE_SLOTS } from '@gq/engine';
import { useLivre } from '../../lib/useLivre';
import type { Notif } from '../../lib/useJeu';

export function BandeauSpectateur() {
  return (
    <div className="fp-bandeau" role="status">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <span>
        <b>Tu as quitté la partie.</b> Tu la suis jusqu’à la fin et tu restes classé.
      </span>
    </div>
  );
}

const heure = (t: number) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export function Spectateur({ partieId, version, jenny, notifs, onBook }: { partieId: string; version: number; jenny: number; notifs: Notif[]; onBook: () => void }) {
  const { livre } = useLivre(partieId, version);
  return (
    <div className="planche">
      <div className="tete-page">
        <h1 className="titre-ecran">Accueil</h1>
      </div>
      <section className="gi-case fp-spect">
        <h2>Ton Book au moment de partir</h2>
        <div className="fp-fige">
          <div>
            <b>{livre ? `${livre.cartesDesignees}/${livre.total}` : '…'}</b>
            <span>désignées</span>
          </div>
          <div>
            <b>{jenny}</b>
            <span>jenny</span>
          </div>
          <div>
            <b>{livre ? `${livre.libresUtilises}/${FREE_SLOTS}` : '…'}</b>
            <span>places libres prises</span>
          </div>
        </div>
        <p className="doux">Ton Book reste consultable, mais plus rien n’y bouge : pas de scan, de sort, d’échange ni d’achat.</p>
        <button className="gi-btn-trait" onClick={onBook}>
          Ouvrir mon Book
        </button>
      </section>
      <section className="gi-case fp-spect">
        <h2>Annonces de l’île</h2>
        {notifs.length === 0 ? (
          <p className="doux">Rien pour l’instant. Les annonces de la partie s’afficheront ici.</p>
        ) : (
          <ul className="fp-fil">
            {notifs.map((n) => (
              <li key={n.n}>
                <time>{heure(n.recuA)}</time>
                <span>{n.texte}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
