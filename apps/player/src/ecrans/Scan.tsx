// RG-7 : scan d'une balise à la caméra (ou code saisi), résultat du tirage ou refus en clair (RG-7.4).
// RG-7.5 : sans réseau, le scan part en file et sera envoyé au retour de la connexion.
import { useEffect, useRef, useState } from 'react';
import { libelleGain, resumeIssue } from '../lib/format';
import { lireQrBalise } from '../lib/qr';
import type { IssueScan } from '../lib/scan';
import { CameraQr } from './CameraQr';

type Etat = { type: 'camera' } | { type: 'envoi' } | { type: 'issue'; issue: IssueScan };

export function Scan({
  scannerBalise,
  enFile,
  gpsErreur,
  baliseInitiale,
}: {
  scannerBalise: (baliseId: string) => Promise<IssueScan>;
  enFile: number;
  gpsErreur: string | null;
  baliseInitiale?: string | null;
}) {
  const [etat, setEtat] = useState<Etat>(baliseInitiale ? { type: 'envoi' } : { type: 'camera' });
  const occupe = useRef(false);

  const envoyer = async (baliseId: string) => {
    if (occupe.current) return;
    occupe.current = true;
    setEtat({ type: 'envoi' });
    try {
      setEtat({ type: 'issue', issue: await scannerBalise(baliseId) });
    } finally {
      occupe.current = false;
    }
  };

  useEffect(() => {
    if (baliseInitiale) void envoyer(baliseInitiale);
    // une seule fois, à l'ouverture par lien
  }, []);

  return (
    <div className="scan">
      {gpsErreur && <p className="erreur">{gpsErreur}</p>}
      {enFile > 0 && (
        <p className="info">
          {enFile} scan{enFile > 1 ? 's' : ''} en attente de réseau
        </p>
      )}
      {etat.type === 'camera' && (
        <CameraQr lire={lireQrBalise} onLu={(id) => void envoyer(id)} invalide="Ce QR code n’est pas une balise du jeu" saisie="Ou saisis le code de la balise" />
      )}
      {etat.type === 'envoi' && <p className="info">Scan en cours…</p>}
      {etat.type === 'issue' && (
        <div className="carte">
          {etat.issue.type === 'ok' ? (
            <>
              <h1>Tu obtiens</h1>
              <ul className="liste gains">
                {etat.issue.gains.map((g, i) => (
                  <li key={i}>{libelleGain(g)}</li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h1>{etat.issue.type === 'refus' ? 'Scan refusé' : 'Pas de réseau'}</h1>
              <p>{resumeIssue(etat.issue)}</p>
            </>
          )}
          <button onClick={() => setEtat({ type: 'camera' })}>
            Scanner une autre balise
          </button>
        </div>
      )}
    </div>
  );
}
