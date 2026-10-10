// RG-9 : boutique de Masadora. Le QR du lieu est scanné sur place (RG-9.2) puis gardé le temps de la
// visite. Paquet de 3 sorts (stock par vague de 20 min, max par joueur, RG-9.3) ; revente de toute carte
// sauf SS (RG-9.4). Prix et refus : serveur (Krach de Masadora compris). Amendement 2026-10-10 : avec le sort
// Retour, la boutique s'utilise à distance, sans QR.
import type { PositionInput, Rank, SpellType } from '@gq/shared';
import { useEffect, useState } from 'react';
import { api } from '../lib/client';
import { numeroCarte, SORTS } from '../lib/format';
import { contenu, type EmplacementCarte } from '../lib/livre';
import { lireQrLieu } from '../lib/qr';
import { useLivre } from '../lib/useLivre';
import { CameraQr } from './CameraQr';

interface EtatBoutique {
  prixPaquet: number;
  paquetsRestants: number;
  mesAchats: number;
  maxParVague: number;
  revente: Record<Rank, number | null>;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function Boutique({
  partieId,
  jenny,
  version,
  positionAction,
  apresAction,
  onRetour,
  aDistance = false,
}: {
  partieId: string;
  jenny: number;
  version: number;
  positionAction: (envoyer?: boolean) => Promise<PositionInput>;
  apresAction: () => void;
  onRetour: () => void;
  /** Visite à distance ouverte par Retour. */
  aDistance?: boolean;
}) {
  const [etat, setEtat] = useState<EtatBoutique | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [scan, setScan] = useState(false);
  const [vente, setVente] = useState<EmplacementCarte | null>(null);
  const [resultat, setResultat] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const { livre } = useLivre(partieId, version);
  const present = qr !== null || aDistance;
  const lieu = qr ? { qr } : {};

  useEffect(() => {
    api.get<EtatBoutique>(`/parties/${partieId}/boutique`).then(setEtat, (e: unknown) => setErreur(message(e)));
  }, [partieId, version]);

  const agir = async (fn: (position: PositionInput) => Promise<string>) => {
    setEnvoi(true);
    setErreur(null);
    setResultat(null);
    try {
      setResultat(await fn(await positionAction()));
      apresAction();
    } catch (e) {
      setErreur(message(e));
    } finally {
      setEnvoi(false);
    }
  };

  const acheter = () =>
    agir(async (position) => {
      const r = await api.post<{ prix: number; sorts: { itemId: string; sort: SpellType }[] }>(`/parties/${partieId}/boutique/achat`, { ...lieu, position });
      return `Paquet acheté ${r.prix} J : ${r.sorts.map((s) => SORTS[s.sort].nom).join(', ')}.`;
    });
  const revendre = (c: EmplacementCarte) =>
    agir(async (position) => {
      const r = await api.post<{ prix: number; contrefacon: boolean }>(`/parties/${partieId}/boutique/revente`, { ...lieu, itemId: c.itemId, position });
      setVente(null);
      return r.contrefacon
        ? `Masadora a reconnu une contrefaçon : ${c.nom} reprise pour ${r.prix} J.`
        : `${c.nom} revendue ${r.prix} J.`;
    });

  const cartes = livre ? contenu(livre).filter((e): e is EmplacementCarte => e.kind === 'carte' && !e.engagee) : [];
  const prixRevente = (c: EmplacementCarte) => (c.rang && etat ? etat.revente[c.rang] : null);

  return (
    <div className="boutique">
      <button className="lien" onClick={onRetour}>
        ‹ Retour
      </button>
      <div className="carte">
        <h1>Boutique de Masadora</h1>
        {etat && (
          <p>
            Paquet de 3 sorts : <strong>{etat.prixPaquet} J</strong> · reste {etat.paquetsRestants} paquet{etat.paquetsRestants > 1 ? 's' : ''} pour cette vague · tes
            achats {etat.mesAchats}/{etat.maxParVague}
          </p>
        )}
        {aDistance && !qr && <p className="info">Visite à distance (Retour).</p>}
        {!present && !scan && (
          <>
            <p className="info">Sur place, scanne le QR de la boutique pour acheter ou revendre.</p>
            <button onClick={() => setScan(true)}>Scanner le QR de Masadora</button>
          </>
        )}
        {scan && (
          <CameraQr
            lire={lireQrLieu}
            onLu={(v) => {
              setQr(v);
              setScan(false);
            }}
            invalide="Ce QR n’est pas celui d’un lieu du jeu"
            saisie="Ou saisis le code de la boutique"
          />
        )}
        {present && etat && (
          <button disabled={envoi || etat.paquetsRestants === 0 || etat.mesAchats >= etat.maxParVague || jenny < etat.prixPaquet} onClick={() => void acheter()}>
            Acheter un paquet ({etat.prixPaquet} J)
          </button>
        )}
        {resultat && <p className="ok">{resultat}</p>}
        {erreur && <p className="erreur">{erreur}</p>}
      </div>
      {present && etat && (
        <section>
          <h2>Revendre une carte</h2>
          {cartes.length === 0 && <p className="info">Aucune carte à revendre.</p>}
          <ul className="emplacements">
            {cartes.map((c) => {
              const prix = prixRevente(c);
              return (
                <li key={c.itemId} className="emplacement ligne">
                  <span>
                    <span className="numero">{numeroCarte(c.numero)}</span> {c.nom} {c.rang && <span className={`rang r${c.rang}`}>{c.rang}</span>}
                  </span>
                  {prix === null ? (
                    <span className="info">Invendable</span>
                  ) : vente?.itemId === c.itemId ? (
                    <button disabled={envoi} onClick={() => void revendre(c)}>
                      Confirmer {prix} J
                    </button>
                  ) : (
                    <button className="secondaire" onClick={() => setVente(c)}>
                      {prix} J
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
