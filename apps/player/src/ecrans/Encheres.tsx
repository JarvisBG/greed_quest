// RG-11.4 / 11.5 : enchères d'Antokiba. Un PNJ met une carte en vente 3 min ; pour participer, on
// scanne le QR d'Antokiba sur place, puis on surenchérit dans l'app. Seul le gagnant est débité.
import type { PositionInput, Rank } from '@gq/shared';
import { useEffect, useState } from 'react';
import { api } from '../lib/client';
import { offreMin } from '../lib/encheres';
import { formatChrono } from '../lib/format';
import { lireQrLieu } from '../lib/qr';
import { CameraQr } from './CameraQr';

interface Enchere {
  id: string;
  carte: { id: string; nom: string; rang: Rank };
  resteMs: number;
  prixDepart: number;
  meilleureOffre: { montant: number; pseudo: string } | null;
  inscrit: boolean;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));


export function Encheres({
  partieId,
  jenny,
  version,
  positionAction,
  onRetour,
  aDistance = false,
}: {
  partieId: string;
  jenny: number;
  version: number;
  positionAction: (envoyer?: boolean) => Promise<PositionInput>;
  onRetour: () => void;
  /** Amendement 2026-10-10 : visite à distance d'Antokiba ouverte par Retour (pas de QR). */
  aDistance?: boolean;
}) {
  const [liste, setListe] = useState<{ encheres: Enchere[]; recuA: number } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [scan, setScan] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [maintenant, setMaintenant] = useState(Date.now());

  const charger = () =>
    api.get<{ encheres: Enchere[] }>(`/parties/${partieId}/encheres`).then(
      (r) => setListe({ encheres: r.encheres, recuA: Date.now() }),
      (e: unknown) => setErreur(message(e)),
    );
  useEffect(() => {
    void charger();
  }, [partieId, version]);
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const rejoindre = async (id: string, code: string | null) => {
    setErreur(null);
    try {
      await api.post(`/parties/${partieId}/encheres/${id}/rejoindre`, { ...(code ? { qr: code } : {}), position: await positionAction() });
      if (code) setQr(code);
      await charger();
    } catch (e) {
      setErreur(message(e));
    }
  };

  const encheres = liste?.encheres.filter((e) => e.resteMs - (maintenant - liste.recuA) > 0) ?? [];
  return (
    <div className="encheres">
      <button className="lien" onClick={onRetour}>
        ‹ Retour
      </button>
      <div className="carte">
        <h1>Enchères d’Antokiba</h1>
        <p className="info">Seul le gagnant paie, à la clôture. Pour participer, scanne le QR d’Antokiba sur place.</p>
        {erreur && <p className="erreur">{erreur}</p>}
      </div>
      {liste && encheres.length === 0 && <p className="info">Aucune enchère en cours.</p>}
      {encheres.map((e) => (
        <div key={e.id} className="carte">
          <h2 className="titre-enchere">
            {e.carte.nom} <span className={`rang r${e.carte.rang}`}>{e.carte.rang}</span>
            <span className="chrono">{formatChrono(e.resteMs - (maintenant - liste!.recuA))}</span>
          </h2>
          <p>{e.meilleureOffre ? `Meilleure offre : ${e.meilleureOffre.montant} J (${e.meilleureOffre.pseudo})` : `Mise de départ : ${e.prixDepart} J`}</p>
          {e.inscrit ? (
            <Offre partieId={partieId} enchere={e} jenny={jenny} onFait={() => void charger()} />
          ) : scan === e.id ? (
            <CameraQr
              lire={lireQrLieu}
              onLu={(code) => {
                setScan(null);
                void rejoindre(e.id, code);
              }}
              invalide="Ce QR n’est pas celui d’un lieu du jeu"
              saisie="Ou saisis le code d’Antokiba"
            />
          ) : (
            <button className="secondaire" onClick={() => (qr || aDistance ? void rejoindre(e.id, qr) : setScan(e.id))}>
              Participer
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function Offre({ partieId, enchere, jenny, onFait }: { partieId: string; enchere: Enchere; jenny: number; onFait: () => void }) {
  const min = offreMin(enchere);
  const [montant, setMontant] = useState(String(min));
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => setMontant(String(min)), [min]);
  const n = Math.floor(Number(montant) || 0);
  const encherir = async () => {
    setErreur(null);
    try {
      await api.post(`/parties/${partieId}/encheres/${enchere.id}/offre`, { montant: n });
      onFait();
    } catch (e) {
      setErreur(message(e));
    }
  };
  return (
    <>
      <div className="saisie">
        <input inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value.replace(/\D/g, ''))} aria-label="Montant de l’offre" />
        <button disabled={n < min || n > jenny} onClick={() => void encherir()}>
          Enchérir
        </button>
      </div>
      {n > jenny && <p className="erreur">Tu n’as que {jenny} J.</p>}
      {erreur && <p className="erreur">{erreur}</p>}
    </>
  );
}
