// QR code dessiné en SVG (modules noirs sur fond blanc, marge de 4 modules pour la lecture).
import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

export function QrCode({ texte, titre }: { texte: string; titre: string }) {
  const { n, chemin } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(texte);
    qr.make();
    const n = qr.getModuleCount();
    let chemin = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) chemin += `M${x + 4} ${y + 4}h1v1h-1z`;
    return { n, chemin };
  }, [texte]);
  return (
    <svg className="qr" viewBox={`0 0 ${n + 8} ${n + 8}`} role="img" aria-label={titre} shapeRendering="crispEdges">
      <rect width={n + 8} height={n + 8} fill="#fff" />
      <path d={chemin} fill="#000" />
    </svg>
  );
}
