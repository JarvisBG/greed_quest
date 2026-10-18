// Accès à une partie, en QR et en clair : console de l'équipe (GM, PNJ), app joueur (inscription), écran géant.
// Les adresses de l'app joueur et de l'écran géant sont retenues sur l'appareil (celle de l'app joueur est partagée
// avec la Planche QR) ; en local, elles sont devinées d'après les ports de dev (5173, 5175).
import { useEffect, useState } from 'react';
import { Qr } from './gm/Planche';

const CLES = {
  joueurs: 'gq-staff-adresse-app',
  ecran: 'gq-staff-adresse-ecran',
} as const;
const PORTS = { joueurs: '5173', ecran: '5175' } as const;
type Cote = 'console' | keyof typeof CLES;

function lireAdresse(cote: keyof typeof CLES): string {
  try {
    const a = localStorage.getItem(CLES[cote]);
    if (a) return a;
  } catch {
    /* stockage indisponible */
  }
  return location.port === '5174' ? `${location.protocol}//${location.hostname}:${PORTS[cote]}` : '';
}

const ONGLETS: { id: Cote; titre: string; icone: string; aide: string }[] = [
  {
    id: 'console',
    titre: 'Équipe',
    icone: 'fa-user-shield',
    aide: 'Console sur un autre téléphone (GM, PNJ) : il ne reste qu’à taper son code.',
  },
  {
    id: 'joueurs',
    titre: 'Joueurs',
    icone: 'fa-users',
    aide: 'Les joueurs scannent ce QR pour ouvrir l’app sur cette partie et s’inscrire.',
  },
  {
    id: 'ecran',
    titre: 'Écran géant',
    icone: 'fa-tv',
    aide: 'À ouvrir sur l’ordinateur branché au grand écran (lecture seule).',
  },
];

export function Acces({ partieId, nom }: { partieId: string; nom?: string }) {
  const [cote, setCote] = useState<Cote>('console');
  const [adresses, setAdresses] = useState(() => ({
    joueurs: lireAdresse('joueurs'),
    ecran: lireAdresse('ecran'),
  }));
  const [copie, setCopie] = useState<string | null>(null);
  useEffect(() => {
    try {
      for (const k of Object.keys(CLES) as (keyof typeof CLES)[]) localStorage.setItem(CLES[k], adresses[k]);
    } catch {
      /* stockage indisponible : l'adresse sera à retaper */
    }
  }, [adresses]);

  const base = cote === 'console' ? `${location.origin}${location.pathname}` : adresses[cote].trim().replace(/\/+$/, '');
  const lien = base ? `${base}${cote === 'console' ? '' : '/'}?partie=${encodeURIComponent(partieId)}` : '';
  const onglet = ONGLETS.find((o) => o.id === cote)!;
  const copier = (texte: string) =>
    void navigator.clipboard?.writeText(texte).then(
      () => setCopie(texte),
      () => {},
    );

  return (
    <div className="acces">
      <div className="acces__code">
        <span className="lbl">Code de la partie{nom ? ` · ${nom}` : ''}</span>
        <code>{partieId}</code>
        <button type="button" className="modal-btn modal-btn--ghost" onClick={() => copier(partieId)}>
          <i className="fa-regular fa-copy" aria-hidden="true" /> {copie === partieId ? 'Copié' : 'Copier'}
        </button>
      </div>
      <div className="segments" role="tablist">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={cote === o.id}
            className={`modal-btn modal-btn--ghost${cote === o.id ? ' choisi' : ''}`}
            onClick={() => setCote(o.id)}
          >
            <i className={`fa-solid ${o.icone}`} aria-hidden="true" /> {o.titre}
          </button>
        ))}
      </div>
      <div className="acces__qr">
        <div className="acces__img">{lien ? <Qr texte={lien} /> : <i className="fa-solid fa-qrcode" aria-hidden="true" />}</div>
        <div className="pile">
          <p className="info">{onglet.aide}</p>
          {cote !== 'console' && (
            <label>
              Adresse de {cote === 'joueurs' ? 'l’app joueur' : 'l’écran géant'}
              <input value={adresses[cote]} onChange={(e) => setAdresses((a) => ({ ...a, [cote]: e.target.value }))} placeholder="Ex. https://jeu.exemple.fr" />
            </label>
          )}
          {lien ? (
            <p className="acces__lien">
              <a href={lien} target="_blank" rel="noreferrer">
                {lien}
              </a>{' '}
              <button type="button" className="lien" onClick={() => copier(lien)}>
                {copie === lien ? 'copié' : 'copier'}
              </button>
            </p>
          ) : (
            <p className="vide">Tape l’adresse pour obtenir le QR.</p>
          )}
          {cote === 'console' && (
            <p className="vide">Les codes des PNJ ne sont jamais réaffichés : ce sont ceux que tu leur as donnés dans Préparation › Équipe.</p>
          )}
        </div>
      </div>
    </div>
  );
}
