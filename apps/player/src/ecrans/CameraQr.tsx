// Lecture d'un QR à la caméra arrière, avec saisie du code en secours (caméra refusée, QR abîmé).
// `lire` transforme le texte lu en valeur utile, ou null si ce n'est pas le bon type de QR.
// Même viseur que la page Scan (cadre d'encre, coins blancs) : les surimpressions de qr-scanner sont coupées,
// elles se décalaient hors du cadre (Masadora, Antokiba).
import QrScanner from 'qr-scanner';
import { useEffect, useRef, useState } from 'react';

export function CameraQr<T>({
  lire,
  onLu,
  invalide,
  saisie,
}: {
  lire: (texte: string) => T | null;
  onLu: (valeur: T) => void;
  /** Message quand le QR lu n'est pas du bon type. */
  invalide: string;
  /** Texte d'aide du champ de saisie. */
  saisie: string;
}) {
  const [avis, setAvis] = useState<string | null>(null);
  const [refusee, setRefusee] = useState(false);
  const [code, setCode] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const rappel = useRef({ lire, onLu, invalide });
  rappel.current = { lire, onLu, invalide };

  useEffect(() => {
    if (!video.current) return;
    let fini = false;
    const scanner = new QrScanner(
      video.current,
      (r) => {
        if (fini) return;
        const v = rappel.current.lire(r.data);
        if (v === null) return setAvis(rappel.current.invalide);
        fini = true;
        rappel.current.onLu(v);
      },
      { preferredCamera: 'environment', highlightScanRegion: false, highlightCodeOutline: false, maxScansPerSecond: 5 },
    );
    scanner.start().then(
      () => setRefusee(false),
      () => setRefusee(true),
    );
    return () => scanner.destroy();
  }, []);

  return (
    <>
      <div className="scan-viseur">
        <video ref={video} muted playsInline aria-label="Image de la caméra" />
        {refusee && <p className="scan-camera">Caméra indisponible : autorise-la dans les réglages du navigateur, ou saisis le code.</p>}
        <div className="scan-cible" aria-hidden="true">
          <i className="coin hg" />
          <i className="coin hd" />
          <i className="coin bg" />
          <i className="coin bd" />
        </div>
      </div>
      {avis && (
        <p className="info" role="status">
          {avis}
        </p>
      )}
      <form
        className="scan-saisie"
        onSubmit={(e) => {
          e.preventDefault();
          const v = lire(code);
          if (v !== null) onLu(v);
          else setAvis(invalide);
        }}
      >
        <input className="gi-champ" value={code} onChange={(e) => setCode(e.target.value)} placeholder={saisie} aria-label={saisie} autoCapitalize="off" autoCorrect="off" autoComplete="off" />
        <button type="submit" className="gi-btn-trait" disabled={!code.trim()}>
          Valider
        </button>
      </form>
    </>
  );
}
