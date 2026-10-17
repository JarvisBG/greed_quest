// Clear (RG-13) : le joueur au Book complet vient voir le GM ; le GM scanne sa licence et confirme (la partie se
// termine) ou refuse avec un motif. Puis : lots réels à remettre et classement final (podium, RG-13.6).
import { useEffect, useState } from 'react';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/client';
import { lireLicence } from '../../lib/format';
import type { Equipe } from '../../lib/useEquipe';
import { Action } from '../Action';
import { CameraQr } from '../CameraQr';

interface Final {
  gagnant: string | null;
  lots: { carte: string; lotReel: string | null }[];
  lignes: { place: number; pseudo: string; cartes: number; points: number; jenny: number }[];
}

export function Clear({ eq }: { eq: Equipe }) {
  const base = `/parties/${eq.session!.partieId}`;
  const [scan, setScan] = useState<string | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [final, setFinal] = useState<Final | null>(null);
  const terminee = eq.partie?.etat === 'terminee';

  useEffect(() => {
    if (terminee) void api.get<Final>(`${base}/classement-final`).then(setFinal, () => {});
  }, [base, terminee, eq.version.recompenses, eq.version.classement_final]);

  const demandes = eq.joueurs.filter((j) => j.livreGele);
  const confirmer = async (licence: string) => {
    setScan(null);
    try {
      await api.post(`${base}/clear/confirmer`, { licence });
      setMessage({ ok: true, texte: 'Clear confirmé : la partie est terminée.' });
    } catch (e) {
      setMessage({ ok: false, texte: e instanceof ApiError ? e.message : 'Confirmation impossible' });
    }
    void eq.chargerJoueurs();
  };

  const j = refus ? eq.joueurs.find((x) => x.id === refus) : undefined;
  if (j) {
    return (
      <Action
        titre={`Refuser le Clear de ${j.pseudo}`}
        bouton={`Refuser le Clear de ${j.pseudo}`}
        avecMotif
        onFini={() => (setRefus(null), void eq.chargerJoueurs())}
        envoyer={async (motif) => {
          await api.post(`${base}/clear/annuler`, { joueurId: j.id, motif });
          return `Clear refusé : le Book de ${j.pseudo} est rouvert, il continue à jouer.`;
        }}
      />
    );
  }

  return (
    <section className="pile">
      {message && <p className={message.ok ? 'ok' : 'erreur'}>{message.texte}</p>}
      {!terminee && (
        <>
          <p className="info">Quand un joueur a toutes les cartes, son Book se fige et il vient te voir. Scanne sa licence pour confirmer.</p>
          {demandes.length === 0 && <p className="info">Aucune demande de Clear.</p>}
          <ul className="fil">
            {demandes.map((d) => (
              <li key={d.id} className="pile">
                <strong>{d.pseudo} annonce un Clear</strong>
                {scan === d.id ? (
                  <CameraQr lire={lireLicence} onLu={(l) => void confirmer(l)} invalide="Ce QR n’est pas une licence Greed Quest" saisie="Code de la licence (GQL1…)" />
                ) : (
                  <div className="segments">
                    <button type="button" onClick={() => (setMessage(null), setScan(d.id))}>
                      Scanner sa licence et confirmer
                    </button>
                    <button type="button" className="secondaire danger" onClick={() => setRefus(d.id)}>
                      Refuser
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {terminee && final && (
        <>
          <div className="carte">
            <h2>Gagnant du Clear</h2>
            <p>{final.gagnant ?? 'Personne (partie terminée sans Clear)'}</p>
            {final.gagnant && final.lots.length === 0 && <p className="info">Le gagnant choisit ses 3 cartes sur son téléphone…</p>}
            {final.lots.length > 0 && (
              <>
                <p>Lots à remettre :</p>
                <ul className="liste">
                  {final.lots.map((l) => (
                    <li key={l.carte}>
                      {l.carte} → <strong>{l.lotReel ?? 'lot non renseigné'}</strong>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div className="carte">
            <h2>Classement final (podium = 3 premiers)</h2>
            <ol className="liste">
              {final.lignes.map((l) => (
                <li key={l.place}>
                  <strong>{l.pseudo}</strong> · {l.cartes} cartes · {l.points} pts · {l.jenny} J
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </section>
  );
}
