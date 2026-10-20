// Arène de Soufrabi (RG-9.6) : le PNJ scanne la licence (la mise est prélevée), arbitre le défi
// (Victoire / Défaite), ou annule une entrée faite par erreur (motif, mise rendue).
import { useEffect, useState } from 'react';
import { ApiError } from '../lib/api';
import { api } from '../lib/client';
import { lireLicence } from '../lib/format';
import type { Equipe } from '../lib/useEquipe';
import { Action } from './Action';
import { CameraQr } from './CameraQr';

interface Tentative {
  id: string;
  pseudo: string;
  mise: number;
}
type Gain = { kind: 'carte'; nom: string; rang: string } | { kind: 'jenny'; montant: number; objet?: string } | null;

export function Arene({ eq }: { eq: Equipe }) {
  const base = `/parties/${eq.session!.partieId}`;
  const [tentatives, setTentatives] = useState<Tentative[]>([]);
  const [scan, setScan] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [annuler, setAnnuler] = useState<Tentative | null>(null);

  const charger = () => api.get<{ tentatives: Tentative[] }>(`${base}/arene`).then((r) => setTentatives(r.tentatives), () => {});
  // Rechargée à chaque ligne de journal de l'Arène (entrée, issue, annulation faites par un autre PNJ), pas à chaque scan ou position.
  const derniereArene = eq.journal.find((l) => l.action.startsWith('arene'))?.id ?? 0;
  useEffect(() => void charger(), [base, derniereArene]); // eslint-disable-line react-hooks/exhaustive-deps

  async function faire(p: Promise<string>) {
    try {
      setMessage({ ok: true, texte: await p });
    } catch (e) {
      setMessage({ ok: false, texte: e instanceof ApiError ? e.message : 'Action impossible' });
    }
    void charger();
  }

  const entrer = (licence: string) => {
    setScan(false);
    void faire(api.post<{ joueur: { pseudo: string }; mise: number }>(`${base}/arene/entree`, { licence }).then((r) => `${r.joueur.pseudo} entre dans l’arène : ${r.mise} J pris.`));
  };
  const issue = (t: Tentative, victoire: boolean) =>
    faire(
      api.post<{ joueur: string; gain: Gain }>(`${base}/arene/${t.id}/issue`, { victoire }).then((r) =>
        !victoire ? `${r.joueur} a perdu : la mise est gardée.` : `${r.joueur} a gagné : ${texteGain(r.gain)}.`,
      ),
    );

  if (annuler) {
    return (
      <Action
        titre={`Annuler l’entrée de ${annuler.pseudo}`}
        bouton={`Annuler et rendre ${annuler.mise} J`}
        avecMotif
        onFini={() => (setAnnuler(null), void charger())}
        envoyer={async (motif) => {
          const r = await api.post<{ rembourse: number }>(`${base}/arene/${annuler.id}/annuler`, { motif });
          return `Entrée annulée : ${r.rembourse} J rendus à ${annuler.pseudo}.`;
        }}
      />
    );
  }

  return (
    <section className="pile">
      <div className="carte">
        <h2>Nouveau combattant</h2>
        {scan ? (
          <>
            <CameraQr lire={lireLicence} onLu={entrer} invalide="Ce QR n’est pas une licence Greed Island" saisie="Code de la licence (GQL1…)" />
            <button type="button" className="lien" onClick={() => setScan(false)}>
              Fermer
            </button>
          </>
        ) : (
          <button type="button" onClick={() => (setMessage(null), setScan(true))}>
            Scanner la licence du joueur
          </button>
        )}
        {message && <p className={message.ok ? 'ok' : 'erreur'}>{message.texte}</p>}
      </div>
      <h2>Combats en cours</h2>
      {tentatives.length === 0 && <p className="info">Personne dans l’arène.</p>}
      <ul className="fil">
        {tentatives.map((t) => (
          <li key={t.id} className="pile">
            <strong>
              {t.pseudo} <span className="info">· mise {t.mise} J</span>
            </strong>
            <div className="segments">
              <button type="button" onClick={() => void issue(t, true)}>
                Victoire
              </button>
              <button type="button" className="secondaire danger" onClick={() => void issue(t, false)}>
                Défaite
              </button>
            </div>
            <button type="button" className="lien" onClick={() => setAnnuler(t)}>
              Entrée faite par erreur : annuler
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function texteGain(g: Gain): string {
  if (!g) return 'rien';
  if (g.kind === 'carte') return `la carte ${g.nom} (${g.rang})`;
  return `${g.montant} J${g.objet ? ` et un objet (${g.objet})` : ''}`;
}
