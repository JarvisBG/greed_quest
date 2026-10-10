// QR code dessiné en SVG (modules noirs sur fond blanc, marge de 4 modules pour la lecture ;
// moins quand le support blanc autour complète déjà la marge, comme la plaque de la licence).
import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

export function QrCode({ texte, titre, marge = 4 }: { texte: string; titre: string; marge?: number }) {
  const { n, chemin } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(texte);
    qr.make();
    const n = qr.getModuleCount();
    let chemin = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) chemin += `M${x + marge} ${y + marge}h1v1h-1z`;
    return { n, chemin };
  }, [texte, marge]);
  return (
    <svg className="qr" viewBox={`0 0 ${n + 2 * marge} ${n + 2 * marge}`} role="img" aria-label={titre} shapeRendering="crispEdges">
      <rect width={n + 2 * marge} height={n + 2 * marge} fill="#fff" />
      <path d={chemin} fill="#000" />
    </svg>
  );
}
