// RG-7 : scan d'une balise à la caméra (ou code saisi), résultat du tirage ou refus en clair (RG-7.4).
// RG-7.5 : sans réseau, le scan part en file et sera envoyé au retour de la connexion.
import QrScanner from 'qr-scanner';
import { useEffect, useRef, useState } from 'react';
import { libelleGain, resumeIssue } from '../lib/format';
import { lireQrBalise } from '../lib/qr';
import type { IssueScan } from '../lib/scan';

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
  const [avis, setAvis] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const video = useRef<HTMLVideoElement>(null);
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

  useEffect(() => {
    if (etat.type !== 'camera' || !video.current) return;
    const scanner = new QrScanner(
      video.current,
      (r) => {
        const id = lireQrBalise(r.data);
        if (id) void envoyer(id);
        else setAvis('Ce QR code n’est pas une balise du jeu');
      },
      { preferredCamera: 'environment', highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 5 },
    );
    scanner.start().then(
      () => setAvis(null),
      () => setAvis('Caméra indisponible : autorise-la dans les réglages du navigateur, ou saisis le code de la balise'),
    );
    return () => scanner.destroy();
  }, [etat.type]);

  return (
    <div className="scan">
      {gpsErreur && <p className="erreur">{gpsErreur}</p>}
      {enFile > 0 && (
        <p className="info">
          {enFile} scan{enFile > 1 ? 's' : ''} en attente de réseau
        </p>
      )}
      {etat.type === 'camera' && (
        <>
          <div className="viseur">
            <video ref={video} muted playsInline />
          </div>
          {avis && <p className="info">{avis}</p>}
          <form
            className="saisie"
            onSubmit={(e) => {
              e.preventDefault();
              const id = lireQrBalise(code);
              if (id) void envoyer(id);
              else setAvis('Code de balise invalide');
            }}
          >
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ou saisis le code de la balise" autoCapitalize="off" autoCorrect="off" />
            <button type="submit" className="secondaire" disabled={!code.trim()}>
              Valider
            </button>
          </form>
        </>
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
          <button
            onClick={() => {
              setCode('');
              setEtat({ type: 'camera' });
            }}
          >
            Scanner une autre balise
          </button>
        </div>
      )}
    </div>
  );
}
