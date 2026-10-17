// Checkpoints PNJ : le joueur réussit le défi, l'arbitre choisit la récompense (une carte du stock
// et/ou des jenny) puis scanne la licence du gagnant (RG-5.2). RG-5.4 : bonus Matérialisation.
import { useEffect, useState } from 'react';
import { ApiError } from '../lib/api';
import { api } from '../lib/client';
import { lireLicence, numeroCarte, stockCheckpoint, type Checkpoint, type Zone } from '../lib/format';
import type { Equipe } from '../lib/useEquipe';
import { CameraQr } from './CameraQr';

type Bonus = { kind: 'carte'; nom: string; rang: string } | { kind: 'sort'; sort: string } | { kind: 'jenny'; montant: number } | null;

export function Checkpoints({ eq }: { eq: Equipe }) {
  const base = `/parties/${eq.session!.partieId}`;
  const [liste, setListe] = useState<Checkpoint[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [carteId, setCarteId] = useState<string>('');
  const [jenny, setJenny] = useState(0);
  const [scan, setScan] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [issue, setIssue] = useState<string | null>(null);

  const charger = () =>
    api.get<{ checkpoints: Checkpoint[] }>(`${base}/checkpoints`).then(
      (r) => setListe(r.checkpoints),
      () => {},
    );
  useEffect(() => {
    void charger();
    void api.get<{ zones: Zone[] }>(`${base}/zones`).then((r) => setZones(r.zones), () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  const nomZone = (id: string) => zones.find((z) => z.id === id)?.nom ?? '';
  const moi = eq.session!.id;
  // Les checkpoints confiés à cet arbitre d'abord.
  const tries = [...liste].sort((a, b) => Number(b.arbitreId === moi) - Number(a.arbitreId === moi));
  const cp = liste.find((c) => c.id === choisi);

  function recommencer() {
    setCarteId('');
    setJenny(0);
    setScan(false);
    setErreur(null);
    setIssue(null);
  }

  async function valider(licence: string) {
    if (!cp || envoi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.post<{ joueur: string; cartes: string[]; bonus: Bonus }>(`${base}/checkpoints/${cp.id}/reussite`, {
        licence,
        jenny,
        ...(carteId ? { carteId } : {}),
      });
      const gains = [...r.cartes, ...(jenny > 0 ? [`${jenny} J`] : [])];
      const bonus = r.bonus ? ` Bonus Matérialisation : ${r.bonus.kind === 'carte' ? `${r.bonus.nom} (${r.bonus.rang})` : r.bonus.kind === 'sort' ? `sort ${r.bonus.sort}` : `${r.bonus.montant} J`}.` : '';
      setIssue(`${r.joueur} reçoit ${gains.length ? gains.join(' + ') : 'rien'}.${bonus}`);
      setScan(false);
      void charger();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Validation impossible');
    } finally {
      setEnvoi(false);
    }
  }

  if (!cp) {
    return (
      <section className="pile">
        {tries.length === 0 && <p className="info">Aucun checkpoint : le GM les crée depuis sa console.</p>}
        <ul className="fil">
          {tries.map((c) => (
            <li key={c.id}>
              <button type="button" className="secondaire large" onClick={() => (recommencer(), setChoisi(c.id))}>
                <strong>{c.defi}</strong>
                <span className="detail info">
                  {nomZone(c.zoneId)} · {c.cartes.length} carte{c.cartes.length > 1 ? 's' : ''} en stock
                  {c.arbitreId === moi && ' · le tien'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const stock = stockCheckpoint(cp.cartes, eq.catalogue);
  return (
    <section className="pile">
      <div className="carte">
        <h1>{cp.defi}</h1>
        <p className="info">{nomZone(cp.zoneId)}</p>
        <button type="button" className="lien" onClick={() => setChoisi(null)}>
          Autres checkpoints
        </button>
      </div>

      {issue ? (
        <div className="carte">
          <p className="ok">{issue}</p>
          <button type="button" onClick={recommencer}>Joueur suivant</button>
        </div>
      ) : !scan ? (
        <div className="carte">
          <h2>Récompense</h2>
          <div className="choix">
            <button type="button" className={`secondaire ${carteId === '' ? 'choisi' : ''}`} onClick={() => setCarteId('')}>
              Pas de carte
            </button>
            {stock.map(({ carte, n }) => (
              <button key={carte.id} type="button" className={`secondaire ${carteId === carte.id ? 'choisi' : ''}`} onClick={() => setCarteId(carte.id)}>
                <span className={`rang r${carte.rang}`}>{carte.rang}</span> {numeroCarte(carte.numero)} {carte.nom}
                {n > 1 && <span className="info"> ×{n}</span>}
              </button>
            ))}
          </div>
          <label>
            Jenny
            <input type="number" min={0} max={500} value={jenny} onChange={(e) => setJenny(Math.min(500, Math.max(0, Math.floor(Number(e.target.value) || 0))))} />
          </label>
          <button type="button" disabled={!carteId && jenny === 0} onClick={() => setScan(true)}>
            Scanner la licence du gagnant
          </button>
        </div>
      ) : (
        <div className="carte">
          <h2>Licence du gagnant</h2>
          <CameraQr lire={lireLicence} onLu={valider} invalide="Ce QR n’est pas une licence Greed Quest" saisie="Code de la licence (GQL1…)" />
          {envoi && <p className="info">Envoi…</p>}
          {erreur && <p className="erreur">{erreur}</p>}
          <button type="button" className="lien" onClick={() => setScan(false)}>
            Changer la récompense
          </button>
        </div>
      )}
    </section>
  );
}
