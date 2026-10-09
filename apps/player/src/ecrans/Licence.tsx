// RG-5.2 : licence QR renouvelée toutes les 30 s, montrée à un PNJ ou au GM (checkpoint, enchère, Clear).
// Calculée sur le téléphone : elle reste valable sans réseau.
import { useEffect, useState } from 'react';
import { api } from '../lib/client';
import { calculerLicence, decalage, PERIODE_MS } from '../lib/licence';
import { QrCode } from './QrCode';

export function Licence({ partieId, joueurId, pseudo, secret }: { partieId: string; joueurId: string; pseudo: string; secret: string }) {
  const [licence, setLicence] = useState<{ qr: string; expireA: number } | null>(null);
  const [ecart, setEcart] = useState(0);
  const [maintenant, setMaintenant] = useState(Date.now());

  // Recale l'horloge sur celle du serveur quand le réseau est là (sinon heure du téléphone).
  useEffect(() => {
    api.get<{ qr: string; expireA: number }>(`/parties/${partieId}/licence`).then(
      (r) => setEcart(decalage(r.expireA, Date.now())),
      () => undefined,
    );
  }, [partieId]);

  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const heure = maintenant + ecart;
  const fenetre = Math.floor(heure / PERIODE_MS);
  useEffect(() => {
    let actif = true;
    void calculerLicence(joueurId, secret, fenetre * PERIODE_MS).then((l) => actif && setLicence(l));
    return () => {
      actif = false;
    };
  }, [joueurId, secret, fenetre]);

  const reste = licence ? Math.max(0, Math.ceil((licence.expireA - heure) / 1000)) : 0;
  return (
    <div className="carte licence">
      <h1>Licence de {pseudo}</h1>
      <p className="info">À montrer à l’équipe pour un checkpoint, une enchère ou un Clear.</p>
      {licence ? <QrCode texte={licence.qr} titre={`Licence de ${pseudo}`} /> : <p className="info">Calcul…</p>}
      <div className="jauge" aria-hidden="true">
        <span style={{ width: `${(reste / (PERIODE_MS / 1000)) * 100}%` }} />
      </div>
      <p className="info">Nouveau code dans {reste} s</p>
    </div>
  );
}
