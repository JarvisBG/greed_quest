// Lecture d'un QR à la caméra arrière, avec saisie du code en secours (caméra refusée, QR abîmé).
// `lire` transforme le texte lu en valeur utile, ou null si ce n'est pas le bon type de QR.
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
      { preferredCamera: 'environment', highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 5 },
    );
    scanner.start().then(
      () => setAvis(null),
      () => setAvis('Caméra indisponible : autorise-la dans les réglages du navigateur, ou saisis le code'),
    );
    return () => scanner.destroy();
  }, []);

  return (
    <>
      <div className="viseur">
        <video ref={video} muted playsInline />
      </div>
      {avis && <p className="info">{avis}</p>}
      <form
        className="saisie"
        onSubmit={(e) => {
          e.preventDefault();
          const v = lire(code);
          if (v !== null) onLu(v);
          else setAvis(invalide);
        }}
      >
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={saisie} autoCapitalize="off" autoCorrect="off" />
        <button type="submit" className="secondaire" disabled={!code.trim()}>
          Valider
        </button>
      </form>
    </>
  );
}
